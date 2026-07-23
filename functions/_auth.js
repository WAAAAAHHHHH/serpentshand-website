/**
 * _auth.js — Shared authentication utilities for Cloudflare Pages Functions.
 *
 * All helpers in this file are pure functions that operate on the D1 database
 * binding and the Web Crypto API, which are both available in the Cloudflare
 * Workers runtime without any external dependencies.
 *
 * Password storage format:  "pbkdf2:<base64-salt>:<base64-hash>"
 * Session cookie name:      "session"
 * Session lifetime:         30 days
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOKIE_NAME       = 'session';
const SESSION_DAYS      = 30;
const SESSION_MS        = SESSION_DAYS * 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 recommendation for SHA-256
const PBKDF2_KEY_LEN    = 32;      // 256-bit output

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2-SHA256 via Web Crypto API)
// ---------------------------------------------------------------------------

/**
 * Hash a plain-text password.
 * @param {string} password
 * @returns {Promise<string>} Encoded string "pbkdf2:<salt_b64>:<hash_b64>"
 */
export async function hashPassword(password) {
  const salt       = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    PBKDF2_KEY_LEN * 8
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBits)));
  return `pbkdf2:${saltB64}:${hashB64}`;
}

/**
 * Verify a plain-text password against a stored hash string.
 * Uses a constant-time comparison to prevent timing attacks.
 * @param {string} password
 * @param {string} storedHash  The "pbkdf2:<salt>:<hash>" string from the DB.
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;

    const salt = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
    const expected = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const hashBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
      keyMaterial,
      PBKDF2_KEY_LEN * 8
    );
    const computed = new Uint8Array(hashBits);

    // Constant-time comparison
    if (computed.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Create a new session for a user and persist it to D1.
 * @param {D1Database} db
 * @param {number} userId
 * @returns {Promise<{ sessionId: string, expiresAt: string }>}
 */
export async function createSession(db, userId) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt).run();
  return { sessionId, expiresAt };
}

/**
 * Look up the session cookie from a request, validate it against D1,
 * and return the associated user row (without password_hash).
 * Returns null if the session is missing, expired, or invalid.
 * @param {D1Database} db
 * @param {Request} request
 * @returns {Promise<object|null>}
 */
export async function getSessionUser(db, request) {
  const sessionId = getCookieValue(request, COOKIE_NAME);
  if (!sessionId) return null;

  const row = await db.prepare(`
    SELECT u.id, u.username, u.email, u.display_name, u.description,
           u.avatar_url, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionId).first();

  return row || null;
}

/**
 * Delete a session from the database (used on logout).
 * @param {D1Database} db
 * @param {Request} request
 */
export async function deleteSession(db, request) {
  const sessionId = getCookieValue(request, COOKIE_NAME);
  if (!sessionId) return;
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/**
 * Build a Set-Cookie header string for a new session.
 * @param {string} sessionId
 * @param {string} expiresAt  ISO date string
 * @returns {string}
 */
export function setSessionCookie(sessionId, expiresAt) {
  const expires = new Date(expiresAt).toUTCString();
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires}`;
}

/**
 * Build a Set-Cookie header string that clears the session cookie.
 * @returns {string}
 */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/**
 * Parse a named cookie from the Cookie request header.
 * @param {Request} request
 * @param {string} name
 * @returns {string|null}
 */
function getCookieValue(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k.trim() === name) return v.join('=').trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Create a JSON response.
 * @param {object} data
 * @param {number} [status=200]
 * @param {Record<string,string>} [extraHeaders]
 */
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

/**
 * Create a JSON error response.
 * @param {string} message
 * @param {number} [status=400]
 * @param {object} [extra]  Additional fields merged into the error body.
 */
export function errorResponse(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a username: 3–40 chars, letters/numbers/underscores only.
 * @param {string} username
 * @returns {string|null}  Error message or null if valid.
 */
export function validateUsername(username) {
  if (typeof username !== 'string') return 'Username is required.';
  const u = username.trim();
  if (u.length < 3) return 'Username must be at least 3 characters.';
  if (u.length > 40) return 'Username must be at most 40 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Username may only contain letters, numbers, and underscores.';
  return null;
}

/**
 * Validate an email address (basic RFC 5321 sanity check).
 * @param {string} email
 * @returns {string|null}
 */
export function validateEmail(email) {
  if (typeof email !== 'string') return 'Email is required.';
  const e = email.trim();
  if (e.length > 254) return 'Email address is too long.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Please enter a valid email address.';
  return null;
}

/**
 * Validate a password: at least 8 characters.
 * @param {string} password
 * @returns {string|null}
 */
export function validatePassword(password) {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 1024) return 'Password is too long.';
  return null;
}

/**
 * Strip leading/trailing whitespace and limit a string's length.
 * @param {*} value
 * @param {number} maxLen
 * @returns {string}
 */
export function sanitizeString(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/**
 * Serialise a user row for safe public consumption (no email, no hash).
 * @param {object} user  Raw DB row.
 * @returns {object}
 */
export function publicUser(user) {
  return {
    id:           user.id,
    username:     user.username,
    display_name: user.display_name || user.username,
    description:  user.description  || '',
    avatar_url:   user.avatar_url   || '',
    created_at:   user.created_at
  };
}
