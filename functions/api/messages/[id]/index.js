/**
 * /api/messages/[id]
 *
 * PATCH  — Edit the body of a thread. Only the original author may do this.
 * DELETE — Delete a thread. Only the original author may do this.
 *          (Future: admins will be able to delete any thread.)
 *
 * Requires a D1 Database binding named `DB`.
 */

import {
  getSessionUser,
  errorResponse,
  jsonResponse,
  sanitizeString,
} from '../../../_auth.js';

// ---------------------------------------------------------------------------
// PATCH /api/messages/[id]  — Edit thread body
// ---------------------------------------------------------------------------
export async function onRequestPatch(context) {
  const db       = context.env.DB;
  const threadId = context.params.id;

  const user = await getSessionUser(db, context.request);
  if (!user) return errorResponse('Not authenticated.', 401);

  let data;
  try {
    data = await context.request.json();
  } catch {
    return errorResponse('Invalid JSON body.');
  }

  const newBody = sanitizeString(data.body, 600);
  if (!newBody) return errorResponse('Entry body is required.');

  // Verify ownership
  const thread = await db.prepare(
    'SELECT id, user_id FROM messages WHERE id = ?'
  ).bind(threadId).first();

  if (!thread) return errorResponse('Thread not found.', 404);

  // Future admin check: replace `false` with `user.is_admin` when the role
  // column is added to the users table.
  if (thread.user_id !== user.id) {
    return errorResponse('You can only edit your own posts.', 403);
  }

  await db.prepare(
    'UPDATE messages SET entry = ? WHERE id = ?'
  ).bind(newBody, threadId).run();

  return jsonResponse({ success: true, body: newBody });
}

// ---------------------------------------------------------------------------
// DELETE /api/messages/[id]  — Delete thread
// ---------------------------------------------------------------------------
export async function onRequestDelete(context) {
  const db       = context.env.DB;
  const threadId = context.params.id;

  const user = await getSessionUser(db, context.request);
  if (!user) return errorResponse('Not authenticated.', 401);

  const thread = await db.prepare(
    'SELECT id, user_id FROM messages WHERE id = ?'
  ).bind(threadId).first();

  if (!thread) return errorResponse('Thread not found.', 404);

  // Future admin check: replace `false` with `user.is_admin`
  if (thread.user_id !== user.id) {
    return errorResponse('You can only delete your own posts.', 403);
  }

  await db.prepare('DELETE FROM messages WHERE id = ?').bind(threadId).run();

  return jsonResponse({ success: true });
}
