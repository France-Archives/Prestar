// Server/services/signupService.js
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { EmailOtp, sequelize, Student, User } from "../models/index.js";
import { sendOtpEmail } from "./gmailService.js";

const PASSWORD_COST = 12;
const OTP_HASH_COST = 10;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes (120 seconds)
const MAX_OTP_COUNT = 3;

export class SignupError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "SignupError";
    this.status = status;
  }
}

/**
 * Initiates user signup: validates uniqueness, applies cooldown & 3-OTP limit,
 * generates a 6-digit OTP, and sends it via Gmail API.
 */
export async function createSignup(input) {
  const email = String(input.email ?? "").trim().toLowerCase();
  const studentNumber = String(input.student_number ?? input.studentNumber ?? input.student_id ?? "").trim();
  const firstName = String(input.first_name ?? input.firstName ?? "").trim();
  const lastName = String(input.last_name ?? input.lastName ?? "").trim();
  const course = input.course ?? input.program ?? input.submitted_course
    ? String(input.course ?? input.program ?? input.submitted_course).trim()
    : null;
  const rawYear = input.year_level ?? input.yearLevel ?? input.submitted_year_level;
  const yearLevel = rawYear !== undefined && rawYear !== null && rawYear !== "" ? Number(rawYear) : null;
  const studentType = input.student_type ?? input.studentType
    ? String(input.student_type ?? input.studentType).trim()
    : "Regular";

  const wmsuEmailPattern = /^[^\s@]+@wmsu\.edu\.ph$/i;
  if (!wmsuEmailPattern.test(email)) {
    throw new SignupError(400, "Email must be a valid WMSU email address ending with @wmsu.edu.ph.");
  }

  // 1. Check if user already exists
  const existingUser = await User.findOne({
    where: { email },
    attributes: ["user_id"],
  });
  if (existingUser) {
    throw new SignupError(409, "An account with that email already exists.");
  }

  const existingStudent = await Student.findOne({
    where: { student_number: studentNumber },
    attributes: ["user_id"],
  });
  if (existingStudent) {
    throw new SignupError(409, "An account with that student number already exists.");
  }

  // 2. Check existing OTP record for rate limiting & cooldown
  const existingOtp = await EmailOtp.findOne({ where: { email } });
  let nextResendCount = 1;

  if (existingOtp) {
    const elapsed = Date.now() - new Date(existingOtp.last_sent_at).getTime();

    // 2-minute cooldown between OTP sends
    if (elapsed < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      throw new SignupError(
        429,
        `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
      );
    }

    // Limit to only 3 OTPs
    if (existingOtp.resend_count >= MAX_OTP_COUNT) {
      // If 2 minutes have passed after the 3rd attempt, reset counter
      if (elapsed >= COOLDOWN_MS) {
        nextResendCount = 1;
      } else {
        throw new SignupError(
          429,
          `Maximum of ${MAX_OTP_COUNT} OTP requests reached. Please wait 2 minutes before trying again.`,
        );
      }
    } else {
      nextResendCount = existingOtp.resend_count + 1;
    }
  }

  // 3. Generate 6-digit OTP
  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHashed = await bcrypt.hash(rawOtp, OTP_HASH_COST);
  const passwordHashed = await bcrypt.hash(input.password, PASSWORD_COST);

  const signupPayload = {
    first_name: firstName,
    last_name: lastName,
    email,
    password_hash: passwordHashed,
    student_number: studentNumber,
    college: input.college ? String(input.college).trim() : null,
    course,
    year_level: yearLevel,
    student_type: studentType,
  };

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  const now = new Date();

  if (existingOtp) {
    await existingOtp.update({
      otp_hash: otpHashed,
      signup_payload: signupPayload,
      expires_at: expiresAt,
      attempts: 0,
      resend_count: nextResendCount,
      last_sent_at: now,
    });
  } else {
    await EmailOtp.create({
      email,
      otp_hash: otpHashed,
      signup_payload: signupPayload,
      expires_at: expiresAt,
      attempts: 0,
      resend_count: 1,
      last_sent_at: now,
    });
  }

  // 4. Send email via Gmail API
  await sendOtpEmail(email, rawOtp, firstName);

  return {
    message: "OTP sent to your email. Please verify to complete your registration.",
    email,
    cooldownSeconds: 120,
    cooldown_seconds: 120,
    remainingOtps: Math.max(0, MAX_OTP_COUNT - nextResendCount),
    remaining_otps: Math.max(0, MAX_OTP_COUNT - nextResendCount),
  };
}

/**
 * Resends OTP with 2-minute cooldown and max 3 attempts constraint.
 */
export async function resendOtp(emailInput) {
  const email = String(emailInput ?? "").trim().toLowerCase();
  const existingOtp = await EmailOtp.findOne({ where: { email } });

  if (!existingOtp) {
    throw new SignupError(404, "No pending registration found for this email. Please register first.");
  }

  const elapsed = Date.now() - new Date(existingOtp.last_sent_at).getTime();

  // 2-minute cooldown check
  if (elapsed < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    throw new SignupError(
      429,
      `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
    );
  }

  let nextResendCount = existingOtp.resend_count + 1;
  if (existingOtp.resend_count >= MAX_OTP_COUNT) {
    if (elapsed >= COOLDOWN_MS) {
      nextResendCount = 1;
    } else {
      throw new SignupError(
        429,
        `Maximum of ${MAX_OTP_COUNT} OTP requests reached. Please wait 2 minutes before requesting again.`,
      );
    }
  }

  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHashed = await bcrypt.hash(rawOtp, OTP_HASH_COST);

  console.log(`🔄 [RESEND OTP] New code for ${email}: ${rawOtp}`);

  const [rowsUpdated] = await EmailOtp.update(
    {
      otp_hash: otpHashed,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MS),
      attempts: 0,
      resend_count: nextResendCount,
      last_sent_at: new Date(),
    },
    { where: { email } },
  );

  console.log(`✅ [RESEND OTP] Rows updated in DB: ${rowsUpdated}`);

  await sendOtpEmail(email, rawOtp, existingOtp.signup_payload?.first_name ?? "");

  return {
    message: "A new OTP has been sent to your email.",
    email,
    cooldown_seconds: 120,
    remaining_otps: Math.max(0, MAX_OTP_COUNT - nextResendCount),
  };
}

