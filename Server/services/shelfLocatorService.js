// Server/services/shelfLocatorService.js
import { Op, QueryTypes } from "sequelize";
import {
  Author,
  Book,
  BookCopy,
  BorrowedBook,
  Category,
  sequelize,
} from "../models/index.js";
import withActor from "../utils/withActor.js";
import { BorrowFlowError } from "./borrowFlowService.js";

const bookCopyIncludes = [
  {
    model: Book,
    as: "book",
    attributes: [
      "book_id",
      "title",
      "isbn",
      "cover_image",
      "publisher",
      "year_published",
      "status",
      "category_id",
      "author_id",
    ],
    include: [
      {
        model: Author,
        as: "author",
        attributes: ["author_id", "first_name", "last_name"],
      },
      {
        model: Category,
        as: "category",
        attributes: ["category_id", "category_name"],
      },
    ],
  },
  {
    model: BorrowedBook,
    as: "loans",
    required: false,
    where: {
      status: ["Borrowed", "Reserved"],
    },
    attributes: ["borrow_id", "status", "borrow_date", "due_date"],
    limit: 1,
  },
];

/**
 * Formats a BookCopy row with full book details and active loan info.
 */
export function formatCopyItem(copy) {
  const plain = typeof copy.get === "function" ? copy.get({ plain: true }) : copy;
  const book = plain.book;
  const author = book?.author;
  const category = book?.category;
  const loans = plain.loans || [];
  const activeLoan = loans.length > 0 ? loans[0] : null;

  const authorName = author
    ? `${author.first_name || ""} ${author.last_name || ""}`.trim()
    : null;

  return {
    id: String(plain.copy_id),
    copyId: Number(plain.copy_id),
    bookId: Number(plain.book_id),
    accessionNo: plain.accession_no,
    barcode: plain.accession_no,
    shelfLocation: plain.shelf_location || null,
    conditionStatus: plain.condition_status,
    status: plain.status,
    createdAt: plain.created_at ? new Date(plain.created_at).toISOString() : null,
    updatedAt: plain.updated_at ? new Date(plain.updated_at).toISOString() : null,
    book: book
      ? {
          id: String(book.book_id),
          bookId: Number(book.book_id),
          title: book.title,
          isbn: book.isbn,
          coverImageUrl: book.cover_image || null,
          publisher: book.publisher || null,
          publicationYear: book.year_published || null,
          status: book.status,
          category: category
            ? {
                id: String(category.category_id),
                categoryId: Number(category.category_id),
                name: category.category_name,
              }
            : null,
          author: authorName,
          authorDetails: author
            ? {
                id: String(author.author_id),
                authorId: Number(author.author_id),
                name: authorName,
                firstName: author.first_name,
                lastName: author.last_name,
              }
            : null,
        }
      : null,
    activeLoan: activeLoan
      ? {
          id: String(activeLoan.borrow_id),
          borrowId: Number(activeLoan.borrow_id),
          status: activeLoan.status,
          borrowDate: activeLoan.borrow_date,
          dueAt: activeLoan.due_date,
          dueDate: activeLoan.due_date,
        }
      : null,
  };
}

/**
 * Searches and filters book copies with shelf location and full book metadata.
 */
