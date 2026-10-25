// Server/services/interestService.js
import { Op } from "sequelize";
import {
  Author,
  Book,
  Category,
  UserCategoryPreference,
  sequelize,
} from "../models/index.js";
import { BORROWABLE_COPY_WHERE } from "../config/libraryRules.js";
import { formatBookRow } from "./bookService.js";
import withActor from "../utils/withActor.js";

export class InterestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "InterestError";
    this.status = status;
    this.code = code;
  }
}

/**
 * List all available interests (all categories from the catalog).
 */
export async function listAvailableInterests() {
  const categories = await Category.findAll({
    order: [["category_name", "ASC"]],
  });

  return categories.map((c) => ({
    id: String(c.category_id),
    categoryId: c.category_id,
    name: c.category_name,
    categoryName: c.category_name,
    description: c.description || null,
  }));
}

/**
 * Get the current student's selected reading interests.
 */
export async function getUserInterests(userId) {
  if (!userId) return [];

  const prefs = await UserCategoryPreference.findAll({
    where: { user_id: userId },
    include: [{ model: Category, as: "category" }],
    order: [["preference_id", "ASC"]],
  });

  return prefs
    .filter((p) => p.category)
    .map((p) => ({
      id: String(p.category_id),
      categoryId: p.category_id,
      name: p.category.category_name,
      categoryName: p.category.category_name,
      description: p.category.description || null,
    }));
}

/**
 * Update the user's selected interests.
 * Ensures the user chooses at least 1 interest and that all chosen categories exist.
 */
export async function setUserInterests(userId, rawIds) {
  if (!userId) {
    throw new InterestError(401, "UNAUTHENTICATED", "Authentication required.");
  }

  if (!Array.isArray(rawIds)) {
    throw new InterestError(400, "VALIDATION_ERROR", "interestIds must be an array of category IDs.");
  }

  // Normalize IDs and remove duplicates
  const parsedIds = [
    ...new Set(
      rawIds
        .map((id) => (typeof id === "string" ? Number(id.trim()) : Number(id)))
        .filter((num) => Number.isSafeInteger(num) && num > 0),
    ),
  ];

  // Must choose at least 1 interest
  if (parsedIds.length < 1) {
    throw new InterestError(400, "VALIDATION_ERROR", "You must choose at least 1 interest.");
  }

  // Verify that all chosen categories exist in the database
  const matchingCategories = await Category.findAll({
    where: { category_id: { [Op.in]: parsedIds } },
    attributes: ["category_id", "category_name"],
  });

  if (matchingCategories.length !== parsedIds.length) {
    throw new InterestError(422, "VALIDATION_ERROR", "One or more of the chosen interests do not exist.");
  }

  // Replace preferences atomically in a transaction
  await withActor(userId, async (transaction) => {
    await UserCategoryPreference.destroy({
      where: { user_id: userId },
      transaction,
    });

    const newRows = parsedIds.map((catId) => ({
      user_id: userId,
      category_id: catId,
    }));

    await UserCategoryPreference.bulkCreate(newRows, { transaction });
  });

  return await getUserInterests(userId);
}

/**
 * Get recommended books for a student based on their chosen category interests.
 */
export async function getRecommendedBooksForUser(userId, limit = 8) {
  if (!userId) return [];

  const interests = await getUserInterests(userId);
  const categoryIds = interests.map((i) => i.categoryId);

  if (categoryIds.length === 0) {
    return [];
  }

  const books = await Book.findAll({
    where: {
      status: "Active",
      category_id: { [Op.in]: categoryIds },
    },
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
    include: [
      { model: Author, as: "author", attributes: ["author_id", "first_name", "last_name"] },
      { model: Category, as: "category", attributes: ["category_id", "category_name"] },
    ],
    order: [["updated_at", "DESC"], ["title", "ASC"]],
    limit: Math.max(1, Math.min(limit, 50)),
  });

  return books.map((row) => formatBookRow(row));
}
