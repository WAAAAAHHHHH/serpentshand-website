/**
 * /api/messages/[id]/reply — website/functions mirror
 *
 * POST — Add a reply to an existing thread. Auth required.
 * This mirrors functions/api/messages/[id]/reply.js (project root).
 *
 * NOTE: The relative import path for _auth.js must navigate from
 * website/functions/api/messages/[id]/ up to functions/_auth.js.
 * Cloudflare Pages resolves module imports relative to the function file.
 * Since this mirror may not be invoked in production (the root functions/
 * directory takes precedence), this file is kept for completeness.
 */

import {
  getSessionUser,
  errorResponse,
  sanitizeString,
} from '../../../../_auth.js';

export async function onRequestPost(context) {
  try {
    const db       = context.env.DB;
    const threadId = context.params.id;

    const user = await getSessionUser(db, context.request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'You must be logged in to reply.', loginRequired: true }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    let data;
    try { data = await context.request.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = sanitizeString(data.body, 400);
    if (!body) {
      return new Response(JSON.stringify({ error: 'Reply body is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const existing = await db.prepare('SELECT replies FROM messages WHERE id = ?').bind(threadId).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Thread not found.' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    let replies = [];
    try { if (existing.replies) replies = JSON.parse(existing.replies); } catch {}

    const displayName = user.display_name || user.username;
    const newReply = {
      name:   displayName,
      body,
      time:   Date.now(),
      author: { id: user.id, username: user.username, display_name: displayName, avatar_url: user.avatar_url || '' },
    };

    replies.push(newReply);
    const info = await db.prepare('UPDATE messages SET replies = ? WHERE id = ?')
      .bind(JSON.stringify(replies), threadId).run();

    if (!info.success) throw new Error('Database update failed');

    return new Response(JSON.stringify({ success: true, reply: newReply }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to post reply. Please try again later.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
