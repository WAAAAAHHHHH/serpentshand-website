/**
 * POST /api/profile/update
 * Auth required. Body may include any of:
 *   { display_name, username, description, avatar_url }
 * Only the fields present in the body are updated.
 */
import {
  json,
  getSessionUser,
  sanitizeText,
  isValidUsername,
  privateUser
} from '../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    const currentUser = await getSessionUser(context.request, db);
    if (!currentUser) return json({ error: 'You must be signed in.' }, 401);

    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    // Whitelisted columns only — keys are never derived from user input,
    // so this can't be used to inject arbitrary column names.
    const updates = {};

    if (data.display_name !== undefined) {
      updates.display_name = sanitizeText(data.display_name, 60) || currentUser.username;
    }

    if (data.description !== undefined) {
      updates.description = sanitizeText(data.description, 500);
    }

    if (data.avatar_url !== undefined) {
      const url = sanitizeText(data.avatar_url, 500);
      if (url && !/^https:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url)) {
        return json(
          { error: 'Avatar URL must be a valid https:// link to a png, jpg, gif, or webp image.' },
          400
        );
      }
      updates.avatar_url = url || null;
    }

    if (data.username !== undefined) {
      const newUsername = sanitizeText(data.username, 20);
      if (!isValidUsername(newUsername)) {
        return json(
          { error: 'Username must be 3-20 characters: letters, numbers, and underscores only.' },
          400
        );
      }
      if (newUsername !== currentUser.username) {
        const taken = await db
          .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
          .bind(newUsername, currentUser.id)
          .first();
        if (taken) return json({ error: 'That username is already taken.' }, 409);
        updates.username = newUsername;
      }
    }

    const keys = Object.keys(updates);
    if (!keys.length) return json({ error: 'No changes provided.' }, 400);

    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => updates[k]);
    values.push(currentUser.id);

    await db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).bind(...values).run();

    const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(currentUser.id).first();
    return json({ success: true, user: privateUser(updated) });
  } catch (error) {
    console.error('POST /api/profile/update error:', error);
    return json({ error: 'Failed to update profile.' }, 500);
  }
}
