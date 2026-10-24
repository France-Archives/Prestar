// Server/validators/otpValidator.js
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codePattern = /^\d{6}$/;

export function validateOtpRequest(req, res, next) {
	const { email } = req.body ?? {};
	const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

	if (!emailPattern.test(normalizedEmail)) {
		return res.status(400).json({ error: "A valid email address is required." });
	}

	req.body.email = normalizedEmail;
	return next();
}

export function validateOtpVerify(req, res, next) {
	const { email, code } = req.body ?? {};
	const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

	if (!emailPattern.test(normalizedEmail)) {
		return res.status(400).json({ error: "A valid email address is required." });
	}

	const trimmedCode = typeof code === "string" ? code.trim() : "";
	// Reject before touching the database
	if (!codePattern.test(trimmedCode)) {
		return res.status(400).json({ error: "Invalid or expired code." });
	}

	req.body.email = normalizedEmail;
	req.body.code = trimmedCode;
	return next();
}
