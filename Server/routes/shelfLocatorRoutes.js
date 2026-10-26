// Server/routes/shelfLocatorRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  bulkUpdateShelfHandler,
  getBookCopiesHandler,
  listDistinctShelvesHandler,
  searchBooksHandler,
  searchCopiesHandler,
  updateBookShelfHandler,
  updateCopyShelfHandler,
} from "../controllers/shelfLocatorController.js";
import {
  validateBookIdParam,
  validateBulkShelfLocation,
  validateCopyId,
  validateShelfSearchQuery,
  validateUpdateShelfLocation,
} from "../validators/shelfLocatorValidator.js";

const router = Router();
const staffOnly = requireRole(["Admin", "Librarian"]);

router.use(authMiddleware);

// --- READS (All Authenticated Users) ---

// 1. Search book copies with shelf locations
router.get("/", validateShelfSearchQuery, searchCopiesHandler);
router.get("/copies", validateShelfSearchQuery, searchCopiesHandler);

// 2. Search books with their copies & shelf locations
router.get("/books", validateShelfSearchQuery, searchBooksHandler);

// 3. List distinct shelves with copy counts & stats
router.get("/shelves", listDistinctShelvesHandler);

// 4. Get all copies and shelf locations for a specific book
router.get("/books/:bookId/copies", validateBookIdParam, getBookCopiesHandler);
router.get("/books/:id/copies", validateBookIdParam, getBookCopiesHandler);

// --- WRITES (Librarian & Admin Only) ---

// 5. Update shelf location of a single copy
router.patch("/copies/:copyId", staffOnly, validateCopyId, validateUpdateShelfLocation, updateCopyShelfHandler);
router.put("/copies/:copyId", staffOnly, validateCopyId, validateUpdateShelfLocation, updateCopyShelfHandler);

// 6. Bulk update shelf location for multiple copies or an entire book
router.patch("/bulk", staffOnly, validateBulkShelfLocation, bulkUpdateShelfHandler);
router.post("/bulk", staffOnly, validateBulkShelfLocation, bulkUpdateShelfHandler);

// 7. Update shelf location for all copies of a specific book
router.patch("/books/:bookId", staffOnly, validateBookIdParam, validateUpdateShelfLocation, updateBookShelfHandler);

export default router;
