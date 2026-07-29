// Xác thực đăng nhập cho toàn bộ API + Socket.IO.
// Cơ chế: 1 tài khoản (AUTH_USER/AUTH_PASS) → phát JWT lưu trong cookie httpOnly.
// Mọi request REST và mọi kết nối socket đều phải kèm cookie hợp lệ.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const TOKEN_NAME = "iot_token";
const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h

// Secret ký JWT. Nên đặt JWT_SECRET trong .env để phiên không rớt sau mỗi lần
// restart. Không có thì sinh ngẫu nhiên (mọi phiên cũ mất hiệu lực khi khởi động lại).
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn(
    "[auth] JWT_SECRET chưa được đặt — dùng secret ngẫu nhiên, người dùng sẽ bị đăng xuất sau mỗi lần restart. Hãy đặt JWT_SECRET trong .env.",
  );
}

const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASS = process.env.AUTH_PASS || "";
if (!AUTH_PASS) {
  console.warn(
    "[auth] AUTH_PASS chưa được đặt — KHÔNG THỂ đăng nhập cho tới khi đặt AUTH_PASS trong .env.",
  );
}

// secure=true buộc trình duyệt chỉ gửi cookie qua HTTPS. Prod (sau Caddy) đặt
// COOKIE_SECURE=true. Dev qua Vite proxy (HTTP) phải để false, không thì cookie
// không bao giờ được set.
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true" || process.env.COOKIE_SECURE === "1";

// So sánh chuỗi chống timing attack — luôn so trên độ dài cố định.
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // vẫn chạy compare để tốn thời gian tương đương, rồi trả false
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function signToken() {
  return jwt.sign({ u: AUTH_USER }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Parse cookie header thủ công (dùng cho handshake Socket.IO, nơi không có cookie-parser).
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

// ===== REST handlers =====
function login(req, res) {
  const { username, password } = req.body || {};
  if (!AUTH_PASS) {
    return res.status(500).json({ error: "Server chưa cấu hình mật khẩu (AUTH_PASS)" });
  }
  const ok = safeEqual(username || "", AUTH_USER) && safeEqual(password || "", AUTH_PASS);
  if (!ok) {
    return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
  }
  res.cookie(TOKEN_NAME, signToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    maxAge: TOKEN_TTL_SECONDS * 1000,
  });
  return res.json({ success: true, username: AUTH_USER });
}

function logout(req, res) {
  res.clearCookie(TOKEN_NAME, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE });
  return res.json({ success: true });
}

function me(req, res) {
  const token = req.cookies && req.cookies[TOKEN_NAME];
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, username: payload.u });
}

// ===== Middleware bảo vệ REST =====
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[TOKEN_NAME];
  if (token && verifyToken(token)) return next();
  return res.status(401).json({ error: "Chưa đăng nhập" });
}

// ===== Middleware bảo vệ Socket.IO =====
function socketAuth(socket, next) {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const token = cookies[TOKEN_NAME];
  if (token && verifyToken(token)) return next();
  return next(new Error("unauthorized"));
}

module.exports = { login, logout, me, requireAuth, socketAuth, TOKEN_NAME };
