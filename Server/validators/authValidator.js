// Server/validators/authValidator.js
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const studentTypes = new Set(["Regular", "Transferee", "Returnee", "Other"]);

export function validateLogin(req, res, next) {
  const { email, password } = req.body ?? {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }
  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "Password is required." });
  }

  req.body.email = normalizedEmail;
  return next();
}

export function validateSignup(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "A JSON request body is required." });
  }

  const requiredStrings = [
    ["student_id", 20],
    ["first_name", 100],
    ["last_name", 100],
    ["email", 255],
  ];
  for (const [field, maxLength] of requiredStrings) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return res.status(400).json({ error: `${field} is required.` });
    }
    if (body[field].trim().length > maxLength) {
      return res.status(400).json({ error: `${field} is too long.` });
    }
    body[field] = body[field].trim();
  }

  body.email = body.email.toLowerCase();
  if (!emailPattern.test(body.email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  if (typeof body.password !== "string" || body.password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }
  if (Buffer.byteLength(body.password, "utf8") > 72) {
    return res.status(400).json({ error: "Password must not exceed 72 bytes." });
  }

  if (body.student_type !== undefined && !studentTypes.has(body.student_type)) {
    return res.status(400).json({ error: "student_type must be Regular, Transferee, Returnee, or Other." });
  }
  if (body.submitted_course !== undefined) {
    if (typeof body.submitted_course !== "string" || body.submitted_course.trim().length > 150) {
      return res.status(400).json({ error: "submitted_course must be a string up to 150 characters." });
    }
    body.submitted_course = body.submitted_course.trim();
  }
  if (body.submitted_year_level !== undefined) {
    const year = Number(body.submitted_year_level);
    if (!Number.isInteger(year) || year < 1 || year > 6) {
      return res.status(400).json({ error: "submitted_year_level must be an integer from 1 to 6." });
    }
    body.submitted_year_level = year;
  }
  if (body.previous_school !== undefined) {
    if (typeof body.previous_school !== "string" || body.previous_school.trim().length > 255) {
      return res.status(400).json({ error: "previous_school must be a string up to 255 characters." });
    }
    body.previous_school = body.previous_school.trim();
  }

  return next();
}