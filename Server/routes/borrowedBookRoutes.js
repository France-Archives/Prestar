// Server/routes/borrowedBookRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  getPickupCheckDetails,
  getStaffLoanDetailsHandler,
  listMyLoans,
  listStaffLoans,
  markLoanLostHandler,
  pickupLoan,
  rejectPickupLoan,
  returnLoanHandler,
} from "../controllers/borrowedBookController.js";
import {
  validateBorrowId,
  validateBorrowedBookStaffQuery,
  validateMarkLost,
  validateMyLoansQuery,
  validateReturnLoan,
} from "../validators/borrowedBookValidator.js";
import { validateRejectPickup } from "../validators/borrowRequestValidator.js";
import { handleCreateRenewal } from "../controllers/renewalController.js";
import { validateCreateRenewal } from "../validators/renewalValidator.js";

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

// 10. POST /api/borrowed-books/:id/renew [Student]
router.post(
  "/:id/renew",
  studentsOnly,
  validateBorrowId,
  validateCreateRenewal,
  handleCreateRenewal,
);

// 11. GET /api/borrowed-books/:id [Librarian, Admin] - view specific book/loan details
router.get("/:id", staffOnly, validateBorrowId, getStaffLoanDetailsHandler);

// 12. POST /api/borrowed-books/:id/return [Librarian, Admin] - accept / receive return
router.post(
  "/:id/return",
  staffOnly,
  validateBorrowId,
  validateReturnLoan,
  returnLoanHandler,
);

// 13. POST /api/borrowed-books/:id/mark-lost [Librarian, Admin, Student] - mark/report copy lost & assess penalty
router.post(
  "/:id/mark-lost",
  requireRole(["Admin", "Librarian", "Student"]),
  validateBorrowId,
  validateMarkLost,
  markLoanLostHandler,
);

// 14. POST /api/borrowed-books/:id/report-lost [Student, Librarian, Admin] - alias for self-reporting lost
router.post(
  "/:id/report-lost",
  requireRole(["Admin", "Librarian", "Student"]),
  validateBorrowId,
  validateMarkLost,
  markLoanLostHandler,
);

export default router;
