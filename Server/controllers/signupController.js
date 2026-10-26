// Server/controllers/signupController.js
import {
  createSignup,
  resendOtp,
  SignupError,
  verifyOtp,
} from "../services/signupService.js";

export async function signup(req, res, next) {
  try {
    const result = await createSignup(req.body);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SignupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}

export async function verifySignupOtp(req, res, next) {
  try {
    const { email, otp } = req.body ?? {};
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }
    const result = await verifyOtp(email, otp);
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof SignupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}

export async function resendSignupOtp(req, res, next) {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: "Email is required to resend OTP." });
    }
    const result = await resendOtp(email);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SignupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}