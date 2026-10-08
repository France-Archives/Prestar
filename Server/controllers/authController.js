// Server/controllers/authController.js
import bcrypt from "bcrypt";
import { User } from "../models/index.js";
import generateToken from "../utils/generateToken.js";

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
      attributes: ["id", "email", "password_hash", "role", "status"],
    });

    if (!user || user.status?.toLowerCase() !== "active") {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(req.body.password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user);
    return res
      .cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SIX_HOURS_MS })
      .set("Cache-Control", "no-store")
      .set("Pragma", "no-cache")
      .status(200)
      .json({ message: "Login successful." });
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
    return res.status(200).json({ user: req.user });
  } catch (error) {
    console.error("Session check failed:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}