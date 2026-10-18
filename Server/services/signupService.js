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
const OTP_WINDOW_MS = 24 * 60 * 60 * 1000;

function deps(overrides = {}) {
  return {
    UserModel: overrides.UserModel ?? User,
    StudentModel: overrides.StudentModel ?? Student,
    EmailOtpModel: overrides.EmailOtpModel ?? EmailOtp,
    database: overrides.database ?? sequelize,
    sendEmail: overrides.sendEmail ?? sendOtpEmail,
    now: overrides.now ?? (() => new Date()),
  };
}

function isSignupOtp(record) {
  return typeof record?.signup_payload?.email === "string"
    && typeof record.signup_payload.password_hash === "string";
}

function nextSendCount(record, now) {
  const windowExpired = now.getTime() - new Date(record.created_at).getTime() >= OTP_WINDOW_MS;
  if (!windowExpired && record.resend_count >= MAX_OTP_COUNT) {
    throw new SignupError(429, "Maximum of 3 OTP emails per 24 hours reached. Please try again later.");
  }
  return { count: windowExpired ? 1 : record.resend_count + 1, windowExpired };
}

function snapshotOtp(record) {
  return {
    otp_hash: record.otp_hash,
    signup_payload: record.signup_payload,
    expires_at: record.expires_at,
    attempts: record.attempts,
    resend_count: record.resend_count,
    last_sent_at: record.last_sent_at,
    created_at: record.created_at,
  };
}

async function deliverOtp(sendEmail, email, code, firstName) {
  try {
    const result = await sendEmail(email, code, firstName);
    if (result?.sent !== true) throw new Error("Email sender did not confirm delivery.");
  } catch {
    throw new SignupError(503, "Verification email could not be sent. Please try again later.");
  }
}

