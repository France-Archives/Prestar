// Server/middleware/rateLimiters.js
import { rateLimit } from "express-rate-limit";

const rateLimitResponse = (_req, res) => {
  res.status(429).json({
    error: "Too many requests. Please try again later.",
  });
};

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitResponse,
});

export const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitResponse,
});

/**
 * Rate limiter for OTP operations in signup: 3 requests max per 2 minutes window.
 */
export const otpRateLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many OTP requests. Maximum of 3 allowed. Please wait 2 minutes.",
    });
  },
});

export const signupOtpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitResponse,
});

/**
 * Rate limiter for standalone OTP request: 20 requests per 15 minutes per IP.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitResponse,
});

/**
 * Rate limiter for standalone OTP verify: 20 requests per 15 minutes per IP.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitResponse,
});
