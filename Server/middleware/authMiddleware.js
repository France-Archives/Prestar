// Server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

export default async function authMiddleware(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    return next(new Error("JWT_SECRET must be set to a random value of at least 32 characters."));
  }

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  if (!payload || typeof payload !== "object" || !payload.id) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  try {
    const user = await User.findByPk(payload.id);
    if (!user || user.status?.toLowerCase() !== "active") {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}