// Server/routes/adminRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  createAdminAccount,
  createLibrarianAccount,
} from "../controllers/adminController.js";
import { getAdminDashboard } from "../controllers/adminDashboardController.js";
import {
  getBorrowingReportHandler,
  getFinesReportHandler,
  getOverdueReportHandler,
} from "../controllers/adminReportsController.js";
import { getUsers } from "../controllers/userController.js";
import {
  approveVerificationHandler,
  getStaffQueue,
  getStaffVerificationDetails,
  rejectVerificationHandler,
  streamVerificationDocument,
} from "../controllers/verificationController.js";
import {
  getAuditLogsHandler,
  recordAuditLogHandler,
} from "../controllers/auditLogController.js";
import {
  createAcademicTermHandler,
  getAcademicTermDetailsHandler,
  getAcademicTermsHandler,
  updateAcademicTermHandler,
} from "../controllers/academicTermController.js";

const router = Router();

// Only Admins can access these routes
router.use(authMiddleware, requireRole(["Admin"]));

// Admin dashboard endpoint
router.get("/dashboard", getAdminDashboard);

// Admin report endpoints (optional inclusive YYYY-MM-DD from/to filters)
router.get("/reports/borrowing", getBorrowingReportHandler);
router.get("/reports/overdue", getOverdueReportHandler);
router.get("/reports/fines", getFinesReportHandler);

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

// Audit logs endpoints (Admin)
router.get("/audit-logs", getAuditLogsHandler);
router.post("/audit-logs", recordAuditLogHandler);

// Academic terms management endpoints (Admin only)
router.get("/academic-terms", getAcademicTermsHandler);
router.get("/academic-terms/:id", getAcademicTermDetailsHandler);
router.post("/academic-terms", createAcademicTermHandler);
router.patch("/academic-terms/:id", updateAcademicTermHandler);
router.put("/academic-terms/:id", updateAcademicTermHandler);

export default router;
