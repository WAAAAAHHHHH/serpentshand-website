/**
 * GET /api/profile/:username
 * Public profile info + forum post count. No auth required to view.
 */
import { json, publicUser } from '../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    const username = context.params.username;

    const user = await db
      .prepare(
        'SELECT id, username, display_name, description, avatar_url, is_admin, created_at FROM users WHERE username = ?'
      )
      .bind(username)
      .first();

    if (!user) return json({ error: 'User not found.' }, 404);

    const postCountRow = await db
      .prepare('SELECT COUNT(*) as count FROM messages WHERE user_id = ?')
      .bind(user.id)
      .first();

    return json({ user: publicUser(user), post_count: (postCountRow && postCountRow.count) || 0 });
  } catch (error) {
    console.error('GET /api/profile/[username] error:', error);
    return json({ error: 'Failed to load profile.' }, 500);
  }
}
