/**
 * /api/messages
 *
 * GET  — Fetch all forum threads, joined with user profile data.
 *         Guests may read; no session required.
 * POST — Create a new thread. Requires a valid session.
 *
 * Requires a D1 Database binding named `DB`.
 */

import {
  getSessionUser,
  errorResponse,
  sanitizeString,
} from '../_auth.js';

// ---------------------------------------------------------------------------
// GET /api/messages
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    // LEFT JOIN with users so anonymous legacy posts (user_id IS NULL) still appear.
    const { results } = await db.prepare(`
      SELECT
        m.id,
        m.name,
        m.subject,
        m.entry,
        m.replies,
        m.created_at,
        m.user_id,
        u.username        AS user_username,
        u.display_name    AS user_display_name,
        u.avatar_url      AS user_avatar_url
      FROM messages m
      LEFT JOIN users u ON u.id = m.user_id
      ORDER BY m.created_at DESC
    `).all();

    const threads = results.map(row => {
      let replies = [];
      try {
        if (row.replies) replies = JSON.parse(row.replies);
      } catch (e) {
        console.error('Failed to parse replies for row', row.id, e);
      }

      return {
        id:      row.id,
        // Display name falls back through: display_name → username → stored name → 'Anonymous'
        name:    row.user_display_name || row.user_username || row.name || 'Anonymous',
        subject: row.subject,
        body:    row.entry,
        time:    new Date(row.created_at).getTime(),
        replies,
        // Author info for the frontend to render avatars and action buttons
        author: row.user_id ? {
          id:           row.user_id,
          username:     row.user_username,
          display_name: row.user_display_name || row.user_username,
          avatar_url:   row.user_avatar_url || '',
        } : null,
      };
    });

    return new Response(JSON.stringify(threads), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('GET /api/messages error:', error);
    return new Response(JSON.stringify({ error: `Failed to fetch threads: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ---------------------------------------------------------------------------
// POST /api/messages
// ---------------------------------------------------------------------------
export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return errorResponse('Database binding not found.', 500);

    // Authentication required to post
    const user = await getSessionUser(db, context.request);
    if (!user) {
      return errorResponse('You must be logged in to post.', 401, { loginRequired: true });
    }

    let data;
    try {
      data = await context.request.json();
    } catch {
      return errorResponse('Invalid JSON body.');
    }

    const subject = sanitizeString(data.subject, 80);
    const entry   = sanitizeString(data.body,    600);

    if (!subject) return errorResponse('Subject is required.');
    if (!entry)   return errorResponse('Entry body is required.');

    const displayName  = user.display_name || user.username;
    const emptyReplies = JSON.stringify([]);

    const info = await db.prepare(
      'INSERT INTO messages (name, replies, subject, entry, user_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(displayName, emptyReplies, subject, entry, user.id).run();

    if (!info.success) throw new Error('Database insert failed');

    const createdId = info.meta?.last_row_id || `temp-${Date.now()}`;

    return new Response(JSON.stringify({
      success: true,
      thread: {
        id:      createdId,
        name:    displayName,
        subject,
        body:    entry,
        time:    Date.now(),
        replies: [],
        author: {
          id:           user.id,
          username:     user.username,
          display_name: displayName,
          avatar_url:   user.avatar_url || '',
        },
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('POST /api/messages error:', error);
    return new Response(JSON.stringify({ error: `Failed to create thread: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
