// Server/routes/borrowedBookRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  getPickupCheckDetails,
  listMyLoans,
  listStaffLoans,
  pickupLoan,
  rejectPickupLoan,
} from "../controllers/borrowedBookController.js";
import {
  validateBorrowId,
  validateBorrowedBookStaffQuery,
  validateMyLoansQuery,
} from "../validators/borrowedBookValidator.js";
import { validateRejectPickup } from "../validators/borrowRequestValidator.js";

const router = Router();
const staffOnly = requireRole(["Admin", "Librarian"]);
const studentsOnly = requireRole(["Student"]);

router.use(authMiddleware);

// 6. GET /api/borrowed-books/mine?status= [Student]
router.get("/mine", studentsOnly, validateMyLoansQuery, listMyLoans);

// 7. GET /api/borrowed-books?status=Reserved|Borrowed&search= [Librarian, Admin]
router.get("/", staffOnly, validateBorrowedBookStaffQuery, listStaffLoans);

// 8. GET /api/borrowed-books/:id/pickup-check [Librarian, Admin]
router.get("/:id/pickup-check", staffOnly, validateBorrowId, getPickupCheckDetails);

// 9. POST /api/borrowed-books/:id/pickup [Librarian, Admin]
router.post("/:id/pickup", staffOnly, validateBorrowId, pickupLoan);

// 9b. POST /api/borrowed-books/:id/reject-pickup (or /reject) [Librarian, Admin]
router.post(
  "/:id/reject-pickup",
  staffOnly,
  validateBorrowId,
  validateRejectPickup,
  rejectPickupLoan,
);
router.post(
  "/:id/reject",
  staffOnly,
  validateBorrowId,
  validateRejectPickup,
  rejectPickupLoan,
);

export default router;
