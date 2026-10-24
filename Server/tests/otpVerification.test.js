// Server/tests/otpVerification.test.js
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";
import { EmailOtp, sequelize, User } from "../models/index.js";
import {
	hmacCode,
	requestOtp,
	verifyOtp,
	OtpError,
	cleanupExpiredOtps,
} from "../services/otpService.js";

test("Standalone Email OTP Request & Verification Test Suite", async (t) => {
	let server;
	let baseUrl;

	// Start ephemeral server for HTTP endpoint tests
	await new Promise((resolve) => {
		server = http.createServer(app);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			baseUrl = `http://127.0.0.1:${port}`;
			resolve();
		});
	});

	const uniqueEmail = `test_otp_${Date.now()}@example.com`;

	// Pre-create user to test email_verified update
	const [testUser] = await User.findOrCreate({
		where: { email: uniqueEmail },
		defaults: {
			first_name: "Test",
			last_name: "User",
			email: uniqueEmail,
			password_hash: "dummyhash123",
			role: "Student",
			status: "Active",
			email_verified: false,
		},
	});

	t.after(async () => {
		await EmailOtp.destroy({ where: { email: uniqueEmail } });
		await User.destroy({ where: { email: uniqueEmail } });
		server.close();
		await sequelize.close();
	});

	await t.test("1. POST /api/otp/request sends code and NEVER leaks OTP in response", async () => {
		const res = await fetch(`${baseUrl}/api/otp/request`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: uniqueEmail }),
		});

		assert.equal(res.status, 200);
		const data = await res.json();
		assert.equal(data.message, "If the email is valid, a code has been sent.");

		// Verify that no OTP or code property exists in response
		assert.equal(data.code, undefined);
		assert.equal(data.otp, undefined);
		assert.equal(data.rawCode, undefined);
		const responseStr = JSON.stringify(data);
		assert.equal(/\b\d{6}\b/.test(responseStr), false, "Response body leaked a 6-digit code!");

		// Check database record created
		const otpRecord = await EmailOtp.findOne({ where: { email: uniqueEmail } });
		assert.ok(otpRecord, "OTP record should exist in email_otps");
		assert.equal(otpRecord.attempts, 0);
		assert.equal(typeof otpRecord.otp_hash, "string");
		assert.equal(otpRecord.otp_hash.length, 64, "Should be a 64-char HMAC-SHA256 hex string");
	});

	await t.test("2. Cooldown: immediate second request within 60s returns 429", async () => {
		const res = await fetch(`${baseUrl}/api/otp/request`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: uniqueEmail }),
		});

		assert.equal(res.status, 429);
		const data = await res.json();
		// Response message is generic
		assert.equal(data.message, "If the email is valid, a code has been sent.");
	});

	await t.test("3. Validation: rejects invalid email and malformed OTP format", async () => {
		const badEmailRes = await fetch(`${baseUrl}/api/otp/request`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "invalid-email" }),
		});
		assert.equal(badEmailRes.status, 400);

		// Malformed OTP verify (non-6-digit)
		const badCodeRes = await fetch(`${baseUrl}/api/otp/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: uniqueEmail, code: "abc" }),
		});
		assert.equal(badCodeRes.status, 400);
		const badCodeData = await badCodeRes.json();
		assert.equal(badCodeData.error, "Invalid or expired code.");
	});

	await t.test("4. Wrong code: returns 400 and increments attempts atomically", async () => {
		const res = await fetch(`${baseUrl}/api/otp/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: uniqueEmail, code: "999999" }),
		});

		assert.equal(res.status, 400);
		const data = await res.json();
		assert.equal(data.error, "Invalid or expired code.");

		const otpRecord = await EmailOtp.findOne({ where: { email: uniqueEmail } });
		assert.ok(otpRecord);
		assert.equal(otpRecord.attempts, 1, "Attempts count should be incremented to 1");
	});

	await t.test("5. Attempt lockout: 5 wrong attempts deletes OTP row", async () => {
		for (let i = 2; i <= 5; i++) {
			await fetch(`${baseUrl}/api/otp/verify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: uniqueEmail, code: "999999" }),
			});
		}

		// The row should be deleted upon hitting max attempts
		const remaining = await EmailOtp.findOne({ where: { email: uniqueEmail } });
		assert.equal(remaining, null, "Record should be removed after 5 failed attempts");

		// Further verify attempt returns generic 400 error
		const lockedRes = await fetch(`${baseUrl}/api/otp/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: uniqueEmail, code: "123456" }),
		});
		assert.equal(lockedRes.status, 400);
		const data = await lockedRes.json();
		assert.equal(data.error, "Invalid or expired code.");
	});

	await t.test("6. Hourly cap: 5 requests within 1 hour triggers 429", async () => {
		const cappedEmail = `capped_${Date.now()}@example.com`;
		const codeHash = hmacCode(cappedEmail, "111111");

		// Seed a record with resend_count = 5
		await EmailOtp.create({
			email: cappedEmail,
			otp_hash: codeHash,
			expires_at: new Date(Date.now() + 5 * 60 * 1000),
			attempts: 0,
			resend_count: 5,
			last_sent_at: new Date(Date.now() - 70 * 1000), // cooldown passed (>60s)
			created_at: new Date(),
		});

		const res = await fetch(`${baseUrl}/api/otp/request`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: cappedEmail }),
		});

		assert.equal(res.status, 429);
		const data = await res.json();
		assert.equal(data.message, "If the email is valid, a code has been sent.");

		await EmailOtp.destroy({ where: { email: cappedEmail } });
	});

	await t.test("7. Expired code: returns 400 and rejects verification", async () => {
		const expiredEmail = `expired_${Date.now()}@example.com`;
		const testCode = "654321";
		const expiredHash = hmacCode(expiredEmail, testCode);

		await EmailOtp.create({
			email: expiredEmail,
			otp_hash: expiredHash,
			expires_at: new Date(Date.now() - 1000), // expired 1s ago
			attempts: 0,
			resend_count: 1,
			last_sent_at: new Date(Date.now() - 70 * 1000),
			created_at: new Date(),
		});

		const res = await fetch(`${baseUrl}/api/otp/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: expiredEmail, code: testCode }),
		});

		assert.equal(res.status, 400);
		const data = await res.json();
		assert.equal(data.error, "Invalid or expired code.");

		// Verify cleanupExpiredOtps deletes it
		const cleaned = await cleanupExpiredOtps();
		assert.ok(cleaned >= 1);
	});

	await t.test("8. Successful verify: sets email_verified = true and deletes single-use code", async () => {
		const successEmail = uniqueEmail;
		const validCode = "543210";
		const validHash = hmacCode(successEmail, validCode);

		// Seed fresh valid OTP
		await EmailOtp.upsert({
			email: successEmail,
			otp_hash: validHash,
			expires_at: new Date(Date.now() + 5 * 60 * 1000),
			attempts: 0,
			resend_count: 1,
			last_sent_at: new Date(),
			created_at: new Date(),
		});

		const res = await fetch(`${baseUrl}/api/otp/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: successEmail, code: validCode }),
		});

		assert.equal(res.status, 200);
		const data = await res.json();
		assert.equal(data.verified, true);
		assert.equal(data.message, "Email verified successfully.");

		// Check user in database now has email_verified = true
		const user = await User.findOne({ where: { email: successEmail } });
		assert.ok(user);
		assert.equal(user.email_verified, true, "User email_verified should be true");

		// Check OTP row deleted (single-use)
		const otpRow = await EmailOtp.findOne({ where: { email: successEmail } });
		assert.equal(otpRow, null, "OTP code should be deleted after successful verification");
	});

	await t.test("9. Code reuse prevention: verifying already used code fails", async () => {
		const res = await fetch(`${baseUrl}/api/otp/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: uniqueEmail, code: "543210" }),
		});

		assert.equal(res.status, 400);
		const data = await res.json();
		assert.equal(data.error, "Invalid or expired code.");
	});
});
