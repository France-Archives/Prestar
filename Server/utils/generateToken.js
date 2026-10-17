// Server/utils/generateToken.js
import jwt from "jsonwebtoken";

export default function generateToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: "6h" },
  );
}