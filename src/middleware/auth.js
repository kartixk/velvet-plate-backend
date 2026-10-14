const { verifyToken } = require("../services/auth");

/* =========================
   AUTH MIDDLEWARE
========================= */
function authMiddleware(req, res, next) {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.replace("Bearer", "").trim();
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.id || payload._id,
      role: payload.role
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* =========================
   ADMIN GUARD
========================= */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userRole = req.user.role.toUpperCase();

  if (userRole !== "ADMIN") {
    return res.status(403).json({ error: "Admin required" });
  }

  next();
}

/* =========================
   STAFF GUARD (ADMIN or MANAGER)
========================= */
function requireStaff(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userRole = req.user.role.toUpperCase();

  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    return res.status(403).json({ error: "Forbidden: Staff access (Admin or Manager) required" });
  }

  next();
}

/* =========================
   OPTIONAL AUTH MIDDLEWARE
========================= */
function optionalAuth(req, res, next) {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.replace("Bearer", "").trim();
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = {
        id: payload.id || payload._id,
        role: payload.role
      };
    } catch {
      // Ignore token verification errors for optional auth
    }
  }
  next();
}

module.exports = { authMiddleware, requireAdmin, requireStaff, optionalAuth };
