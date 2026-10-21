// Server/routes/verificationRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { uploadCorMiddleware } from "../utils/fileStorage.js";
import {
  approveVerificationHandler,
  getMyVerifications,
  getStaffQueue,
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
router.post("/me/verifications", authMiddleware, uploadHandler, submitVerification);
router.post("/verifications", authMiddleware, uploadHandler, submitVerification);
router.get("/me/verifications/:id/document", authMiddleware, streamVerificationDocument);

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
  "/verifications/:id/approve",
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
router.post(
  "/verifications/:id/reject",
  authMiddleware,
  requireRole(["Librarian", "Admin"]),
  rejectVerificationHandler,
);
router.get(
  "/staff/verifications/:id/document",
  authMiddleware,
  requireRole(["Librarian", "Admin"]),
  streamVerificationDocument,
);

export default router;
