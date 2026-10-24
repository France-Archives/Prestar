// Server/routes/bookRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  createBookHandler,
  getAuthorsHandler,
  getBook,
  getBooks,
  getCategoriesHandler,
  getTopBooks,
  updateBookHandler,
} from "../controllers/bookController.js";
import handleCoverUpload from "../middleware/coverUpload.js";
import {
  validateBookId,
  validateBookListQuery,
  validateCreateBook,
  validateUpdateBook,
} from "../validators/bookValidator.js";

const router = Router();
const staffOnly = requireRole(["Admin", "Librarian"]);

router.use(authMiddleware);

// Public catalog reads (any authenticated user)
router.get("/", validateBookListQuery, getBooks);
// Top borrowed books — must be before /:id so "top" is not parsed as a book id
router.get("/top", getTopBooks);
// Get books by category ID
router.get("/category/:id", validateBookListQuery, getBooks);
router.get("/:id", validateBookId, getBook);

// Staff catalog writes
router.post("/", staffOnly, handleCoverUpload, validateCreateBook, createBookHandler);
router.patch("/:id", staffOnly, validateBookId, handleCoverUpload, validateUpdateBook, updateBookHandler);
router.put("/:id", staffOnly, validateBookId, handleCoverUpload, validateUpdateBook, updateBookHandler);

export default router;
