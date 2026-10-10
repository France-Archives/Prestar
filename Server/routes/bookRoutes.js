// Server/routes/bookRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getBook, getBooks } from "../controllers/bookController.js";
import { validateBookId, validateBookListQuery } from "../validators/bookValidator.js";

const router = Router();
router.use(authMiddleware);
router.get("/", validateBookListQuery, getBooks);
router.get("/:id", validateBookId, getBook);

export default router;
