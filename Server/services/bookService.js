// Server/services/bookService.js
import { Op, QueryTypes } from "sequelize";
import { Author, Book, BookCopy, Category, sequelize } from "../models/index.js";
import { BORROWABLE_COPY_WHERE } from "../config/libraryRules.js";

const bookIncludes = [
  { model: Author, as: "author", attributes: ["author_id", "first_name", "last_name"] },
  { model: Category, as: "category", attributes: ["category_id", "category_name"] },
];

/**
 * Formats a raw Sequelize Book row (with author, category, available_copies)
 * into the shape the frontend BookSummary / BookDetail types expect,
 * providing both camelCase and snake_case keys.
 */
function formatBookRow(row, availableCopiesOverride) {
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
    // IDs
    id: plain.book_id,
    book_id: plain.book_id,
    bookId: plain.book_id,
    // Core fields
    title: plain.title,
    isbn: plain.isbn || null,
    description: plain.description || null,
    publisher: plain.publisher || null,
    // Year: DB column is year_published, frontend expects publicationYear
    publicationYear: plain.year_published || null,
    year_published: plain.year_published || null,
    language: plain.language || null,
    price: plain.price || null,
    status: plain.status,
    // Cover: DB column is cover_image, frontend expects coverImageUrl
    coverImageUrl: plain.cover_image || null,
    cover_image: plain.cover_image || null,
    // Author (single author_id in DB — frontend expects authors[] array)
    author: author
      ? {
          id: author.author_id,
          author_id: author.author_id,
          name: authorName,
          first_name: author.first_name,
          last_name: author.last_name,
          firstName: author.first_name,
          lastName: author.last_name,
        }
      : null,
    authors: author
      ? [{ id: author.author_id, author_id: author.author_id, name: authorName }]
      : [],
    // Category
    category: plain.category
      ? {
          id: plain.category.category_id,
          category_id: plain.category.category_id,
          name: plain.category.category_name,
          category_name: plain.category.category_name,
        }
      : null,
    // Availability (frontend BookAvailability type)
    availability: {
      availableCopies,
      available_copies: availableCopies,
      totalUsableCopies: totalCopies !== null ? totalCopies : availableCopies,
      total_usable_copies: totalCopies !== null ? totalCopies : availableCopies,
    },
    available_copies: availableCopies,
    // Archived flag
    isArchived: plain.status !== "Active",
    is_archived: plain.status !== "Active",
    // Timestamps
    created_at: plain.created_at,
    updated_at: plain.updated_at,
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

  return {
    books: result.rows.map((row) => formatBookRow(row)),
    pagination: {
      page,
      limit,
      total: result.count,
      total_pages: Math.ceil(result.count / limit),
      totalPages: Math.ceil(result.count / limit),
    },
  };
}

export async function getBookDetails(bookId) {
  const book = await Book.findOne({
    where: { book_id: bookId, status: "Active" },
    include: bookIncludes,
  });
  if (!book) return null;

  const availableCopies = await BookCopy.count({
    where: { book_id: bookId, ...BORROWABLE_COPY_WHERE },
  });

  return formatBookRow(book, availableCopies);
}

/**
 * Returns the top N most borrowed books ranked by total borrow count.
 * Counts all borrowed_books rows with status in ('Borrowed', 'Returned')
 * i.e. books that were actually picked up (not just reserved/cancelled).
 *
 * Response shape matches the frontend PopularBook type:
 *   { bookId, title, loanCount }
 * Plus extra fields for richer display (author, cover, category, availability).
 */
export async function getTopBorrowedBooks(topLimit = 10) {
  const rows = await sequelize.query(
    `SELECT
       b.book_id,
       b.title,
       b.cover_image,
       b.isbn,
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
     FROM borrowed_books bb
     JOIN borrow_requests br ON br.request_id = bb.request_id
     JOIN books b ON b.book_id = br.book_id
     LEFT JOIN authors a ON a.author_id = b.author_id
     LEFT JOIN categories c ON c.category_id = b.category_id
     WHERE bb.status IN ('Borrowed', 'Returned')
       AND b.status = 'Active'
     GROUP BY b.book_id, b.title, b.cover_image, b.isbn,
              a.author_id, a.first_name, a.last_name,
              c.category_id, c.category_name
     ORDER BY loan_count DESC, b.title ASC
     LIMIT :topLimit`,
    {
      replacements: { topLimit },
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
      // PopularBook shape (frontend dashboard.ts)
      bookId: row.book_id,
      book_id: row.book_id,
      id: row.book_id,
      title: row.title,
      loanCount: row.loan_count,
      loan_count: row.loan_count,
      // Extra display fields
      isbn: row.isbn || null,
      coverImageUrl: row.cover_image || null,
      cover_image: row.cover_image || null,
      author: authorName
        ? {
            id: row.author_id,
            author_id: row.author_id,
            name: authorName,
            first_name: row.author_first_name,
            last_name: row.author_last_name,
          }
        : null,
      authors: authorName
        ? [{ id: row.author_id, name: authorName }]
        : [],
      category: row.category_id
        ? {
            id: row.category_id,
            category_id: row.category_id,
            name: row.category_name,
            category_name: row.category_name,
          }
        : null,
      availability: {
        availableCopies,
        available_copies: availableCopies,
        totalUsableCopies,
        total_usable_copies: totalUsableCopies,
      },
    };
  });
}

