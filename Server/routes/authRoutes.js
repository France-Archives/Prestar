// Server/routes/authRoutes.js
import { Router } from "express";
import {
  getCurrentUser,
  login,
  logout,
  updateProfile,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  validateLogin,
  validateResendOtp,
  validateSignup,
  validateVerifyOtp,
} from "../validators/authValidator.js";
import {
  resendSignupOtp,
  signup,
  verifySignupOtp,
} from "../controllers/signupController.js";
import {
  loginRateLimiter,
  otpRateLimiter,
  signupRateLimiter,
} from "../middleware/rateLimiters.js";

const router = Router();

router.post("/login", loginRateLimiter, validateLogin, login);
router.post("/signup", signupRateLimiter, validateSignup, signup);
router.post("/register", signupRateLimiter, validateSignup, signup);
router.post("/signup/verify-otp", validateVerifyOtp, verifySignupOtp);
router.post("/signup/resend-otp", otpRateLimiter, validateResendOtp, resendSignupOtp);
router.post("/logout", logout);
router.get("/me", authMiddleware, getCurrentUser);
router.patch("/me", authMiddleware, updateProfile);
router.patch("/profile", authMiddleware, updateProfile);

export default router;