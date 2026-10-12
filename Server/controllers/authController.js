// Server/controllers/authController.js
import bcrypt from "bcrypt";
import { Student, User } from "../models/index.js";
import generateToken from "../utils/generateToken.js";
import { getDashboardRoute } from "../utils/roleRoutes.js";

const COOKIE_NAME = "auth_token";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export async function login(req, res) {
  try {
    const user = await User.unscoped().findOne({
      where: { email: req.body.email },
      attributes: ["user_id", "email", "password_hash", "role", "status", "first_name", "last_name"],
    });

    if (!user || user.status?.toLowerCase() !== "active") {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(req.body.password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user);
    const student = user.role === "Student" ? await Student.findByPk(user.id) : null;
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      accountStatus: user.status?.toUpperCase() || "ACTIVE",
      first_name: user.first_name,
      firstName: user.first_name,
      last_name: user.last_name,
      lastName: user.last_name,
      displayName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      student: student ? {
        id: student.user_id,
        userId: student.user_id,
        student_number: student.student_number,
        studentNumber: student.student_number,
        college: student.college,
        course: student.course,
        program: student.course,
        year_level: student.year_level,
        yearLevel: student.year_level,
      } : null,
    };

    return res
      .cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SIX_HOURS_MS })
      .set("Cache-Control", "no-store")
      .set("Pragma", "no-cache")
      .status(200)
      .json({
        message: "Login successful.",
        user: userPayload,
        data: userPayload,
      });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function logout(_req, res) {
  try {
    return res
      .clearCookie(COOKIE_NAME, cookieOptions)
      .status(200)
      .json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout failed:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }
    const student = user.role === "Student" ? await Student.findByPk(user.id) : null;

    const sessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      accountStatus: user.status?.toUpperCase() || "ACTIVE",
      first_name: user.first_name,
      firstName: user.first_name,
      last_name: user.last_name,
      lastName: user.last_name,
      displayName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      student: student ? {
        id: student.user_id,
        userId: student.user_id,
        student_number: student.student_number,
        studentNumber: student.student_number,
        college: student.college,
        course: student.course,
        program: student.course,
        year_level: student.year_level,
        yearLevel: student.year_level,
      } : null,
      librarian: null,
    };

    return res.status(200).json({
      user: sessionUser,
      data: sessionUser,
      dashboard_url: getDashboardRoute(req.user?.role),
    });
  } catch (error) {
    console.error("Session check failed:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const body = req.body || {};

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const userUpdates = {};
    const newFirst = body.firstName ?? body.first_name;
    const newLast = body.lastName ?? body.last_name;
    if (newFirst && typeof newFirst === "string") userUpdates.first_name = newFirst.trim();
    if (newLast && typeof newLast === "string") userUpdates.last_name = newLast.trim();
    if (Object.keys(userUpdates).length > 0) {
      await user.update(userUpdates);
    }

    if (user.role === "Student") {
      const student = await Student.findByPk(userId);
      if (student) {
        const studentUpdates = {};
        const newCourse = body.program ?? body.course;
        const newYear = body.yearLevel ?? body.year_level;
        if (newCourse !== undefined) studentUpdates.course = newCourse ? String(newCourse).trim() : null;
        if (newYear !== undefined) studentUpdates.year_level = newYear ? Number(newYear) : null;
        if (body.college !== undefined) studentUpdates.college = body.college ? String(body.college).trim() : null;
        if (Object.keys(studentUpdates).length > 0) {
          await student.update(studentUpdates);
        }
      }
    }

    return getCurrentUser(req, res);
  } catch (error) {
    console.error("Update profile failed:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}