// Server/controllers/bookController.js
import { getBookDetails, listBooks } from "../services/bookService.js";

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
