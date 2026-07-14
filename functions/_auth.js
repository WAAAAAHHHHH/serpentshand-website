/**
 * Shared authentication helpers for Cloudflare Pages Functions.
 * Uses only the Web Crypto API (crypto.subtle) — no external
 * packages, no Node crypto, no native bindings required.
 *
 * This file is prefixed with `_` so Cloudflare Pages does NOT
 * expose it as a route.
 */

const PBKDF2_ITERATIONS = 100000;
const HASH_ALGO = "SHA-256";
const SALT_BYTES = 16;
const SESSION_COOKIE_NAME = "session_id";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/* ----------------------------------------------------------
   Encoding helpers
---------------------------------------------------------- */

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/* ----------------------------------------------------------
   Password hashing (PBKDF2-SHA256)
---------------------------------------------------------- */

export function generateSaltHex() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return bufferToHex(salt.buffer);
}

async function deriveKey(password, saltHex) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuffer(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    256 // bits -> 32 byte hash
  );

  return bufferToHex(derivedBits);
}

/**
 * Hash a plaintext password with a freshly generated salt.
 * Returns { hash, salt } — both hex strings, safe to store in D1.
 */
export async function hashPassword(password) {
  const salt = generateSaltHex();
  const hash = await deriveKey(password, salt);
  return { hash, salt };
}

/**
 * Constant-time comparison of two equal-length hex strings.
 */
function timingSafeEqualHex(aHex, bHex) {
  if (aHex.length !== bHex.length) return false;
  let diff = 0;
  for (let i = 0; i < aHex.length; i++) {
    diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a plaintext password against a stored hash + salt.
 */
export async function verifyPassword(password, storedHash, storedSalt) {
  const computedHash = await deriveKey(password, storedSalt);
  return timingSafeEqualHex(computedHash, storedHash);
}

/* ----------------------------------------------------------
   Input validation
---------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * Minimum viable password policy. Adjust later if you want more/less strict.
 */
export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 200;
}

/* ----------------------------------------------------------
   Session management (uses prepared statements only)
---------------------------------------------------------- */

/**
 * Create a new session row for a user and return the raw session id
 * plus its expiry — the caller sets this as a cookie.
 */
export async function createSession(db, userId) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, userId, expiresAt)
    .run();

  return { sessionId, expiresAt };
}

/**
 * Delete a session row (used on logout).
 */
export async function destroySession(db, sessionId) {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/**
 * Parse the Cookie header into a plain object.
 */
export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

/**
 * Look up the current request's session cookie, validate it against D1
 * (including expiry), and return the associated user row (without the
 * password hash/salt) or null if there is no valid session.
 */
export async function getUserFromSession(request, db) {
  const cookies = parseCookies(request);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const session = await db
    .prepare("SELECT id, user_id, expires_at FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    // Expired — clean it up and treat as logged out.
    await destroySession(db, sessionId);
    return null;
  }

  const user = await db
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .bind(session.user_id)
    .first();

  return user || null;
}

/**
 * Build a Set-Cookie header value for the session cookie.
 * HttpOnly + Secure + SameSite=Strict — not readable/sendable cross-site by JS.
 */
export function buildSessionCookie(sessionId, expiresAt) {
  const expires = new Date(expiresAt).toUTCString();
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${expires}`;
}

/**
 * Build a Set-Cookie header value that clears the session cookie (logout).
 */
export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
