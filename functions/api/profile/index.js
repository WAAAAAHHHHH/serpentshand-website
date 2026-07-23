/**
 * /api/profile
 *
 * GET  — Return the authenticated user's full profile (including email).
 * PATCH — Update profile fields: display_name, username, description, avatar_url.
 *
 * All routes require a valid session cookie.
 */

import {
  getSessionUser,
  jsonResponse,
  errorResponse,
  validateUsername,
  sanitizeString,
  publicUser,
} from '../../_auth.js';

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) return errorResponse('Database binding not found.', 500);

  const user = await getSessionUser(db, context.request);
  if (!user) return errorResponse('Not authenticated.', 401);

  const countRow = await db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE user_id = ?'
  ).bind(user.id).first();

  const { results: projects } = await db.prepare(
    'SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all();

  return jsonResponse({
    user: {
      ...publicUser(user),
      email:      user.email,
      post_count: countRow?.count ?? 0,
      projects:   projects || [],
    }
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/profile
// ---------------------------------------------------------------------------
export async function onRequestPatch(context) {
  const db = context.env.DB;
  if (!db) return errorResponse('Database binding not found.', 500);

  const user = await getSessionUser(db, context.request);
  if (!user) return errorResponse('Not authenticated.', 401);

  let data;
  try {
    data = await context.request.json();
  } catch {
    return errorResponse('Invalid JSON body.');
  }

  // Collect changes — only update fields that were actually sent.
  const updates = {};
  const errors  = {};

  // display_name (optional, up to 60 chars)
  if ('display_name' in data) {
    const dn = sanitizeString(data.display_name, 60);
    updates.display_name = dn || null;
  }

  // username (must remain unique)
  if ('username' in data) {
    const newUsername = sanitizeString(data.username, 40);
    const usernameErr = validateUsername(newUsername);
    if (usernameErr) {
      errors.username = usernameErr;
    } else if (newUsername !== user.username) {
      // Check uniqueness only if it's actually changing
      const clash = await db.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1'
      ).bind(newUsername, user.id).first();
      if (clash) {
        errors.username = 'That username is already taken.';
      } else {
        updates.username = newUsername;
      }
    }
  }

  // description (optional bio, up to 300 chars)
  if ('description' in data) {
    updates.description = sanitizeString(data.description, 300) || null;
  }

  // avatar_url (optional, up to 512 chars; basic URL check)
  if ('avatar_url' in data) {
    const url = sanitizeString(data.avatar_url, 512);
    if (url && !/^https?:\/\/.+/.test(url)) {
      errors.avatar_url = 'Avatar URL must start with http:// or https://';
    } else {
      updates.avatar_url = url || null;
    }
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse('Validation failed.', 400, { fields: errors });
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse('No valid fields to update.', 400);
  }

  // Build the SET clause dynamically
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values     = [...Object.values(updates), user.id];

  await db.prepare(
    `UPDATE users SET ${setClauses} WHERE id = ?`
  ).bind(...values).run();

  // Return the freshly-updated user row
  const updated = await db.prepare(
    'SELECT id, username, email, display_name, description, avatar_url, created_at FROM users WHERE id = ?'
  ).bind(user.id).first();

  const countRow = await db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE user_id = ?'
  ).bind(user.id).first();

  const { results: projects } = await db.prepare(
    'SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all();

  return jsonResponse({
    user: {
      ...publicUser(updated),
      email:      updated.email,
      post_count: countRow?.count ?? 0,
      projects:   projects || [],
    }
  });
}
