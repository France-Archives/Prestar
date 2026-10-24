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
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Gmail API] Dev mode — credentials missing, email not sent.`);
      console.warn(`🔑 [DEV/TEST OTP for ${toEmail}] (${firstName || "unknown"}): ${otpCode}\n`);
      return { sent: true, devMode: true };
    }
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
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `\n⚠️  [Gmail API] Failed to send email (${error.message}). Falling back to console log for development/test.`,
      );
      console.warn(`🔑 [DEV/TEST OTP for ${toEmail}] (${firstName || "unknown"}): ${otpCode}\n`);
      return { sent: true, devMode: true };
    }
    throw new Error("Verification email delivery failed.");
  }
}

export default sendOtpEmail;

/**
 * Sends a password reset OTP email using Gmail API.
 * @param {string} toEmail  - Recipient email
 * @param {string} otpCode  - 6-digit reset code
 * @param {string} firstName - Recipient's first name
 */
export async function sendPasswordResetEmail(toEmail, otpCode, firstName = "") {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail  = process.env.GMAIL_USER;

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Gmail API] Dev mode — credentials missing, email not sent.`);
      console.warn(`🔑 [DEV/TEST RESET CODE for ${toEmail}] (${firstName || "unknown"}): ${otpCode}\n`);
      return { sent: true, devMode: true };
    }
    throw new Error("Gmail API credentials are not configured.");
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground",
  );
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-top: 0;">Prestar Library — Password Reset</h2>
      <p style="color: #475569; font-size: 16px;">Hello, ${firstName ? escapeHtml(firstName) : "there"}!</p>
      <p style="color: #475569; font-size: 16px;">We received a request to reset the password for your Prestar Library account. Use the code below to continue:</p>
      <div style="background-color: #fef3c7; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0; border: 1px solid #fcd34d;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #92400e;">${otpCode}</span>
      </div>
      <p style="color: #64748b; font-size: 14px;">This code is valid for <strong>10 minutes</strong>. If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">For your security, never share this code with anyone.</p>
    </div>
  `;

  const rawMessage = createRawEmail({
    to:      toEmail,
    from:    senderEmail,
    subject: "Your Prestar Password Reset Code",
    html:    htmlContent,
  });

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: rawMessage },
    });
    return { sent: true };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `\n⚠️  [Gmail API] Failed to send reset email (${error.message}). Dev fallback to console.`,
      );
      console.warn(`🔑 [DEV/TEST RESET CODE for ${toEmail}] (${firstName || "unknown"}): ${otpCode}\n`);
      return { sent: true, devMode: true };
    }
    throw new Error("Password reset email delivery failed.");
  }
}
