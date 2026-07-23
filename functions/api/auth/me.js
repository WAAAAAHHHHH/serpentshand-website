/**
 * GET /api/auth/me
 *
 * Return the currently authenticated user's public profile, or 401 if
 * the session cookie is missing / expired / invalid.
 *
 * This endpoint is called by the frontend on every page load to hydrate
 * the navigation bar and decide which UI controls to display.
 *
 * Response:
 *   200 { user: { id, username, display_name, description, avatar_url, created_at } }
 *   401 { error: "Not authenticated." }
 */

import {
  getSessionUser,
  jsonResponse,
  errorResponse,
  publicUser,
} from '../../_auth.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) return errorResponse('Database binding not found.', 500);

  const user = await getSessionUser(db, context.request);
  if (!user) return errorResponse('Not authenticated.', 401);

  // Also return the user's post count for the profile page.
  const countRow = await db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE user_id = ?'
  ).bind(user.id).first();

  return jsonResponse({
    user: {
      ...publicUser(user),
      email:      user.email, // include email for the profile/settings page only
      post_count: countRow?.count ?? 0,
    }
  });
}
