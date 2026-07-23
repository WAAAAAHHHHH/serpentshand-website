/**
 * POST /api/auth/logout
 * Deletes the current session (if any) and clears the cookie.
 */
import { json, getCookie, SESSION_COOKIE_NAME, clearAuthCookieHeader } from '../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const sessionId = getCookie(context.request, SESSION_COOKIE_NAME);

    if (sessionId && db) {
      await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    }

    return json({ success: true }, 200, { 'Set-Cookie': clearAuthCookieHeader() });
  } catch (error) {
    console.error('POST /api/auth/logout error:', error);
    // Still clear the cookie client-side even if the DB call failed.
    return json({ success: true }, 200, { 'Set-Cookie': clearAuthCookieHeader() });
  }
}
