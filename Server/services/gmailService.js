// Server/services/gmailService.js
import "../config/config.js"; // ensures dotenv is loaded before reading env vars
import { google } from "googleapis";


/**
 * Encodes an email object into RFC 2822 compliant base64url string.
 */
function createRawEmail({ to, from, subject, html, text }) {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    `From: <${from}>`,
    `To: <${to}>`,
    `Subject: ${utf8Subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html || text,
  ];
  const message = messageParts.join("\r\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

/**
 * Sends an OTP email using the official Google Gmail REST API via OAuth2.
 * @param {string} toEmail - Recipient email
 * @param {string} otpCode - 6-digit OTP code
 */
export async function sendOtpEmail(toEmail, otpCode, firstName = "") {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail = process.env.GMAIL_USER;

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    throw new Error("Gmail API credentials are not configured.");
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground",
  );

  oAuth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-top: 0;">Prestar Library Verification</h2>
      <p style="color: #475569; font-size: 16px;">Hello, ${firstName ? escapeHtml(firstName) : "there"}!</p>
      <p style="color: #475569; font-size: 16px;">Your one-time verification code (OTP) for account registration is:</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${otpCode}</span>
      </div>
      <p style="color: #64748b; font-size: 14px;">This code is valid for 10 minutes. If you did not request this registration, please disregard this email.</p>
    </div>
  `;

  const rawMessage = createRawEmail({
    to: toEmail,
    from: senderEmail,
    subject: "Your Prestar Verification Code",
    html: htmlContent,
  });

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });
    return { sent: true };
  } catch {
    throw new Error("Verification email delivery failed.");
  }
}

export default sendOtpEmail;
