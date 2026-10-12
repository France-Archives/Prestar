// Server/controllers/bookController.js
import {
  getBookDetails,
  getTopBorrowedBooks,
  listBooks,
} from "../services/bookService.js";

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
    const book = await getBookDetails(req.resourceId);
    if (!book) return res.status(404).json({ error: "Active book not found." });
    return res.status(200).json({ book });
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
    return res.status(200).json({ books });
  } catch (error) {
    return next(error);
  }
}