async function restoreOtpAfterDeliveryFailure(EmailOtpModel, email, newHash, previous) {
  if (previous) {
    await EmailOtpModel.update(previous, { where: { email, otp_hash: newHash } });
  } else {
    await EmailOtpModel.destroy({ where: { email, otp_hash: newHash } });
  }
}

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
export async function createSignup(input, overrides = {}) {
  const { UserModel, StudentModel, EmailOtpModel, sendEmail, now } = deps(overrides);
  const currentTime = now();
  if (input.termsAccepted !== true || input.privacyPolicyAccepted !== true) {
    throw new SignupError(400, "You must accept the Terms and Privacy Policy.");
  }
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
  const existingUser = await UserModel.findOne({
    where: { email },
    attributes: ["user_id"],
  });
  if (existingUser) {
    throw new SignupError(409, "An account with that email already exists.");
  }

  const existingStudent = await StudentModel.findOne({
    where: { student_number: studentNumber },
    attributes: ["user_id"],
  });
  if (existingStudent) {
    throw new SignupError(409, "An account with that student number already exists.");
  }

  // 2. Check existing OTP record for rate limiting & cooldown
  const existingOtp = await EmailOtpModel.findOne({ where: { email } });
  let nextResendCount = 1;
  let windowExpired = false;

  if (existingOtp) {
    if (!isSignupOtp(existingOtp)) {
      throw new SignupError(409, "Unable to start signup with this email.");
    }
    const elapsed = currentTime.getTime() - new Date(existingOtp.last_sent_at).getTime();

    // 2-minute cooldown between OTP sends
    if (elapsed < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      throw new SignupError(
        429,
        `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
      );
    }

    ({ count: nextResendCount, windowExpired } = nextSendCount(existingOtp, currentTime));
  }

  // 3. Generate 6-digit OTP
  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHashed = await bcrypt.hash(rawOtp, OTP_HASH_COST);
  const passwordHashed = await bcrypt.hash(input.password, PASSWORD_COST);

  const signupPayload = {
    first_name: firstName,
    middle_name: (input.middle_name ?? input.middleName)?.trim() || null,
    last_name: lastName,
    suffix: input.suffix?.trim() || null,
    email,
    password_hash: passwordHashed,
    student_number: studentNumber,
    college: input.college ? String(input.college).trim() : null,
    course,
    year_level: yearLevel,
    student_type: studentType,
    terms_accepted_at: currentTime.toISOString(),
    privacy_policy_accepted_at: currentTime.toISOString(),
  };

  const expiresAt = new Date(currentTime.getTime() + OTP_EXPIRY_MS);
  const previousOtp = existingOtp ? snapshotOtp(existingOtp) : null;

  if (existingOtp) {
    await existingOtp.update({
      otp_hash: otpHashed,
      signup_payload: signupPayload,
      expires_at: expiresAt,
      attempts: 0,
      resend_count: nextResendCount,
      last_sent_at: currentTime,
      ...(windowExpired ? { created_at: currentTime } : {}),
    });
  } else {
    await EmailOtpModel.create({
      email,
      otp_hash: otpHashed,
      signup_payload: signupPayload,
      expires_at: expiresAt,
      attempts: 0,
      resend_count: 1,
      last_sent_at: currentTime,
      created_at: currentTime,
    });
  }

  try {
    await deliverOtp(sendEmail, email, rawOtp, firstName);
  } catch (error) {
    await restoreOtpAfterDeliveryFailure(EmailOtpModel, email, otpHashed, previousOtp);
    throw error;
  }

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
export async function resendOtp(emailInput, overrides = {}) {
  const { EmailOtpModel, sendEmail, now } = deps(overrides);
  const email = String(emailInput ?? "").trim().toLowerCase();
  const existingOtp = await EmailOtpModel.findOne({ where: { email } });

  if (!existingOtp || !isSignupOtp(existingOtp)) {
    return {
      message: "If a pending registration exists, a verification email will be sent.",
      email,
      cooldown_seconds: 120,
      remaining_otps: 0,
    };
  }

  const currentTime = now();
  const elapsed = currentTime.getTime() - new Date(existingOtp.last_sent_at).getTime();

  // 2-minute cooldown check
  if (elapsed < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    throw new SignupError(
      429,
      `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
    );
  }

  const { count: nextResendCount, windowExpired } = nextSendCount(existingOtp, currentTime);

  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHashed = await bcrypt.hash(rawOtp, OTP_HASH_COST);
  const previousOtp = snapshotOtp(existingOtp);

  const [rowsUpdated] = await EmailOtpModel.update({
      otp_hash: otpHashed,
      expires_at: new Date(currentTime.getTime() + OTP_EXPIRY_MS),
      attempts: 0,
      resend_count: nextResendCount,
      last_sent_at: currentTime,
      ...(windowExpired ? { created_at: currentTime } : {}),
    }, { where: { email, otp_hash: existingOtp.otp_hash } });
  if (rowsUpdated !== 1) {
    throw new SignupError(409, "The verification request changed. Please try again.");
  }

  try {
    await deliverOtp(sendEmail, email, rawOtp, existingOtp.signup_payload?.first_name ?? "");
  } catch (error) {
    await restoreOtpAfterDeliveryFailure(EmailOtpModel, email, otpHashed, previousOtp);
    throw error;
  }

  return {
    message: "A new OTP has been sent to your email.",
    email,
    cooldown_seconds: 120,
    remaining_otps: Math.max(0, MAX_OTP_COUNT - nextResendCount),
  };
}

export const signupOtpPolicy = {
  cooldownMs: COOLDOWN_MS,
  expiryMs: OTP_EXPIRY_MS,
  maxAttempts: 5,
  maxEmailsPerWindow: MAX_OTP_COUNT,
  windowMs: OTP_WINDOW_MS,
};

/**
 * Verifies OTP code and creates the active User and Student records.
 */
export async function verifyOtp(emailInput, otpInput, overrides = {}) {
  const { UserModel, StudentModel, EmailOtpModel, database, now } = deps(overrides);
  const email = String(emailInput ?? "").trim().toLowerCase();
  const otpCode = String(otpInput ?? "").trim();

  try {
    const outcome = await database.transaction(async (transaction) => {
      const otpRecord = await EmailOtpModel.findOne({
        where: { email },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!otpRecord || !isSignupOtp(otpRecord)) {
        throw new SignupError(404, "No pending registration found for this email.");
      }

      if (now() > new Date(otpRecord.expires_at)) {
        throw new SignupError(400, "The OTP has expired. Please request a new one.");
      }
      if (otpRecord.attempts >= signupOtpPolicy.maxAttempts) {
        throw new SignupError(400, "Too many failed attempts. Please request a new OTP.");
      }
      if (!await bcrypt.compare(otpCode, otpRecord.otp_hash)) {
        await otpRecord.increment("attempts", { by: 1, transaction });
        return { error: new SignupError(400, "Invalid OTP code.") };
      }

      const payload = otpRecord.signup_payload;
      const existing = await UserModel.findOne({
        where: { email: payload.email },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) {
        throw new SignupError(409, "An account with this email has already been registered.");
      }
      const existingStudent = await StudentModel.findOne({
        where: { student_number: payload.student_number },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existingStudent) {
        throw new SignupError(409, "An account with this student number has already been registered.");
      }

      const user = await UserModel.create(
        {
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          password_hash: payload.password_hash,
          role: "Student",
          status: "Active",
          email_verified: true,
          terms_accepted_at: payload.terms_accepted_at,
          privacy_policy_accepted_at: payload.privacy_policy_accepted_at,
        },
        { transaction },
      );

      await StudentModel.create(
        {
          user_id: user.id,
          student_number: payload.student_number,
          middle_name: payload.middle_name,
          suffix: payload.suffix,
          college: payload.college,
          course: payload.course,
          year_level: payload.year_level,
          student_type: payload.student_type || "Regular",
        },
        { transaction },
      );

      await otpRecord.destroy({ transaction });
      return { result: { message: "Registration successful. You may now log in." } };
    });
    if (outcome.error) throw outcome.error;
    return outcome.result;
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw new SignupError(409, "An account with these details has already been registered.");
    }
    throw error;
  }
}