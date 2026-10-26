// Server/services/bookService.js
import { Op, QueryTypes } from "sequelize";
import {
  Author,
  Book,
  BookCopy,
  BorrowRequest,
  BorrowedBook,
  Category,
  Reservation,
  sequelize,
} from "../models/index.js";
import { BORROWABLE_COPY_WHERE } from "../config/libraryRules.js";
import withActor from "../utils/withActor.js";
import { BorrowFlowError } from "./borrowFlowService.js";

const bookIncludes = [
  { model: Author, as: "author", attributes: ["author_id", "first_name", "last_name"] },
  { model: Category, as: "category", attributes: ["category_id", "category_name"] },
];

/**
 * Formats a raw Sequelize Book row (with author, category, available_copies)
 * into the shape the frontend BookSummary / BookDetail types expect,
 * providing both camelCase and snake_case keys.
 */
export function formatBookRow(row, availableCopiesOverride) {
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  const author = plain.author;
  const authorName = author
    ? `${author.first_name || ""} ${author.last_name || ""}`.trim()
    : null;
  const availableCopies =
    availableCopiesOverride !== undefined
      ? availableCopiesOverride
      : Number(plain.available_copies ?? 0);

  const totalCopies = plain.total_copies !== undefined ? Number(plain.total_copies) : null;

  return {
    id: plain.book_id,
    bookId: plain.book_id,
    title: plain.title,
    isbn: plain.isbn || null,
    description: plain.description || null,
    publisher: plain.publisher || null,
    publicationYear: plain.year_published || null,
    language: plain.language || null,
    price: plain.price || null,
    status: plain.status,
    coverImageUrl: plain.cover_image || null,
    author: author
      ? {
          id: author.author_id,
          name: authorName,
        }
      : null,
    authors: author
      ? [{ id: author.author_id, name: authorName }]
      : [],
    category: plain.category
      ? {
          id: plain.category.category_id,
          name: plain.category.category_name,
        }
      : null,
    availability: {
      availableCopies,
      totalUsableCopies: totalCopies !== null ? totalCopies : availableCopies,
    },
    availableCopies,
    isArchived: plain.status !== "Active",
    createdAt: plain.created_at,
    updatedAt: plain.updated_at,
    get(key) {
      if (!key) return this;
      return this[key];
    },
  };
}

export async function listBooks({ search, categoryId, page, limit }) {
  const where = { status: "Active" };
  if (categoryId !== undefined) where.category_id = categoryId;
  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
      { title: { [Op.iLike]: pattern } },
      { isbn: { [Op.iLike]: pattern } },
      { publisher: { [Op.iLike]: pattern } },
      { "$author.first_name$": { [Op.iLike]: pattern } },
      { "$author.last_name$": { [Op.iLike]: pattern } },
    ];
  }

  const result = await Book.findAndCountAll({
    where,
    attributes: {
      include: [
        [
          sequelize.literal(`(
            SELECT COUNT(*)::int
            FROM book_copies AS bc
            WHERE bc.book_id = "Book".book_id
              AND bc.status = '${BORROWABLE_COPY_WHERE.status}'
              AND bc.condition_status = '${BORROWABLE_COPY_WHERE.condition_status}'
          )`),
          "available_copies",
        ],
      ],
    },
    include: bookIncludes,
    order: [["title", "ASC"], ["book_id", "ASC"]],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
    subQuery: false,
  });

  const formattedBooks = result.rows.map((row) => formatBookRow(row));

  return {
    data: formattedBooks,
    books: formattedBooks,
    pagination: {
      page,
      limit,
      total: result.count,
      totalPages: Math.ceil(result.count / limit),
    },
    meta: {
      page,
      pageSize: limit,
      total: result.count,
    },
  };
}

export async function getBookDetails(bookId, includeArchived = false) {
  const where = { book_id: bookId };
  if (!includeArchived) {
    where.status = "Active";
  }
  const book = await Book.findOne({
    where,
    include: bookIncludes,
  });
  if (!book) return null;

  const availableCopies = await BookCopy.count({
    where: { book_id: bookId, ...BORROWABLE_COPY_WHERE },
  });

  return formatBookRow(book, availableCopies);
}

