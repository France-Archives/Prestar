// Server/services/passwordResetService.js
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { EmailOtp, User, sequelize } from "../models/index.js";
import { sendPasswordResetEmail } from "./gmailService.js";

const PASSWORD_COST   = 12;
const OTP_HASH_COST   = 10;
const OTP_EXPIRY_MS   = 10 * 60 * 1000;  // 10 minutes
const COOLDOWN_MS     = 2  * 60 * 1000;  // 2 minutes
const MAX_OTP_COUNT   = 3;
const OTP_WINDOW_MS   = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS    = 5;
const RESET_PURPOSE   = "password_reset";

// ─── Error ────────────────────────────────────────────────────────────────────

export class PasswordResetError extends Error {
  constructor(status, message) {
    super(message);
    this.name  = "PasswordResetError";
    this.status = status;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isResetOtp(record) {
  return record?.signup_payload?.purpose === RESET_PURPOSE;
}

function snapshotOtp(record) {
  return {
    otp_hash:       record.otp_hash,
    signup_payload: record.signup_payload,
    expires_at:     record.expires_at,
    attempts:       record.attempts,
    resend_count:   record.resend_count,
    last_sent_at:   record.last_sent_at,
    created_at:     record.created_at,
  };
}

async function restoreAfterFailure(email, newHash, previous) {
  if (previous) {
    await EmailOtp.update(previous, { where: { email, otp_hash: newHash } });
  } else {
    await EmailOtp.destroy({ where: { email, otp_hash: newHash } });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Step 1 — Request a password-reset OTP.
 *
 * Always returns a generic success message (even if the email is not found)
 * to prevent user enumeration.  The OTP is sent only when the account exists.
 */
export async function requestPasswordReset(emailInput, overrides = {}) {
  const sendEmail  = overrides.sendEmail ?? sendPasswordResetEmail;
  const UserModel  = overrides.UserModel ?? User;
  const EmailOtpModel = overrides.EmailOtpModel ?? EmailOtp;
  const now = overrides.now ?? (() => new Date());

  const email = String(emailInput ?? "").trim().toLowerCase();
  const currentTime = now();

  const GENERIC_OK = {
    message: "If that email is registered, a reset code has been sent.",
    email,
    cooldown_seconds: COOLDOWN_MS / 1000,
  };

  // Silently succeed when user does not exist (no enumeration)
  const user = await UserModel.unscoped().findOne({
    where: { email },
    attributes: ["user_id", "email", "first_name", "status"],
  });
  if (!user) return GENERIC_OK;
  if (user.status !== "Active") return GENERIC_OK;

  // Check for an existing reset OTP (or a signup OTP — leave it alone)
  const existingOtp = await EmailOtpModel.findOne({ where: { email } });

  if (existingOtp && !isResetOtp(existingOtp)) {
    // There's a pending signup OTP; don't overwrite it
    return GENERIC_OK;
  }

  if (existingOtp) {
    // Cooldown check
    const elapsed = currentTime.getTime() - new Date(existingOtp.last_sent_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      throw new PasswordResetError(
        429,
        `Please wait ${remainingSeconds} seconds before requesting another code.`,
      );
    }

    // 24-hour window / max-3 limit
    const windowExpired = currentTime.getTime() - new Date(existingOtp.created_at).getTime() >= OTP_WINDOW_MS;
    if (!windowExpired && existingOtp.resend_count >= MAX_OTP_COUNT) {
      throw new PasswordResetError(429, "Maximum of 3 reset codes per 24 hours reached. Please try again later.");
    }
    const nextCount = windowExpired ? 1 : existingOtp.resend_count + 1;

    const rawOtp   = String(crypto.randomInt(100000, 1000000));
    const otpHashed = await bcrypt.hash(rawOtp, OTP_HASH_COST);
    const previous  = snapshotOtp(existingOtp);

    await existingOtp.update({
      otp_hash:     otpHashed,
      expires_at:   new Date(currentTime.getTime() + OTP_EXPIRY_MS),
      attempts:     0,
      resend_count: nextCount,
      last_sent_at: currentTime,
      ...(windowExpired ? { created_at: currentTime } : {}),
    });

    try {
      const result = await sendEmail(email, rawOtp, user.first_name);
      if (result?.sent !== true) throw new Error("Delivery not confirmed.");
    } catch {
      await restoreAfterFailure(email, otpHashed, previous);
      throw new PasswordResetError(503, "Reset email could not be sent. Please try again.");
    }

    return { ...GENERIC_OK, cooldown_seconds: COOLDOWN_MS / 1000 };
  }

  // No existing OTP — create new
  const rawOtp   = String(crypto.randomInt(100000, 1000000));
  const otpHashed = await bcrypt.hash(rawOtp, OTP_HASH_COST);

  await EmailOtpModel.create({
    email,
    otp_hash:       otpHashed,
    signup_payload: { purpose: RESET_PURPOSE },
    expires_at:     new Date(currentTime.getTime() + OTP_EXPIRY_MS),
    attempts:       0,
    resend_count:   1,
    last_sent_at:   currentTime,
    created_at:     currentTime,
  });

  try {
    const result = await sendEmail(email, rawOtp, user.first_name);
    if (result?.sent !== true) throw new Error("Delivery not confirmed.");
  } catch {
    await restoreAfterFailure(email, otpHashed, null);
    throw new PasswordResetError(503, "Reset email could not be sent. Please try again.");
  }

  return GENERIC_OK;
}

/**
 * Step 2 — Verify OTP and set the new password atomically.
 */
export async function verifyAndResetPassword(emailInput, otpInput, newPassword, overrides = {}) {
  const UserModel     = overrides.UserModel     ?? User;
  const EmailOtpModel = overrides.EmailOtpModel ?? EmailOtp;
  const database      = overrides.database      ?? sequelize;
  const now           = overrides.now           ?? (() => new Date());

  const email   = String(emailInput ?? "").trim().toLowerCase();
  const otpCode = String(otpInput   ?? "").trim();

  if (!email || !otpCode || !newPassword) {
    throw new PasswordResetError(400, "Email, OTP, and new password are required.");
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new PasswordResetError(400, "Password must be at least 8 characters.");
  }

  try {
    const outcome = await database.transaction(async (t) => {
      const otpRecord = await EmailOtpModel.findOne({
        where: { email },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!otpRecord || !isResetOtp(otpRecord)) {
        throw new PasswordResetError(404, "No password reset request found for this email.");
      }
      if (now() > new Date(otpRecord.expires_at)) {
        throw new PasswordResetError(400, "The reset code has expired. Please request a new one.");
      }
      if (otpRecord.attempts >= MAX_ATTEMPTS) {
        throw new PasswordResetError(400, "Too many failed attempts. Please request a new reset code.");
      }

      const codeMatches = await bcrypt.compare(otpCode, otpRecord.otp_hash);
      if (!codeMatches) {
        await otpRecord.increment("attempts", { by: 1, transaction: t });
        return { error: new PasswordResetError(400, "Invalid reset code.") };
      }

      // Find the user (with password_hash)
      const user = await UserModel.unscoped().findOne({
        where: { email },
        attributes: ["user_id", "status"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!user || user.status !== "Active") {
        throw new PasswordResetError(404, "Account not found or is inactive.");
      }

      const newHash = await bcrypt.hash(newPassword, PASSWORD_COST);
      await user.update({ password_hash: newHash }, { transaction: t });
      await otpRecord.destroy({ transaction: t });

      return { result: { message: "Password has been reset successfully. You may now log in." } };
    });

    if (outcome.error) throw outcome.error;
    return outcome.result;
  } catch (error) {
    if (error instanceof PasswordResetError) throw error;
    throw error;
  }
}
