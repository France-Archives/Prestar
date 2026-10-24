// Server/routes/penaltyRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import {
  getFinesHandler,
  recordPaymentHandler,
  waiveFineHandler,
  getPaymentsHandler,
  getMyFinesHandler,
} from "../controllers/penaltyController.js";

const router = Router();
const staffOnly = requireRole(["Admin", "Librarian"]);

router.use(authMiddleware);

// Settled payments history for staff Payment Recording screen (Payment History table)
// Placed before /:id routes so "payments" is not parsed as an ID parameter
router.get("/payments", staffOnly, getPaymentsHandler);

// Staff list of fines (defaults to all, or filtered by ?status=Unpaid, etc.)
router.get("/", staffOnly, getFinesHandler);

// Librarian records and approves cash payment in full with receipt number
router.post("/:id/payments", staffOnly, recordPaymentHandler);

// Admin/Librarian waives penalty
router.post("/:id/waive", staffOnly, waiveFineHandler);

// Student gets their own penalties
router.get("/my", getMyFinesHandler);

export default router;
