// Server/routes/adminRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  createAdminAccount,
  createLibrarianAccount,
} from "../controllers/adminController.js";
import { getAdminDashboard } from "../controllers/adminDashboardController.js";
import { getUsers } from "../controllers/userController.js";
import {
  approveVerificationHandler,
  getStaffQueue,
  getStaffVerificationDetails,
  rejectVerificationHandler,
  streamVerificationDocument,
} from "../controllers/verificationController.js";

const router = Router();

// Only Admins can access these routes
router.use(authMiddleware, requireRole(["Admin"]));

// Admin dashboard endpoint
router.get("/dashboard", getAdminDashboard);

// User listing endpoint (sorted by role and status)
router.get("/users", getUsers);

// Librarian creation endpoints
router.post("/librarians", createLibrarianAccount);
router.post("/create-librarian", createLibrarianAccount);

// Admin creation endpoints
router.post("/admins", createAdminAccount);
router.post("/create-admin", createAdminAccount);

// COR Verification management endpoints (Admin)
router.get("/verifications", getStaffQueue);
router.get("/verifications/:id", getStaffVerificationDetails);
router.post("/verifications/:id/approve", approveVerificationHandler);
router.post("/verifications/:id/reject", rejectVerificationHandler);
router.get("/verifications/:id/document", streamVerificationDocument);

export default router;
