// Server/services/bookService.js
import { Op } from "sequelize";
import { Author, Book, BookCopy, Category, sequelize } from "../models/index.js";
import { BORROWABLE_COPY_WHERE } from "../config/libraryRules.js";

const bookIncludes = [
  { model: Author, as: "author", attributes: ["author_id", "first_name", "last_name"] },
  { model: Category, as: "category", attributes: ["category_id", "category_name"] },
];

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
    books: result.rows,
    pagination: { page, limit, total: result.count, total_pages: Math.ceil(result.count / limit) },
  };
}

export async function getBookDetails(bookId) {
  const book = await Book.findOne({ where: { book_id: bookId, status: "Active" }, include: bookIncludes });
  if (!book) return null;
  const availableCopies = await BookCopy.count({
    where: { book_id: bookId, ...BORROWABLE_COPY_WHERE },
  });
  return { ...book.get({ plain: true }), available_copies: availableCopies };
}