/**
 * Verifies OTP code and creates the active User and Student records.
 */
export async function verifyOtp(emailInput, otpInput) {
  const email = String(emailInput ?? "").trim().toLowerCase();
  const otpCode = String(otpInput ?? "").trim();

  const otpRecord = await EmailOtp.findOne({ where: { email } });
  if (!otpRecord) {
    throw new SignupError(404, "No pending registration found for this email.");
  }

  // Expiry check
  if (new Date() > new Date(otpRecord.expires_at)) {
    throw new SignupError(400, "The OTP has expired. Please request a new one.");
  }

  // Brute-force protection: max 5 failed attempts per OTP code
  if (otpRecord.attempts >= 5) {
    throw new SignupError(400, "Too many failed attempts. Please request a new OTP.");
  }

  const isValid = await bcrypt.compare(otpCode, otpRecord.otp_hash);
  if (!isValid) {
    await otpRecord.increment("attempts");
    throw new SignupError(400, "Invalid OTP code.");
  }

  const payload = otpRecord.signup_payload;

  return sequelize.transaction(async (transaction) => {
    // Final check for existing user
    const existing = await User.findOne({
      where: { email: payload.email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) {
      throw new SignupError(409, "An account with this email has already been registered.");
    }

    // Create User record
    const user = await User.create(
      {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        password_hash: payload.password_hash,
        role: "Student",
        status: "Active",
        email_verified: true,
      },
      { transaction },
    );

    // Create Student record linked to user_id
    const student = await Student.create(
      {
        user_id: user.id,
        student_number: payload.student_number,
        college: payload.college,
        course: payload.course,
        year_level: payload.year_level,
        student_type: payload.student_type || "Regular",
      },
      { transaction },
    );

    // Remove OTP record
    await otpRecord.destroy({ transaction });

    return {
      message: "Registration successful. You may now log in.",
    };
  });
}