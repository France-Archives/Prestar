// Server/routes/verificationRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { uploadCorMiddleware } from "../utils/fileStorage.js";
import {
  approveVerificationHandler,
  getMyVerificationDetails,
  getMyVerifications,
  getStaffQueue,
  getStaffVerificationDetails,
  getTerms,
  rejectVerificationHandler,
  streamVerificationDocument,
  submitVerification,
} from "../controllers/verificationController.js";

const router = Router();

// Middleware to conditionally handle multipart/form-data or json
const uploadHandler = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return uploadCorMiddleware.single("file")(req, res, (err) => {
      if (err) {
        return res.status(err.status || 400).json({ error: err.message });
      }
      next();
    });
  }
  next();
};

// Public / Authenticated terms list
router.get("/academic-terms", authMiddleware, getTerms);

// Student verification endpoints
router.get("/me/verifications", authMiddleware, getMyVerifications);
router.get("/verifications/me", authMiddleware, getMyVerifications);
router.get("/me/verifications/:id", authMiddleware, getMyVerificationDetails);
router.get("/verifications/me/:id", authMiddleware, getMyVerificationDetails);
router.post("/me/verifications", authMiddleware, uploadHandler, submitVerification);
router.post("/verifications", authMiddleware, uploadHandler, submitVerification);
router.get("/me/verifications/:id/document", authMiddleware, streamVerificationDocument);

// Staff verification endpoints (Librarian, Admin)
const staffAuth = [authMiddleware, requireRole(["Librarian", "Admin"])];

// List queue
router.get("/staff/verifications", ...staffAuth, getStaffQueue);
router.get("/librarian/verifications", ...staffAuth, getStaffQueue);
router.get("/admin/verifications", ...staffAuth, getStaffQueue);
router.get("/verifications", ...staffAuth, getStaffQueue);

// Specific verification details
router.get("/staff/verifications/:id", ...staffAuth, getStaffVerificationDetails);
router.get("/librarian/verifications/:id", ...staffAuth, getStaffVerificationDetails);
router.get("/admin/verifications/:id", ...staffAuth, getStaffVerificationDetails);
router.get("/verifications/:id", ...staffAuth, getStaffVerificationDetails);

// Approve verification
router.post("/staff/verifications/:id/approve", ...staffAuth, approveVerificationHandler);
router.post("/librarian/verifications/:id/approve", ...staffAuth, approveVerificationHandler);
router.post("/admin/verifications/:id/approve", ...staffAuth, approveVerificationHandler);
router.post("/verifications/:id/approve", ...staffAuth, approveVerificationHandler);

// Reject verification
router.post("/staff/verifications/:id/reject", ...staffAuth, rejectVerificationHandler);
router.post("/librarian/verifications/:id/reject", ...staffAuth, rejectVerificationHandler);
router.post("/admin/verifications/:id/reject", ...staffAuth, rejectVerificationHandler);
router.post("/verifications/:id/reject", ...staffAuth, rejectVerificationHandler);

// Stream document
router.get("/staff/verifications/:id/document", ...staffAuth, streamVerificationDocument);
router.get("/librarian/verifications/:id/document", ...staffAuth, streamVerificationDocument);
router.get("/admin/verifications/:id/document", ...staffAuth, streamVerificationDocument);
router.get("/verifications/:id/document", ...staffAuth, streamVerificationDocument);

export default router;
