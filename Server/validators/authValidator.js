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

  const studentNumber = body.student_number || body.student_id;
  if (typeof studentNumber !== "string" || !studentNumber.trim()) {
    return res.status(400).json({ error: "student_number is required." });
  }
  if (studentNumber.trim().length > 50) {
    return res.status(400).json({ error: "student_number is too long." });
  }
  body.student_number = studentNumber.trim();

  const requiredStrings = [
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

  const course = body.course || body.submitted_course;
  if (course !== undefined) {
    if (typeof course !== "string" || course.trim().length > 150) {
      return res.status(400).json({ error: "course must be a string up to 150 characters." });
    }
    body.course = course.trim();
  }

  const yearLevel = body.year_level || body.submitted_year_level;
  if (yearLevel !== undefined) {
    const year = Number(yearLevel);
    if (!Number.isInteger(year) || year < 1 || year > 6) {
      return res.status(400).json({ error: "year_level must be an integer from 1 to 6." });
    }
    body.year_level = year;
  }

  if (body.college !== undefined) {
    if (typeof body.college !== "string" || body.college.trim().length > 150) {
      return res.status(400).json({ error: "college must be a string up to 150 characters." });
    }
    body.college = body.college.trim();
  }

  return next();
}

export function validateVerifyOtp(req, res, next) {
  const { email, otp } = req.body ?? {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  if (typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
    return res.status(400).json({ error: "A 6-digit OTP is required." });
  }

  req.body.email = normalizedEmail;
  req.body.otp = otp.trim();
  return next();
}

export function validateResendOtp(req, res, next) {
  const { email } = req.body ?? {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  req.body.email = normalizedEmail;
  return next();
}