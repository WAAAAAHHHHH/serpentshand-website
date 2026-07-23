/**
 * POST /api/auth/register
 * Body: { username, email, password, display_name? }
 * Creates a new user, starts a session, and sets the session cookie.
 */
import {
  json,
  sanitizeText,
  isValidUsername,
  isValidEmail,
  hashPassword,
  createSession,
  authCookieHeader,
  privateUser
} from '../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const username = sanitizeText(data.username, 20);
    const email = sanitizeText(data.email, 254).toLowerCase();
    const password = typeof data.password === 'string' ? data.password : '';
    const displayName = sanitizeText(data.display_name, 60) || username;

    if (!isValidUsername(username)) {
      return json(
        { error: 'Username must be 3-20 characters: letters, numbers, and underscores only.' },
        400
      );
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Please provide a valid email address.' }, 400);
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400);
    }
    if (password.length > 200) {
      return json({ error: 'Password is too long.' }, 400);
    }

    // Prepared statement — safe from SQL injection.
    const existing = await db
      .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
      .bind(username, email)
      .first();

    if (existing) {
      return json({ error: 'That username or email is already taken.' }, 409);
    }

    const passwordHash = await hashPassword(password);

    const info = await db
      .prepare(
        'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
      )
      .bind(username, email, passwordHash, displayName)
      .run();

    const userId = info.meta && info.meta.last_row_id;
    if (!userId) throw new Error('Failed to determine new user id.');

    const { sessionId, expiresAt } = await createSession(db, userId);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

    return json(
      { success: true, user: privateUser(user) },
      201,
      { 'Set-Cookie': authCookieHeader(sessionId, expiresAt) }
    );
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return json({ error: 'Failed to register. Please try again later.' }, 500);
  }
}
