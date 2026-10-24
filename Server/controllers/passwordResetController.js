// Server/controllers/passwordResetController.js
import {
  PasswordResetError,
  requestPasswordReset,
  verifyAndResetPassword,
} from "../services/passwordResetService.js";

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
export async function forgotPasswordHandler(req, res, next) {
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    const result = await requestPasswordReset(email.trim());
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}

/**
 * POST /api/auth/reset-password
 * Body: { email, otp, password, confirmPassword }
 */
export async function resetPasswordHandler(req, res, next) {
  try {
    const { email, otp, password, confirmPassword, new_password, newPassword } = req.body ?? {};

    const resolvedPassword = password ?? new_password ?? newPassword;
    const resolvedConfirm  = confirmPassword ?? req.body?.confirm_password;

    if (!email || !otp || !resolvedPassword) {
      return res.status(400).json({ error: "email, otp, and password are required." });
    }
    if (resolvedConfirm !== undefined && resolvedConfirm !== resolvedPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const result = await verifyAndResetPassword(email, otp, resolvedPassword);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}
