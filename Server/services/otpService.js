// Server/services/otpService.js
import crypto from "node:crypto";
import { sequelize, EmailOtp, User } from "../models/index.js";
import { sendVerificationEmail } from "./otpMailService.js";

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const HOURLY_CAP = 5;

// In-memory tracker for global daily email send cap
let dailySendCount = 0;
let dailyResetTimestamp = Date.now();

export function getDailySendCount() {
	return dailySendCount;
}

export function resetDailySendCount(count = 0) {
	dailySendCount = count;
	dailyResetTimestamp = Date.now();
}

function checkDailyCap() {
	const now = Date.now();
	// Reset every 24 hours
	if (now - dailyResetTimestamp > 24 * 60 * 60 * 1000) {
		dailySendCount = 0;
		dailyResetTimestamp = now;
	}

	const cap = Number(process.env.OTP_DAILY_CAP) || 400;
	const warnThreshold = Math.floor(cap * 0.8);

	if (dailySendCount >= cap) {
		console.error(`[OTP] Global daily send cap of ${cap} reached. Refusing to send.`);
		throw new OtpError(429, "If the email is valid, a code has been sent.");
	}

	if (dailySendCount >= warnThreshold) {
		console.warn(`[OTP] Daily send volume at ${dailySendCount}/${cap} (80%+ of daily cap reached).`);
	}
}

function getOtpSecret() {
	const secret = process.env.OTP_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error("OTP_SECRET must be set to a random value of at least 32 characters.");
	}
	return secret;
}

/**
 * Deterministic HMAC-SHA256 digest of "email:code" using OTP_SECRET.
 */
export function hmacCode(email, code) {
	return crypto
		.createHmac("sha256", getOtpSecret())
		.update(`${email}:${code}`)
		.digest("hex");
}

/**
 * Constant-time comparison between two hex strings to prevent timing attacks.
 */
export function safeCompare(a, b) {
	if (typeof a !== "string" || typeof b !== "string") return false;
	const bufA = Buffer.from(a, "hex");
	const bufB = Buffer.from(b, "hex");
	if (bufA.length !== bufB.length) return false;
	return crypto.timingSafeEqual(bufA, bufB);
}

export class OtpError extends Error {
	constructor(status, message) {
		super(message);
		this.name = "OtpError";
		this.status = status;
	}
}

// ---------------------------------------------------------------------------
// POST /api/otp/request
// ---------------------------------------------------------------------------

export async function requestOtp(email) {
	const normalizedEmail = String(email ?? "").trim().toLowerCase();

	// 1. Check existing record for hourly cap (max 5 requests per hour)
	const existing = await EmailOtp.findOne({ where: { email: normalizedEmail } });
	if (existing) {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
		if (existing.last_sent_at > oneHourAgo && existing.resend_count >= HOURLY_CAP) {
			throw new OtpError(429, "If the email is valid, a code has been sent.");
		}
	}

	// 2. Global daily send cap check
	checkDailyCap();

	// 3. Generate 6-digit cryptographic code and HMAC hash (OTP never logged)
	const rawCode = String(crypto.randomInt(100000, 1000000));
	const codeHash = hmacCode(normalizedEmail, rawCode);
	const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

	// 4. Atomic upsert with 60-second cooldown in one SQL statement
	// If row exists and last_sent_at is within 60s, WHERE condition blocks update -> 0 rows returned
	const [results] = await sequelize.query(
		`INSERT INTO email_otps (email, otp_hash, expires_at, attempts, resend_count, last_sent_at, created_at, signup_payload)
		 VALUES ($1, $2, $3, 0, 1, NOW(), NOW(), '{}'::jsonb)
		 ON CONFLICT (email) DO UPDATE
		   SET otp_hash     = $2,
		       expires_at   = $3,
		       attempts     = 0,
		       resend_count = CASE
		         WHEN email_otps.last_sent_at < NOW() - INTERVAL '1 hour' THEN 1
		         ELSE email_otps.resend_count + 1
		       END,
		       last_sent_at = NOW()
		 WHERE (email_otps.signup_payload IS NULL OR email_otps.signup_payload = '{}'::jsonb)
		   AND email_otps.last_sent_at < NOW() - INTERVAL '${COOLDOWN_SECONDS} seconds'
		 RETURNING *`,
		{
			bind: [normalizedEmail, codeHash, expiresAt],
			type: sequelize.constructor.QueryTypes.SELECT,
		},
	);

	if (!results || Object.keys(results).length === 0) {
		// 60-second cooldown not yet elapsed
		throw new OtpError(429, "If the email is valid, a code has been sent.");
	}

	// 5. Send plain text email via Gmail API
	try {
		await sendVerificationEmail(normalizedEmail, rawCode);
		dailySendCount++;
	} catch (err) {
		console.error("[OTP] Gmail delivery failed:", err.message);
		// Delete stored code on send failure so user can retry immediately
		await EmailOtp.destroy({ where: { email: normalizedEmail, otp_hash: codeHash } });
		throw new OtpError(500, "If the email is valid, a code has been sent.");
	}

	return { message: "If the email is valid, a code has been sent." };
}

