// Server/routes/categoryRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  createCategoryHandler,
  getCategoriesHandler,
  getBooks,
} from "../controllers/bookController.js";
import { validateCreateCategory } from "../validators/categoryValidator.js";
import { validateBookListQuery } from "../validators/bookValidator.js";

const router = Router();
const staffOnly = requireRole(["Admin", "Librarian"]);

router.use(authMiddleware);

// Public dropdown read: list all categories
router.get("/", getCategoriesHandler);

// Staff category creation: add a new category
router.post("/", staffOnly, validateCreateCategory, createCategoryHandler);

// Public catalog read: get books filtered by category ID from route param
router.get("/:id/books", validateBookListQuery, getBooks);

export default router;
