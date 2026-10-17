// Server/routes/verificationRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  approveVerificationHandler,
  getMyVerifications,
  getStaffQueue,
  getTerms,
  rejectVerificationHandler,
  submitVerification,
} from "../controllers/verificationController.js";

const router = Router();

// Public / Authenticated terms list
router.get("/academic-terms", authMiddleware, getTerms);

// Student verification endpoints
router.get("/me/verifications", authMiddleware, getMyVerifications);
router.get("/verifications/me", authMiddleware, getMyVerifications);
router.post("/me/verifications", authMiddleware, submitVerification);
router.post("/verifications", authMiddleware, submitVerification);

// Staff verification endpoints (Librarian, Admin)
router.get(
  "/staff/verifications",
  authMiddleware,
  requireRole(["Librarian", "Admin"]),
  getStaffQueue,
);
router.post(
  "/staff/verifications/:id/approve",
  authMiddleware,
  requireRole(["Librarian", "Admin"]),
  approveVerificationHandler,
);
router.post(
  "/staff/verifications/:id/reject",
  authMiddleware,
  requireRole(["Librarian", "Admin"]),
  rejectVerificationHandler,
);

export default router;