export async function searchShelfCopies({
  search,
  bookId,
  shelfLocation,
  status,
  conditionStatus,
  page = 1,
  limit = 20,
}) {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  const copyWhere = {};

  if (bookId !== undefined && bookId !== null && bookId !== "") {
    copyWhere.book_id = Number(bookId);
  }

  if (status) {
    copyWhere.status = status;
  }

  if (conditionStatus) {
    copyWhere.condition_status = conditionStatus;
  }

  if (shelfLocation !== undefined && shelfLocation !== null && shelfLocation !== "") {
    if (shelfLocation === "unassigned" || shelfLocation === "UNASSIGNED") {
      copyWhere[Op.or] = [
        { shelf_location: null },
        { shelf_location: "" },
      ];
    } else {
      copyWhere.shelf_location = {
        [Op.iLike]: `%${shelfLocation.trim()}%`,
      };
    }
  }

  // If a general search keyword is provided
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    copyWhere[Op.or] = [
      { accession_no: { [Op.iLike]: term } },
      { shelf_location: { [Op.iLike]: term } },
      { "$book.title$": { [Op.iLike]: term } },
      { "$book.isbn$": { [Op.iLike]: term } },
      { "$book.publisher$": { [Op.iLike]: term } },
      { "$book.author.first_name$": { [Op.iLike]: term } },
      { "$book.author.last_name$": { [Op.iLike]: term } },
    ];
  }

  const result = await BookCopy.findAndCountAll({
    where: copyWhere,
    include: bookCopyIncludes,
    order: [
      [{ model: Book, as: "book" }, "title", "ASC"],
      ["shelf_location", "ASC"],
      ["accession_no", "ASC"],
    ],
    limit: parsedLimit,
    offset,
    distinct: true,
    subQuery: false,
  });

  const formattedCopies = result.rows.map(formatCopyItem);

  return {
    copies: formattedCopies,
    data: formattedCopies,
    pagination: {
      total: result.count,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(result.count / parsedLimit),
    },
    meta: {
      total: result.count,
      page: parsedPage,
      pageSize: parsedLimit,
    },
  };
}

/**
 * Searches books and groups their copies with shelf locations.
 */
export async function getBooksWithShelfCopies({
  search,
  categoryId,
  shelfLocation,
  page = 1,
  limit = 20,
}) {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  const bookWhere = { status: "Active" };
  if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
    bookWhere.category_id = Number(categoryId);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    bookWhere[Op.or] = [
      { title: { [Op.iLike]: term } },
      { isbn: { [Op.iLike]: term } },
      { publisher: { [Op.iLike]: term } },
      { "$author.first_name$": { [Op.iLike]: term } },
      { "$author.last_name$": { [Op.iLike]: term } },
      { "$copies.accession_no$": { [Op.iLike]: term } },
      { "$copies.shelf_location$": { [Op.iLike]: term } },
    ];
  }

  const copyIncludeWhere = {};
  if (shelfLocation && shelfLocation.trim()) {
    if (shelfLocation === "unassigned" || shelfLocation === "UNASSIGNED") {
      copyIncludeWhere[Op.or] = [
        { shelf_location: null },
        { shelf_location: "" },
      ];
    } else {
      copyIncludeWhere.shelf_location = {
        [Op.iLike]: `%${shelfLocation.trim()}%`,
      };
    }
  }

  const result = await Book.findAndCountAll({
    where: bookWhere,
    include: [
      {
        model: Author,
        as: "author",
        attributes: ["author_id", "first_name", "last_name"],
      },
      {
        model: Category,
        as: "category",
        attributes: ["category_id", "category_name"],
      },
      {
        model: BookCopy,
        as: "copies",
        where: Object.keys(copyIncludeWhere).length > 0 ? copyIncludeWhere : undefined,
        required: Object.keys(copyIncludeWhere).length > 0,
        attributes: [
          "copy_id",
          "accession_no",
          "shelf_location",
          "condition_status",
          "status",
        ],
      },
    ],
    order: [
      ["title", "ASC"],
      [{ model: BookCopy, as: "copies" }, "accession_no", "ASC"],
    ],
    limit: parsedLimit,
    offset,
    distinct: true,
    subQuery: false,
  });

  const formattedBooks = result.rows.map((row) => {
    const plain = row.get ? row.get({ plain: true }) : row;
    const authorName = plain.author
      ? `${plain.author.first_name || ""} ${plain.author.last_name || ""}`.trim()
      : null;

    const copies = (plain.copies || []).map((c) => ({
      id: String(c.copy_id),
      copyId: Number(c.copy_id),
      accessionNo: c.accession_no,
      shelfLocation: c.shelf_location || null,
      conditionStatus: c.condition_status,
      status: c.status,
    }));

    // Find distinct shelf locations among this book's copies
    const distinctShelves = Array.from(
      new Set(copies.map((c) => c.shelfLocation).filter(Boolean)),
    );

    return {
      id: String(plain.book_id),
      bookId: Number(plain.book_id),
      title: plain.title,
      isbn: plain.isbn,
      coverImageUrl: plain.cover_image || null,
      publisher: plain.publisher || null,
      publicationYear: plain.year_published || null,
      category: plain.category
        ? {
            id: String(plain.category.category_id),
            categoryId: Number(plain.category.category_id),
            name: plain.category.category_name,
          }
        : null,
      author: authorName,
      copiesCount: copies.length,
      availableCopiesCount: copies.filter((c) => c.status === "Available" && c.conditionStatus === "Good").length,
      shelfLocations: distinctShelves,
      copies,
    };
  });

  return {
    books: formattedBooks,
    data: formattedBooks,
    pagination: {
      total: result.count,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(result.count / parsedLimit),
    },
    meta: {
      total: result.count,
      page: parsedPage,
      pageSize: parsedLimit,
    },
  };
}

