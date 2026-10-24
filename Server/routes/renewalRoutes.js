// Server/routes/renewalRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  handleCreateRenewal,
  handleListLoanRenewals,
  handleListMyRenewals,
  handleListStaffRenewals,
} from "../controllers/renewalController.js";
import {
  validateCreateRenewal,
  validateLoanId,
} from "../validators/renewalValidator.js";

const router = Router();
const staffOnly = requireRole(["Admin", "Librarian"]);
const studentsOnly = requireRole(["Student"]);

router.use(authMiddleware);

// GET /api/renewals/mine [Student]
router.get("/mine", studentsOnly, handleListMyRenewals);

// GET /api/renewals [Librarian, Admin]
router.get("/", staffOnly, handleListStaffRenewals);

// GET /api/renewals/loan/:loanId [Student (own loan) or Staff]
router.get("/loan/:loanId", validateLoanId, handleListLoanRenewals);

// POST /api/renewals/loan/:loanId [Student]
router.post(
  "/loan/:loanId",
  studentsOnly,
  validateLoanId,
  validateCreateRenewal,
  handleCreateRenewal,
);

export default router;
