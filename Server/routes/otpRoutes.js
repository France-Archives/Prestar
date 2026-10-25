// Server/routes/otpRoutes.js
import { Router } from "express";
import { handleOtpRequest, handleOtpVerify } from "../controllers/otpController.js";
import { validateOtpRequest, validateOtpVerify } from "../validators/otpValidator.js";
import { otpRequestLimiter, otpVerifyLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/request", otpRequestLimiter, validateOtpRequest, handleOtpRequest);
router.post("/verify", otpVerifyLimiter, validateOtpVerify, handleOtpVerify);

export default router;
