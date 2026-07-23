/**
 * POST /api/auth/logout
 *
 * Invalidate the current session. Deletes the session row from D1 and
 * clears the session cookie from the browser.
 *
 * Response:
 *   200 { success: true }
 */

import {
  deleteSession,
  clearSessionCookie,
  jsonResponse,
  errorResponse,
} from '../../_auth.js';

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) return errorResponse('Database binding not found.', 500);

  try {
    await deleteSession(db, context.request);
  } catch (err) {
    // Even if deletion fails (e.g. session already gone), we still clear
    // the cookie so the browser considers itself logged out.
    console.error('Session deletion error:', err);
  }

  return jsonResponse({ success: true }, 200, {
    'Set-Cookie': clearSessionCookie(),
  });
}