// ---------------------------------------------------------------------------
// POST /api/otp/verify
// ---------------------------------------------------------------------------

export async function verifyOtp(email, code) {
	const normalizedEmail = String(email ?? "").trim().toLowerCase();
	const trimmedCode = String(code ?? "").trim();

	// 1. Atomically increment attempts on active (unexpired) row
	const [rows] = await sequelize.query(
		`UPDATE email_otps
		 SET attempts = attempts + 1
		 WHERE email = $1 AND expires_at > NOW()
		 RETURNING *`,
		{
			bind: [normalizedEmail],
			type: sequelize.constructor.QueryTypes.SELECT,
		},
	);

	if (!rows || Object.keys(rows).length === 0) {
		throw new OtpError(400, "Invalid or expired code.");
	}

	const record = rows;

	// 2. Lockout: if attempts exceeded max (5), delete code row immediately
	if (record.attempts > MAX_ATTEMPTS) {
		await EmailOtp.destroy({ where: { email: normalizedEmail } });
		throw new OtpError(400, "Invalid or expired code.");
	}

	// 3. Constant-time HMAC comparison
	const expectedHash = hmacCode(normalizedEmail, trimmedCode);
	if (!safeCompare(expectedHash, record.otp_hash)) {
		// If this was the 5th bad attempt, remove the row to enforce lockout
		if (record.attempts >= MAX_ATTEMPTS) {
			await EmailOtp.destroy({ where: { email: normalizedEmail } });
		}
		throw new OtpError(400, "Invalid or expired code.");
	}

	// 4. Success — single use: delete the row from email_otps
	await EmailOtp.destroy({ where: { email: normalizedEmail } });

	// 5. Mark user email_verified = true
	await User.update(
		{ email_verified: true },
		{ where: { email: normalizedEmail } },
	);

	return { message: "Email verified successfully.", verified: true };
}

// ---------------------------------------------------------------------------
// Cleanup job — deletes expired rows
// ---------------------------------------------------------------------------

export async function cleanupExpiredOtps() {
	try {
		const [, meta] = await sequelize.query(
			`DELETE FROM email_otps
			 WHERE expires_at <= NOW()
			   AND (
			     signup_payload IS NULL
			     OR signup_payload = '{}'::jsonb
			     OR created_at <= NOW() - INTERVAL '24 hours'
			   )`,
		);
		const count = meta?.rowCount ?? 0;
		if (count > 0) {
			console.log(`[OTP cleanup] Deleted ${count} expired OTP records.`);
		}
		return count;
	} catch (err) {
		console.error("[OTP cleanup] Error running cleanup:", err.message);
		return 0;
	}
}

export function startOtpCleanup(intervalMs = 10 * 60 * 1000) {
	cleanupExpiredOtps();
	return setInterval(cleanupExpiredOtps, intervalMs);
}
