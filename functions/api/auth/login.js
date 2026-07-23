/**
 * POST /api/auth/login
 *
 * Authenticate an existing user with email (or username) + password.
 * On success, creates a new session and sets the session cookie.
 *
 * Request body (JSON):
 *   { login, password }        — "login" is either an email or a username
 *
 * Response:
 *   200 { user: { id, username, display_name, avatar_url, created_at } }
 *   400 { error: "..." }
 *   401 { error: "Invalid credentials." }
 *   500 { error: "..." }
 */

import {
  verifyPassword,
  createSession,
  setSessionCookie,
  jsonResponse,
  errorResponse,
  sanitizeString,
  publicUser,
} from '../../_auth.js';

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) return errorResponse('Database binding not found.', 500);

  let data;
  try {
    data = await context.request.json();
  } catch {
    return errorResponse('Invalid JSON body.');
  }

  const login    = sanitizeString(data.login, 254);
  const password = typeof data.password === 'string' ? data.password : '';

  if (!login)    return errorResponse('Email or username is required.');
  if (!password) return errorResponse('Password is required.');

  // Accept either email or username as the login identifier.
  // Email addresses contain "@"; usernames do not.
  const isEmail = login.includes('@');
  const user = await db.prepare(
    isEmail
      ? 'SELECT * FROM users WHERE email = ? LIMIT 1'
      : 'SELECT * FROM users WHERE username = ? LIMIT 1'
  ).bind(isEmail ? login.toLowerCase() : login).first();

  // Always run verifyPassword even if user not found, to resist timing attacks.
  const dummyHash = 'pbkdf2:AAAA:AAAA';
  const valid = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, dummyHash).then(() => false);

  if (!user || !valid) {
    return errorResponse('Invalid credentials.', 401);
  }

  const { sessionId, expiresAt } = await createSession(db, user.id);

  return jsonResponse({ user: publicUser(user) }, 200, {
    'Set-Cookie': setSessionCookie(sessionId, expiresAt),
  });
}
