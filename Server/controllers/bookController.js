// Server/controllers/bookController.js
import {
  createBook,
  createCategory,
  getBookDetails,
  getTopBorrowedBooks,
  listAllAuthors,
  listAllCategories,
  listBooks,
  updateBookDetails,
} from "../services/bookService.js";
import { BorrowFlowError } from "../services/borrowFlowService.js";
import Book from "../models/Book.js";
import { deleteCoverImage, uploadCoverImage } from "../utils/supabaseStorage.js";

function normalizeFormPayload(body) {
  if (!body || typeof body !== "object") return;

  if (typeof body.authorIds === "string") {
    try {
      body.authorIds = JSON.parse(body.authorIds);
    } catch (_) {
      body.authorIds = body.authorIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (isNaN(Number(s)) ? s : Number(s)));
    }
  }

  if (body.initialCopies !== undefined && typeof body.initialCopies === "string") {
    const num = Number(body.initialCopies);
    if (!isNaN(num)) body.initialCopies = num;
  }
}

export async function getBooks(req, res, next) {
  try {
    const result = await listBooks(req.bookQuery);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getBook(req, res, next) {
  try {
    const isStaff = req.user?.role === "Admin" || req.user?.role === "Librarian";
    const book = await getBookDetails(req.resourceId, isStaff);
    if (!book) return res.status(404).json({ error: "Active book not found." });
    return res.status(200).json({
      data: book,
      book,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getTopBooks(req, res, next) {
  try {
    const rawLimit = req.query.limit;
    let topLimit = 10;
    if (rawLimit !== undefined && rawLimit !== "") {
      topLimit = Number(rawLimit);
      if (!Number.isInteger(topLimit) || topLimit < 1 || topLimit > 50) {
        return res.status(400).json({ error: "limit must be an integer from 1 to 50." });
      }
    }
    const books = await getTopBorrowedBooks(topLimit);
    return res.status(200).json({
      data: books,
      books,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createBookHandler(req, res, next) {
  try {
    normalizeFormPayload(req.body);

    if (req.file) {
      const publicUrl = await uploadCoverImage({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        bookId: "new",
      });
      req.body.coverImageUrl = publicUrl;
    }

    const book = await createBook(req.body, req.user?.id);
    return res.status(201).json({
      message: "Book created successfully.",
      data: book,
      book,
    });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    if (error?.status) {
      return res.status(error.status).json({
        code: error.code || "STORAGE_ERROR",
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function updateBookHandler(req, res, next) {
  try {
    normalizeFormPayload(req.body);

    if (req.file) {
      const existing = await Book.findByPk(req.resourceId, { attributes: ["cover_image"] });
      const publicUrl = await uploadCoverImage({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        bookId: req.resourceId,
      });
      req.body.coverImageUrl = publicUrl;

      if (existing?.cover_image && existing.cover_image !== publicUrl) {
        await deleteCoverImage(existing.cover_image);
      }
    }

    const book = await updateBookDetails(req.resourceId, req.body, req.user?.id);
    return res.status(200).json({
      message: "Book updated successfully.",
      data: book,
      book,
    });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    if (error?.status) {
      return res.status(error.status).json({
        code: error.code || "STORAGE_ERROR",
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function getCategoriesHandler(req, res, next) {
  try {
    const categories = await listAllCategories();
    return res.status(200).json({
      data: categories,
      categories,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCategoryHandler(req, res, next) {
  try {
    const payload = req.cleanCategoryBody || req.body;
    const category = await createCategory(payload, req.user?.id);
    return res.status(201).json({
      message: "Category created successfully.",
      data: category,
      category,
    });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        code: "CONFLICT",
        message: "A category with this name already exists.",
        error: "A category with this name already exists.",
      });
    }
    return next(error);
  }
}

export async function getAuthorsHandler(req, res, next) {
  try {
    const authors = await listAllAuthors();
    return res.status(200).json({
      data: authors,
      authors,
    });
  } catch (error) {
    return next(error);
  }
}

