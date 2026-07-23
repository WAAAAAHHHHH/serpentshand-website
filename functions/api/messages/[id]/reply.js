/**
 * /api/messages/[id]/reply
 *
 * POST — Add a reply to an existing thread. Requires a valid session.
 *
 * Replies are stored as a JSON array in the messages.replies column.
 * Each reply object includes author info so the frontend can render it.
 *
 * Requires a D1 Database binding named `DB`.
 */

import {
  getSessionUser,
  errorResponse,
  sanitizeString,
} from '../../../_auth.js';

export async function onRequestPost(context) {
  try {
    const db       = context.env.DB;
    const threadId = context.params.id;

    // Authentication required to reply
    const user = await getSessionUser(db, context.request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'You must be logged in to reply.', loginRequired: true }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let data;
    try {
      data = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = sanitizeString(data.body, 400);
    if (!body) {
      return new Response(JSON.stringify({ error: 'Reply body is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch existing thread
    const existing = await db.prepare(
      'SELECT replies FROM messages WHERE id = ?'
    ).bind(threadId).first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Thread not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let replies = [];
    try {
      if (existing.replies) replies = JSON.parse(existing.replies);
    } catch {
      console.error('Failed to parse existing replies, initializing as empty array.');
    }

    const displayName = user.display_name || user.username;
    const newReply = {
      name:       displayName,
      body,
      time:       Date.now(),
      // Author info embedded in the reply JSON blob
      author: {
        id:           user.id,
        username:     user.username,
        display_name: displayName,
        avatar_url:   user.avatar_url || '',
      }
    };

    replies.push(newReply);

    const info = await db.prepare(
      'UPDATE messages SET replies = ? WHERE id = ?'
    ).bind(JSON.stringify(replies), threadId).run();

    if (!info.success) throw new Error('Database update failed');

    return new Response(JSON.stringify({ success: true, reply: newReply }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('POST /api/messages/[id]/reply error:', error);
    return new Response(JSON.stringify({ error: 'Failed to post reply. Please try again later.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
