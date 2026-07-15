/**
 * POST /api/messages/:id/reply
 * Requires an authenticated user (guests may read but not reply).
 * Requires a D1 Database binding named `DB`.
 */
import { json, getSessionUser, sanitizeText } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    const currentUser = await getSessionUser(context.request, db);
    if (!currentUser) return json({ error: 'You must be signed in to reply.' }, 401);

    const threadId = context.params.id;

    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const body = sanitizeText(data.body, 400);
    if (!body) return json({ error: 'Reply body is required.' }, 400);

    const existing = await db.prepare('SELECT replies FROM messages WHERE id = ?').bind(threadId).first();
    if (!existing) return json({ error: 'Thread not found.' }, 404);

    let replies = [];
    try {
      if (existing.replies) replies = JSON.parse(existing.replies);
    } catch (e) {
      console.error('Failed to parse existing replies, initializing as empty array.', e);
    }

    // SECURITY: same as thread creation — the reply's author identity
    // comes only from currentUser (the authenticated session). Any
    // name/author field in the request body, if present, is ignored.
    const displayName = (currentUser.display_name || currentUser.username).substring(0, 40);
    const newReply = {
      body,
      time: Date.now(),
      author: {
        id: currentUser.id,
        username: currentUser.username,
        display_name: displayName,
        avatar_url: currentUser.avatar_url || null
      }
    };

    replies.push(newReply);

    const info = await db
      .prepare('UPDATE messages SET replies = ? WHERE id = ?')
      .bind(JSON.stringify(replies), threadId)
      .run();

    if (!info.success) throw new Error('Database update failed');

    return json({ success: true, reply: newReply });
  } catch (error) {
    console.error('POST /api/messages/[id]/reply error:', error);
    return json({ error: 'Failed to post reply. Please try again later.' }, 500);
  }
}
