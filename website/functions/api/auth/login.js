/**
 * POST /api/auth/login
 * Body: { identifier, password }  — identifier is a username OR email.
 * Verifies credentials, starts a session, and sets the session cookie.
 */
import {
  json,
  sanitizeText,
  verifyPassword,
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

    const identifier = sanitizeText(data.identifier, 254).toLowerCase();
    const password = typeof data.password === 'string' ? data.password : '';

    if (!identifier || !password) {
      return json({ error: 'Username/email and password are required.' }, 400);
    }

    // Prepared statement — safe from SQL injection.
    const user = await db
      .prepare('SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?')
      .bind(identifier, identifier)
      .first();

    // Use a generic error message so we don't reveal which accounts exist.
    const genericError = 'Invalid username/email or password.';

    if (!user) {
      return json({ error: genericError }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return json({ error: genericError }, 401);
    }

    const { sessionId, expiresAt } = await createSession(db, user.id);

    return json(
      { success: true, user: privateUser(user) },
      200,
      { 'Set-Cookie': authCookieHeader(sessionId, expiresAt) }
    );
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return json({ error: 'Failed to log in. Please try again later.' }, 500);
  }
}
