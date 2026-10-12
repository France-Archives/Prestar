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

  // Student number: frontend sends studentNumber; legacy sends student_number or student_id
  const studentNumber = body.student_number || body.studentNumber || body.student_id;
  if (typeof studentNumber !== "string" || !studentNumber.trim()) {
    return res.status(400).json({ error: "student_number is required." });
  }
  if (studentNumber.trim().length > 50) {
    return res.status(400).json({ error: "student_number is too long." });
  }
  body.student_number = studentNumber.trim();
  body.studentNumber = body.student_number;

  // First name: frontend sends firstName, legacy sends first_name
  const firstName = body.first_name || body.firstName;
  if (typeof firstName !== "string" || !firstName.trim()) {
    return res.status(400).json({ error: "first_name is required." });
  }
  if (firstName.trim().length > 100) {
    return res.status(400).json({ error: "first_name is too long." });
  }
  body.first_name = firstName.trim();
  body.firstName = body.first_name;

  // Last name: frontend sends lastName, legacy sends last_name
  const lastName = body.last_name || body.lastName;
  if (typeof lastName !== "string" || !lastName.trim()) {
    return res.status(400).json({ error: "last_name is required." });
  }
  if (lastName.trim().length > 100) {
    return res.status(400).json({ error: "last_name is too long." });
  }
  body.last_name = lastName.trim();
  body.lastName = body.last_name;

  // Middle name and suffix (optional in frontend)
  if (body.middle_name || body.middleName) {
    body.middle_name = String(body.middle_name || body.middleName || "").trim();
    body.middleName = body.middle_name;
  }
  if (body.suffix) {
    body.suffix = String(body.suffix).trim();
  }

  // Email
  if (typeof body.email !== "string" || !body.email.trim()) {
    return res.status(400).json({ error: "email is required." });
  }
  body.email = body.email.trim().toLowerCase();
  if (body.email.length > 255) {
    return res.status(400).json({ error: "email is too long." });
  }
  if (!emailPattern.test(body.email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  // Password
  if (typeof body.password !== "string" || body.password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }
  if (Buffer.byteLength(body.password, "utf8") > 72) {
    return res.status(400).json({ error: "Password must not exceed 72 bytes." });
  }

  const studentType = body.student_type || body.studentType;
  if (studentType !== undefined) {
    if (!studentTypes.has(studentType)) {
      return res.status(400).json({ error: "student_type must be Regular, Transferee, Returnee, or Other." });
    }
    body.student_type = studentType;
    body.studentType = studentType;
  }

  // Course / Program mapping: in DB it is course, in frontend it is program
  const course = body.course || body.program || body.submitted_course;
  if (course !== undefined && course !== null && course !== "") {
    if (typeof course !== "string" || course.trim().length > 150) {
      return res.status(400).json({ error: "course must be a string up to 150 characters." });
    }
    body.course = course.trim();
    body.program = body.course;
  }

  // Year level: frontend sends yearLevel (1-10), backend uses year_level
  const yearLevel = body.year_level !== undefined && body.year_level !== null && body.year_level !== ""
    ? body.year_level
    : (body.yearLevel !== undefined && body.yearLevel !== null && body.yearLevel !== ""
      ? body.yearLevel
      : body.submitted_year_level);

  if (yearLevel !== undefined && yearLevel !== null && yearLevel !== "") {
    const year = Number(yearLevel);
    if (!Number.isInteger(year) || year < 1 || year > 10) {
      return res.status(400).json({ error: "year_level must be an integer from 1 to 10." });
    }
    body.year_level = year;
    body.yearLevel = year;
  }

  if (body.college !== undefined && body.college !== null && body.college !== "") {
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