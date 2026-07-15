/**
 * GET /api/auth/me
 * Returns the currently authenticated user (or { user: null } for guests).
 * Also includes the user's forum post count for the profile dashboard.
 */
import { json, getSessionUser, privateUser } from '../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ user: null });

    const user = await getSessionUser(context.request, db);
    if (!user) return json({ user: null });

    const postCountRow = await db
      .prepare('SELECT COUNT(*) as count FROM messages WHERE user_id = ?')
      .bind(user.id)
      .first();

    return json({
      user: { ...privateUser(user), post_count: (postCountRow && postCountRow.count) || 0 }
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return json({ user: null });
  }
}
