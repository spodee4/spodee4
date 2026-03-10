// ============================================================
// Mx — Authentication Middleware
// Token-based auth with cookie + header support
// ============================================================

const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Middleware: require auth on protected routes
function requireAuth(db) {
  return (req, res, next) => {
    // Skip auth for login/register/static endpoints
    const publicPaths = ["/api/auth/login", "/api/auth/register", "/api/auth/setup-check"];
    if (publicPaths.includes(req.path)) return next();

    // Don't auth static files
    if (!req.path.startsWith("/api/")) return next();

    const token = req.cookies?.mx_session || req.headers["x-auth-token"];
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const session = db.getSession(token);
    if (!session) return res.status(401).json({ error: "Session expired" });

    req.user = { id: session.user_id, username: session.username, displayName: session.display_name };
    next();
  };
}

// Create session and set cookie
function createAuthSession(db, res, userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  db.createSession(token, userId, expiresAt);

  res.cookie("mx_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_MS,
    path: "/",
  });

  return token;
}

module.exports = {
  generateToken,
  hashPassword,
  verifyPassword,
  requireAuth,
  createAuthSession,
  SESSION_DURATION_MS,
};