/**
 * Returns the top N most borrowed books ranked by total borrow count,
 * optionally restricted to loans since a given timestamp.
 * Counts all borrowed_books rows with status in ('Borrowed', 'Returned')
 * i.e. books that were actually picked up (not just reserved/cancelled).
 *
 * Response shape matches the frontend PopularBook type:
 *   { bookId, title, loanCount }
 * Plus extra fields for richer display (author, cover, category, availability).
 */
export async function getTopBorrowedBooks(topLimit = 10, borrowedSince = null) {
  const recentBorrowFilter = borrowedSince
    ? "AND bb.borrow_date >= :borrowedSince"
    : "";
  const rows = await sequelize.query(
    `SELECT
       b.book_id,
       b.title,
       b.cover_image,
       b.isbn,
       b.description,
       a.author_id,
       a.first_name  AS author_first_name,
       a.last_name   AS author_last_name,
       c.category_id,
       c.category_name,
       COUNT(bb.borrow_id)::int AS loan_count,
       COALESCE((
         SELECT COUNT(*)::int
         FROM book_copies bc
         WHERE bc.book_id = b.book_id
           AND bc.status = 'Available'
           AND bc.condition_status = 'Good'
       ), 0) AS available_copies,
       COALESCE((
         SELECT COUNT(*)::int
         FROM book_copies bc2
         WHERE bc2.book_id = b.book_id
           AND bc2.condition_status IN ('Good', 'Fair', 'New')
       ), 0) AS total_usable_copies
     FROM books b
     LEFT JOIN borrow_requests br ON br.book_id = b.book_id
     LEFT JOIN borrowed_books bb ON bb.request_id = br.request_id
       AND bb.status IN ('Borrowed', 'Returned')
       ${recentBorrowFilter}
     LEFT JOIN authors a ON a.author_id = b.author_id
     LEFT JOIN categories c ON c.category_id = b.category_id
     WHERE b.status = 'Active'
     GROUP BY b.book_id, b.title, b.cover_image, b.isbn, b.description,
              a.author_id, a.first_name, a.last_name,
              c.category_id, c.category_name
     ORDER BY loan_count DESC, b.title ASC
     LIMIT :topLimit`,
    {
      replacements: { topLimit, ...(borrowedSince ? { borrowedSince } : {}) },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => {
    const authorName = row.author_first_name
      ? `${row.author_first_name} ${row.author_last_name || ""}`.trim()
      : null;
    const availableCopies = Number(row.available_copies || 0);
    const totalUsableCopies = Number(row.total_usable_copies || 0);

    return {
      id: row.book_id,
      bookId: row.book_id,
      title: row.title,
      loanCount: row.loan_count,
      isbn: row.isbn || null,
      description: row.description || null,
      coverImageUrl: row.cover_image || null,
      author: authorName
        ? {
            id: row.author_id,
            name: authorName,
          }
        : null,
      authors: authorName
        ? [{ id: row.author_id, name: authorName }]
        : [],
      category: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name,
          }
        : null,
      availability: {
        availableCopies,
        totalUsableCopies,
      },
      availableCopies,
    };
  });
}

/**
 * Creates a new book title in the catalog.
 */
