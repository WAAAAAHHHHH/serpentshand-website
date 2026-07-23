/**
 * POST /api/auth/register
 *
 * Register a new user account. On success, immediately creates a session
 * and sets the session cookie so the user is logged in straight away.
 *
 * Request body (JSON):
 *   { username, email, password }
 *
 * Response:
 *   201 { user: { id, username, display_name, avatar_url } }
 *   400 { error: "..." }
 *   409 { error: "...", field: "username"|"email" }
 *   500 { error: "..." }
 */

import {
  hashPassword,
  createSession,
  setSessionCookie,
  jsonResponse,
  errorResponse,
  validateUsername,
  validateEmail,
  validatePassword,
  sanitizeString,
  publicUser,
} from '../../_auth.js';

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) return errorResponse('Database binding not found.', 500);

  // --- Parse body ---
  let data;
  try {
    data = await context.request.json();
  } catch {
    return errorResponse('Invalid JSON body.');
  }

  const username = sanitizeString(data.username, 40);
  const email    = sanitizeString(data.email,    254).toLowerCase();
  const password = typeof data.password === 'string' ? data.password : '';

  // --- Validate fields ---
  const usernameErr = validateUsername(username);
  if (usernameErr) return errorResponse(usernameErr);

  const emailErr = validateEmail(email);
  if (emailErr) return errorResponse(emailErr);

  const passwordErr = validatePassword(password);
  if (passwordErr) return errorResponse(passwordErr);

  // --- Uniqueness check ---
  const existing = await db.prepare(
    'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1'
  ).bind(username, email).first();

  if (existing) {
    if (existing.username === username) {
      return errorResponse('That username is already taken.', 409, { field: 'username' });
    }
    return errorResponse('An account with that email already exists.', 409, { field: 'email' });
  }

  // --- Hash password and insert user ---
  let passwordHash;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    console.error('Password hashing failed:', err);
    return errorResponse('Registration failed. Please try again.', 500);
  }

  let userId;
  try {
    const result = await db.prepare(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
    ).bind(username, email, passwordHash, username).run();
    userId = result.meta?.last_row_id;
    if (!userId) throw new Error('No last_row_id returned');
  } catch (err) {
    console.error('User insert failed:', err);
    return errorResponse('Registration failed. Please try again.', 500);
  }

  // --- Create session ---
  const { sessionId, expiresAt } = await createSession(db, userId);

  // --- Fetch the new user row to return clean data ---
  const user = await db.prepare(
    'SELECT id, username, email, display_name, description, avatar_url, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  return jsonResponse({ user: publicUser(user) }, 201, {
    'Set-Cookie': setSessionCookie(sessionId, expiresAt),
  });
}
