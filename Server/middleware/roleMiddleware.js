// Server/middleware/roleMiddleware.js
export function requireRole(allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw new TypeError("requireRole expects a non-empty array of role names.");
  }

  const allowed = new Set(allowedRoles);
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    return next();
  };
}

export default requireRole;