/**
 * Returns a list of distinct shelf locations in the library with statistics.
 */
export async function listDistinctShelves() {
  const shelfStats = await sequelize.query(
    `SELECT 
       bc.shelf_location AS shelf_location,
       COUNT(bc.copy_id)::int AS total_copies,
       COUNT(CASE WHEN bc.status = 'Available' AND bc.condition_status = 'Good' THEN 1 END)::int AS available_copies,
       COUNT(DISTINCT bc.book_id)::int AS distinct_titles
     FROM book_copies bc
     WHERE bc.shelf_location IS NOT NULL AND bc.shelf_location <> ''
     GROUP BY bc.shelf_location
     ORDER BY bc.shelf_location ASC`,
    { type: QueryTypes.SELECT },
  );

  const unassigned = await sequelize.query(
    `SELECT 
       COUNT(bc.copy_id)::int AS total_copies,
       COUNT(CASE WHEN bc.status = 'Available' AND bc.condition_status = 'Good' THEN 1 END)::int AS available_copies,
       COUNT(DISTINCT bc.book_id)::int AS distinct_titles
     FROM book_copies bc
     WHERE bc.shelf_location IS NULL OR bc.shelf_location = ''`,
    { type: QueryTypes.SELECT },
  );

  const unassignedStat = unassigned[0] || { total_copies: 0, available_copies: 0, distinct_titles: 0 };

  const shelves = shelfStats.map((row) => ({
    shelfLocation: row.shelf_location,
    name: row.shelf_location,
    totalCopies: Number(row.total_copies || 0),
    availableCopies: Number(row.available_copies || 0),
    distinctTitles: Number(row.distinct_titles || 0),
  }));

  return {
    shelves,
    data: shelves,
    totalShelves: shelves.length,
    unassigned: {
      shelfLocation: null,
      name: "Unassigned",
      totalCopies: Number(unassignedStat.total_copies || 0),
      availableCopies: Number(unassignedStat.available_copies || 0),
      distinctTitles: Number(unassignedStat.distinct_titles || 0),
    },
  };
}

/**
 * Gets all copies and shelf locations for a specific book.
 */