export async function createBook(payload, actorUserId) {
  const {
    title,
    isbn,
    description,
    categoryId,
    category_id,
    authorIds,
    authorId,
    author_id,
    publisher,
    publicationYear,
    year_published,
    language,
    price,
    coverImageUrl,
    cover_image,
    initialCopies = 0,
  } = payload;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Title is required.");
  }

  // Determine author_id
  const targetAuthorId =
    Array.isArray(authorIds) && authorIds.length > 0
      ? authorIds[0]
      : (authorId || author_id);

  if (!targetAuthorId) {
    throw new BorrowFlowError(422, "VALIDATION_ERROR", "Choose at least one author.");
  }

  const author = await Author.findByPk(targetAuthorId);
  if (!author) {
    throw new BorrowFlowError(422, "VALIDATION_ERROR", "The chosen author does not exist.");
  }

  // Determine category_id
  const targetCategoryId = categoryId || category_id || null;
  if (targetCategoryId) {
    const category = await Category.findByPk(targetCategoryId);
    if (!category) {
      throw new BorrowFlowError(422, "VALIDATION_ERROR", "The chosen category does not exist.");
    }
  }

  // Check unique ISBN
  const trimmedIsbn = isbn?.trim() || null;
  if (trimmedIsbn) {
    const existingIsbn = await Book.findOne({ where: { isbn: trimmedIsbn } });
    if (existingIsbn) {
      throw new BorrowFlowError(409, "CONFLICT", "A book with this ISBN already exists.");
    }
  }

  const finalIsbn = trimmedIsbn || `ISBN-${Date.now()}`;
  const finalYear =
    publicationYear !== undefined && publicationYear !== null && publicationYear !== ""
      ? Number(publicationYear)
      : (year_published !== undefined && year_published !== null && year_published !== ""
        ? Number(year_published)
        : null);
  const finalPrice =
    price !== undefined && price !== null && price !== "" ? Number(price) : null;

  let createdBookId = null;

  await withActor(actorUserId, async (transaction) => {
    const newBook = await Book.create(
      {
        title: title.trim(),
        isbn: finalIsbn,
        category_id: targetCategoryId,
        author_id: targetAuthorId,
        publisher: publisher?.trim() || null,
        year_published: finalYear,
        price: finalPrice,
        description: description?.trim() || null,
        language: language?.trim() || null,
        cover_image: coverImageUrl?.trim() || cover_image?.trim() || null,
        status: "Active",
      },
      { transaction },
    );

    createdBookId = newBook.book_id;

    // Optional initial copies creation
    const copyCount = Number(initialCopies);
    if (Number.isInteger(copyCount) && copyCount > 0) {
      for (let i = 1; i <= copyCount; i++) {
        await BookCopy.create(
          {
            book_id: createdBookId,
            accession_no: `ACC-${createdBookId}-${Date.now().toString().slice(-6)}-${i}`,
            condition_status: "Good",
            status: "Available",
          },
          { transaction },
        );
      }
    }
  });

  return await getBookDetails(createdBookId, true);
}

/**
 * Updates an existing book title details or archival status.
 */
