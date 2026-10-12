// Server/routes/bookRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getBook, getBooks, getTopBooks } from "../controllers/bookController.js";
import { validateBookId, validateBookListQuery } from "../validators/bookValidator.js";

const router = Router();
router.use(authMiddleware);
router.get("/", validateBookListQuery, getBooks);
// Top borrowed books — must be before /:id so "top" is not parsed as a book id
router.get("/top", getTopBooks);
router.get("/:id", validateBookId, getBook);

export default router;