export async function getBookCopies(bookId) {
  const id = Number(bookId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "A valid book ID is required.");
  }

  const book = await Book.findByPk(id, {
    include: [
      { model: Author, as: "author", attributes: ["author_id", "first_name", "last_name"] },
      { model: Category, as: "category", attributes: ["category_id", "category_name"] },
    ],
  });

  if (!book) {
    throw new BorrowFlowError(404, "NOT_FOUND", "Book not found.");
  }

  const copies = await BookCopy.findAll({
    where: { book_id: id },
    include: [
      {
        model: BorrowedBook,
        as: "loans",
        required: false,
        where: { status: ["Borrowed", "Reserved"] },
        attributes: ["borrow_id", "status", "borrow_date", "due_date"],
        limit: 1,
      },
    ],
    order: [["accession_no", "ASC"], ["copy_id", "ASC"]],
  });

  const formattedCopies = copies.map((copy) => {
    const plain = copy.get ? copy.get({ plain: true }) : copy;
    const loan = plain.loans && plain.loans.length > 0 ? plain.loans[0] : null;

    return {
      id: String(plain.copy_id),
      copyId: Number(plain.copy_id),
      bookId: Number(plain.book_id),
      accessionNo: plain.accession_no,
      barcode: plain.accession_no,
      shelfLocation: plain.shelf_location || null,
      conditionStatus: plain.condition_status,
      status: plain.status,
      activeLoan: loan
        ? {
            id: String(loan.borrow_id),
            borrowId: Number(loan.borrow_id),
            status: loan.status,
            borrowDate: loan.borrow_date,
            dueAt: loan.due_date,
          }
        : null,
    };
  });

  const authorName = book.author
    ? `${book.author.first_name || ""} ${book.author.last_name || ""}`.trim()
    : null;

  return {
    book: {
      id: String(book.book_id),
      bookId: Number(book.book_id),
      title: book.title,
      isbn: book.isbn,
      coverImageUrl: book.cover_image || null,
      publisher: book.publisher || null,
      category: book.category ? book.category.category_name : null,
      author: authorName,
    },
    copies: formattedCopies,
    totalCopies: formattedCopies.length,
    availableCopies: formattedCopies.filter((c) => c.status === "Available" && c.conditionStatus === "Good").length,
  };
}

/**
 * Updates the shelf location of a single book copy.
 * Audited via withActor(actorUserId).
 */
export async function updateCopyShelfLocation(copyId, shelfLocation, actorUserId) {
  const id = Number(copyId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "A valid copy ID is required.");
  }

  const copy = await BookCopy.findByPk(id, {
    include: bookCopyIncludes,
  });

  if (!copy) {
    throw new BorrowFlowError(404, "NOT_FOUND", "Book copy not found.");
  }

  const cleanLocation =
    typeof shelfLocation === "string" ? shelfLocation.trim() || null : null;

  await withActor(actorUserId, async (transaction) => {
    await copy.update(
      { shelf_location: cleanLocation },
      { transaction },
    );
  });

  await copy.reload({ include: bookCopyIncludes });

  return {
    message: "Shelf location updated successfully.",
    copy: formatCopyItem(copy),
  };
}

/**
 * Bulk updates shelf location for a list of copy IDs or all copies of a book.
 * Audited via withActor(actorUserId).
 */
export async function bulkUpdateShelfLocation({ copyIds, bookId, shelfLocation }, actorUserId) {
  const cleanLocation =
    typeof shelfLocation === "string" ? shelfLocation.trim() || null : null;

  let whereClause = null;

  if (Array.isArray(copyIds) && copyIds.length > 0) {
    const validIds = copyIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (validIds.length === 0) {
      throw new BorrowFlowError(400, "VALIDATION_ERROR", "No valid copy IDs provided.");
    }
    whereClause = { copy_id: { [Op.in]: validIds } };
  } else if (bookId !== undefined && bookId !== null) {
    const bId = Number(bookId);
    if (!Number.isInteger(bId) || bId <= 0) {
      throw new BorrowFlowError(400, "VALIDATION_ERROR", "A valid book ID is required.");
    }
    whereClause = { book_id: bId };
  } else {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Must provide either copyIds or bookId.");
  }

  let updatedCount = 0;
  await withActor(actorUserId, async (transaction) => {
    const [count] = await BookCopy.update(
      { shelf_location: cleanLocation },
      { where: whereClause, transaction },
    );
    updatedCount = count;
  });

  return {
    message: `Updated shelf location for ${updatedCount} book copy/copies.`,
    updatedCount,
    shelfLocation: cleanLocation,
  };
}