export async function updateBookDetails(bookId, payload, actorUserId) {
  const book = await Book.findByPk(bookId);
  if (!book) {
    throw new BorrowFlowError(404, "NOT_FOUND", "We could not find that book.");
  }

  const {
    title,
    isbn,
    description,
    categoryId,
    category_id,
    authorIds,
    authorId,
    author_id,
    publisher,
    publicationYear,
    year_published,
    language,
    price,
    coverImageUrl,
    cover_image,
    isArchived,
    status,
  } = payload;

  const updates = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      throw new BorrowFlowError(400, "VALIDATION_ERROR", "Title cannot be empty.");
    }
    updates.title = title.trim();
  }

  if (isbn !== undefined) {
    const trimmedIsbn = isbn?.trim() || null;
    if (trimmedIsbn) {
      const conflict = await Book.findOne({
        where: { isbn: trimmedIsbn, book_id: { [Op.ne]: bookId } },
      });
      if (conflict) {
        throw new BorrowFlowError(409, "CONFLICT", "A book with this ISBN already exists.");
      }
      updates.isbn = trimmedIsbn;
    }
  }

  // Category
  const newCatId = categoryId !== undefined ? categoryId : category_id;
  if (newCatId !== undefined) {
    if (newCatId) {
      const cat = await Category.findByPk(newCatId);
      if (!cat) throw new BorrowFlowError(422, "VALIDATION_ERROR", "The chosen category does not exist.");
    }
    updates.category_id = newCatId || null;
  }

  // Author
  const targetAuthorId =
    Array.isArray(authorIds) && authorIds.length > 0
      ? authorIds[0]
      : (authorId !== undefined ? authorId : author_id);
  if (targetAuthorId !== undefined) {
    if (!targetAuthorId) {
      throw new BorrowFlowError(422, "VALIDATION_ERROR", "Choose at least one author.");
    }
    const author = await Author.findByPk(targetAuthorId);
    if (!author) throw new BorrowFlowError(422, "VALIDATION_ERROR", "The chosen author does not exist.");
    updates.author_id = targetAuthorId;
  }

  if (publisher !== undefined) updates.publisher = publisher?.trim() || null;
  if (description !== undefined) updates.description = description?.trim() || null;
  if (language !== undefined) updates.language = language?.trim() || null;
  if (coverImageUrl !== undefined || cover_image !== undefined) {
    updates.cover_image =
      coverImageUrl !== undefined ? (coverImageUrl?.trim() || null) : (cover_image?.trim() || null);
  }
  if (publicationYear !== undefined || year_published !== undefined) {
    const yearVal = publicationYear !== undefined ? publicationYear : year_published;
    updates.year_published = yearVal !== null && yearVal !== "" ? Number(yearVal) : null;
  }
  if (price !== undefined) {
    updates.price = price !== null && price !== "" ? Number(price) : null;
  }

  // Archival logic
  const wantsArchived = isArchived === true || status === "Archived";
  const wantsRestore = isArchived === false || status === "Active";

  if (wantsArchived && book.status === "Active") {
    // Check open commitments: active loans, pending/approved borrow requests, waiting reservations
    const activeLoans = await BorrowedBook.count({
      where: { book_id: bookId, status: ["Borrowed", "Reserved"] },
    });
    const openRequests = await BorrowRequest.count({
      where: { book_id: bookId, status: ["Pending", "Approved"] },
    });
    const openReservations = await Reservation.count({
      where: { book_id: bookId, status: ["Waiting", "Offered"] },
    });

    if (activeLoans > 0 || openRequests > 0 || openReservations > 0) {
      throw new BorrowFlowError(
        409,
        "INVALID_STATE",
        "This title has active loans, pickups or reservations. Resolve them before archiving.",
      );
    }
    updates.status = "Archived";
  } else if (wantsRestore && book.status !== "Active") {
    updates.status = "Active";
  }

  await withActor(actorUserId, async (transaction) => {
    await book.update(updates, { transaction });
  });

  return await getBookDetails(bookId, true);
}

/**
 * List all categories sorted alphabetically.
 */
export async function listAllCategories() {
  const categories = await Category.findAll({
    order: [["category_name", "ASC"]],
  });
  return categories.map((c) => ({
    id: String(c.category_id),
    categoryId: c.category_id,
    category_id: c.category_id,
    name: c.category_name,
    category_name: c.category_name,
    description: c.description || null,
  }));
}

/**
 * Add a new category.
 */
export async function createCategory(payload, actorUserId) {
  const name = String(payload?.name ?? payload?.category_name ?? "").trim();
  const description =
    payload?.description !== undefined && payload?.description !== null
      ? String(payload.description).trim()
      : null;

  if (!name) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Category name is required.");
  }
  if (name.length > 100) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Category name must not exceed 100 characters.");
  }

  // Case-insensitive duplicate check
  const existing = await Category.findOne({
    where: sequelize.where(
      sequelize.fn("LOWER", sequelize.col("category_name")),
      name.toLowerCase(),
    ),
  });

  if (existing) {
    throw new BorrowFlowError(409, "CONFLICT", "A category with this name already exists.");
  }

  const category = await withActor(actorUserId, async (transaction) => {
    return Category.create(
      {
        category_name: name,
        description: description || null,
      },
      { transaction },
    );
  });

  return {
    id: String(category.category_id),
    categoryId: category.category_id,
    category_id: category.category_id,
    name: category.category_name,
    category_name: category.category_name,
    description: category.description || null,
    created_at: category.created_at,
  };
}

/**
 * List all authors sorted alphabetically.
 */
export async function listAllAuthors() {
  const authors = await Author.findAll({
    order: [["first_name", "ASC"], ["last_name", "ASC"]],
  });
  return authors.map((a) => {
    const fullName = `${a.first_name || ""} ${a.last_name || ""}`.trim();
    return {
      id: String(a.author_id),
      authorId: a.author_id,
      name: fullName,
      firstName: a.first_name,
      lastName: a.last_name,
    };
  });
}
