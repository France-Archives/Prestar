// Server/services/otpMailService.js
// Plain-text OTP verification email via Gmail API (OAuth2).
// Separate from gmailService.js which handles signup HTML emails.
import "../config/config.js";
import { google } from "googleapis";

function buildRawMime({ to, from, subject, body }) {
	const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
	const lines = [
		`From: Prestar Library <${from}>`,
		`To: <${to}>`,
		`Subject: ${utf8Subject}`,
		`MIME-Version: 1.0`,
		`Content-Type: text/plain; charset=utf-8`,
		``,
		body,
	];
	return Buffer.from(lines.join("\r\n"))
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * Sends a plain-text verification code email.
 * @param {string} toEmail  Recipient
 * @param {string} code     6-digit code
 */
export async function sendVerificationEmail(toEmail, code) {
	const clientId = process.env.GMAIL_CLIENT_ID;
	const clientSecret = process.env.GMAIL_CLIENT_SECRET;
	const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
	const sender = process.env.GMAIL_USER;

	if (!clientId || !clientSecret || !refreshToken) {
		// Dev fallback — never expose OTP in production
		if (process.env.NODE_ENV === "production") {
			throw new Error("Gmail API credentials are not configured.");
		}
		console.warn(`[OTP Mail] Dev mode — credentials missing, email not sent.`);
		return { sent: false, devMode: true };
	}

	const oAuth2Client = new google.auth.OAuth2(
		clientId,
		clientSecret,
		"https://developers.google.com/oauthplayground",
	);
	oAuth2Client.setCredentials({ refresh_token: refreshToken });

	const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

	const raw = buildRawMime({
		to: toEmail,
		from: sender,
		subject: "Your verification code",
		body: `Your code is ${code}. It expires in 5 minutes. If you didn't request this, ignore this email.`,
	});

	try {
		await gmail.users.messages.send({
			userId: "me",
			requestBody: { raw },
		});
		return { sent: true };
	} catch (error) {
		console.warn(
			`\n⚠️  [OTP Mail] Failed to send email via Gmail API (${error.message}). Falling back to console log for development/test.`,
		);
		console.warn(`🔑 [DEV/TEST OTP for ${toEmail}]: ${code}\n`);
		if (process.env.NODE_ENV === "production") {
			throw error;
		}
		return { sent: false, devMode: true };
	}
}
