// Server/routes/authRoutes.js
import { Router } from "express";
import {
  getCurrentUser,
  login,
  logout,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateLogin, validateSignup } from "../validators/authValidator.js";
import { signup } from "../controllers/signupController.js";
import { loginRateLimiter, signupRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/login", loginRateLimiter, validateLogin, login);
router.post("/signup", signupRateLimiter, validateSignup, signup);
router.post("/logout", logout);
router.get("/me", authMiddleware, getCurrentUser);

export default router;