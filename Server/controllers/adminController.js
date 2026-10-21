// Server/controllers/adminController.js
import bcrypt from "bcrypt";
import { Admin, Librarian, User, sequelize } from "../models/index.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^\p{L}[\p{L}\s'.-]*$/u;
const BCRYPT_SALT_ROUNDS = 10;

function validateStaffInput(body, role) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = (body.firstName || body.first_name || "").trim();
  const lastName = (body.lastName || body.last_name || "").trim();
  const employeeNumber = (body.employeeNumber || body.employee_number || "").trim() || null;

  if (!email || !emailPattern.test(email) || email.length > 255) {
    const error = new Error("A valid email address (max 255 characters) is required.");
    error.status = 400;
    throw error;
  }

  if (!password || password.length < 8) {
    const error = new Error("Password must be at least 8 characters long.");
    error.status = 400;
    throw error;
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Password must not exceed 72 bytes.");
    error.status = 400;
    throw error;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    const error = new Error("Password must contain at least one letter and one number.");
    error.status = 400;
    throw error;
  }

  if (!firstName || firstName.length > 100 || !namePattern.test(firstName)) {
    const error = new Error("Valid first name is required (letters, spaces, periods, dashes only).");
    error.status = 400;
    throw error;
  }

  if (!lastName || lastName.length > 100 || !namePattern.test(lastName)) {
    const error = new Error("Valid last name is required (letters, spaces, periods, dashes only).");
    error.status = 400;
    throw error;
  }

  if (employeeNumber && employeeNumber.length > 50) {
    const error = new Error("Employee number must not exceed 50 characters.");
    error.status = 400;
    throw error;
  }

  return { email, password, firstName, lastName, employeeNumber };
}

/**
 * POST /api/admin/librarians or POST /api/admin/create-librarian
 * Admin-only: Creates a new Librarian account
 */
export async function createLibrarianAccount(req, res, next) {
  try {
    const { email, password, firstName, lastName, employeeNumber } = validateStaffInput(req.body, "Librarian");

    const result = await sequelize.transaction(async (transaction) => {
      const existingUser = await User.findOne({
        where: { email },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existingUser) {
        const error = new Error("An account with that email already exists.");
        error.status = 409;
        throw error;
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      const user = await User.create(
        {
          first_name: firstName,
          last_name: lastName,
          email,
          password_hash: passwordHash,
          role: "Librarian",
          status: "Active",
          email_verified: true,
        },
        { transaction },
      );

      await Librarian.create(
        {
          user_id: user.user_id,
          employee_number: employeeNumber,
        },
        { transaction },
      );

      return {
        id: String(user.user_id),
        userId: String(user.user_id),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: `${user.first_name} ${user.last_name}`.trim(),
        role: "Librarian",
        status: user.status,
        employeeNumber,
        emailVerified: true,
      };
    });

    return res.status(201).json({
      message: "Librarian account created successfully.",
      user: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/admin/admins or POST /api/admin/create-admin
 * Admin-only: Creates a new Admin account
 */
export async function createAdminAccount(req, res, next) {
  try {
    const { email, password, firstName, lastName, employeeNumber } = validateStaffInput(req.body, "Admin");

    const result = await sequelize.transaction(async (transaction) => {
      const existingUser = await User.findOne({
        where: { email },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existingUser) {
        const error = new Error("An account with that email already exists.");
        error.status = 409;
        throw error;
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      const user = await User.create(
        {
          first_name: firstName,
          last_name: lastName,
          email,
          password_hash: passwordHash,
          role: "Admin",
          status: "Active",
          email_verified: true,
        },
        { transaction },
      );

      await Admin.create(
        {
          user_id: user.user_id,
          employee_number: employeeNumber,
        },
        { transaction },
      );

      return {
        id: String(user.user_id),
        userId: String(user.user_id),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: `${user.first_name} ${user.last_name}`.trim(),
        role: "Admin",
        status: user.status,
        employeeNumber,
        emailVerified: true,
      };
    });

    return res.status(201).json({
      message: "Admin account created successfully.",
      user: result,
    });
  } catch (error) {
    return next(error);
  }
}
