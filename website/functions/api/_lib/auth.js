/**
 * Shared helpers for the auth & profile system.
 *
 * This file lives under an underscore-prefixed folder ("_lib") so
 * Cloudflare Pages Functions does NOT treat it as a routable endpoint —
 * it's only imported by the real route handlers.
 *
 * Nothing in here reads secrets from source; the only "secret" values
 * (session tokens, password hashes) are generated at runtime using the
 * Web Crypto API, which is available in the Cloudflare Workers runtime
 * that powers Pages Functions.
 */

export const SESSION_COOKIE_NAME = 'sh_session';
export const SESSION_DURATION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Generic response helpers                                           */
/* ------------------------------------------------------------------ */

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function serializeCookie(name, value, options = {}) {
  const {
    maxAge,
    expires,
    httpOnly = true,
    secure = true,
    sameSite = 'Lax',
    path = '/'
  } = options;

  let str = `${name}=${encodeURIComponent(value)}; Path=${path}`;
  if (maxAge !== undefined) str += `; Max-Age=${maxAge}`;
  if (expires) str += `; Expires=${expires.toUTCString()}`;
  if (httpOnly) str += '; HttpOnly';
  if (secure) str += '; Secure';
  if (sameSite) str += `; SameSite=${sameSite}`;
  return str;
}

/* ------------------------------------------------------------------ */
/* Password hashing (PBKDF2-SHA256 via Web Crypto — no dependencies)  */
/* ------------------------------------------------------------------ */

function bufferToHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function deriveBits(password, salt, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
}

/** Returns a self-describing hash string: pbkdf2$<iterations>$<saltHex>$<hashHex> */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufferToHex(salt)}$${bufferToHex(bits)}`;
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBuffer(parts[2]);
  const expectedHex = parts[3];
  const bits = await deriveBits(password, salt, iterations);
  return timingSafeEqualHex(bufferToHex(bits), expectedHex);
}

/* ------------------------------------------------------------------ */
/* Random ID generation                                                */
/* ------------------------------------------------------------------ */

export function generateId(byteLength = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(byteLength));
  return bufferToHex(arr);
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export async function createSession(db, userId) {
  const sessionId = generateId(32);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt.toISOString())
    .run();
  return { sessionId, expiresAt };
}

/**
 * Reads the session cookie from the request, validates it against the DB,
 * and returns the associated user row (or null if missing/expired/invalid).
 * Expired sessions are lazily deleted.
 */
export async function getSessionUser(request, db) {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) return null;

  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.email, u.display_name, u.description,
              u.avatar_url, u.is_admin, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .bind(sessionId)
    .first();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }

  return row;
}

export function authCookieHeader(sessionId, expiresAt) {
  return serializeCookie(SESSION_COOKIE_NAME, sessionId, {
    expires: expiresAt,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  });
}

export function clearAuthCookieHeader() {
  return serializeCookie(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  });
}

/* ------------------------------------------------------------------ */
/* Validation / sanitization                                          */
/* ------------------------------------------------------------------ */

export function isValidUsername(value) {
  return typeof value === 'string' && USERNAME_RE.test(value);
}

export function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

/** Trims and length-limits a string; returns '' for non-strings. Used
 * everywhere user input touches SQL or HTML output to keep values bounded.
 * All DB access still goes through prepared statements regardless. */
export function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/* ------------------------------------------------------------------ */
/* User shape helpers — never leak password_hash                      */
/* ------------------------------------------------------------------ */

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    description: user.description || '',
    avatar_url: user.avatar_url || null,
    is_admin: !!user.is_admin,
    created_at: user.created_at
  };
}

/** Same as publicUser but includes the user's own email — only ever
 * return this to the user themselves (e.g. /api/auth/me). */
export function privateUser(user) {
  const base = publicUser(user);
  if (!base) return null;
  return { ...base, email: user.email };
}
