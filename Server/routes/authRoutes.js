// Server/routes/authRoutes.js
import { Router } from "express";
import {
  getCurrentUser,
  login,
  logout,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateLogin, validateSignup } from "../validators/authValidator.js";
import {
  authorizeSignupProofUpload,
  signup,
  uploadSignupProof,
} from "../controllers/signupController.js";
import { receiveSignupProof } from "../middleware/proofUploadMiddleware.js";
import { loginRateLimiter, proofUploadRateLimiter, signupRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/login", loginRateLimiter, validateLogin, login);
router.post("/signup", signupRateLimiter, validateSignup, signup);
router.post(
  "/signup/:referenceNo/proof",
  proofUploadRateLimiter,
  authorizeSignupProofUpload,
  receiveSignupProof,
  uploadSignupProof,
);
router.post("/logout", logout);
router.get("/me", authMiddleware, getCurrentUser);

export default router;