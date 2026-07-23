/**
 * /api/messages — website/functions mirror
 *
 * This file mirrors functions/api/messages.js at the root level.
 * Cloudflare Pages serves from the functions/ directory at the project root.
 * This copy exists for completeness; the root-level file is authoritative.
 *
 * GET  — Fetch all forum threads (with author info). No auth required.
 * POST — Create a new thread. Auth required.
 */

import {
  getSessionUser,
  errorResponse,
  sanitizeString,
} from '../../../_auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    const { results } = await db.prepare(`
      SELECT
        m.id, m.name, m.subject, m.entry, m.replies, m.created_at, m.user_id,
        u.username AS user_username,
        u.display_name AS user_display_name,
        u.avatar_url AS user_avatar_url
      FROM messages m
      LEFT JOIN users u ON u.id = m.user_id
      ORDER BY m.created_at DESC
    `).all();

    const threads = results.map(row => {
      let replies = [];
      try { if (row.replies) replies = JSON.parse(row.replies); } catch (e) {}
      return {
        id:      row.id,
        name:    row.user_display_name || row.user_username || row.name || 'Anonymous',
        subject: row.subject,
        body:    row.entry,
        time:    new Date(row.created_at).getTime(),
        replies,
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
    return new Response(JSON.stringify({ error: `Failed to fetch messages: ${error.message}` }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return errorResponse('Database binding not found.', 500);

    const user = await getSessionUser(db, context.request);
    if (!user) return errorResponse('You must be logged in to post.', 401, { loginRequired: true });

    let data;
    try { data = await context.request.json(); } catch {
      return errorResponse('Invalid JSON body.');
    }

    const subject = sanitizeString(data.subject, 80);
    const entry   = sanitizeString(data.body, 600);
    if (!subject) return errorResponse('Subject is required.');
    if (!entry)   return errorResponse('Entry body is required.');

    const displayName = user.display_name || user.username;
    const info = await db.prepare(
      'INSERT INTO messages (name, replies, subject, entry, user_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(displayName, JSON.stringify([]), subject, entry, user.id).run();

    if (!info.success) throw new Error('Database insert failed');

    return new Response(JSON.stringify({
      success: true,
      thread: {
        id: info.meta?.last_row_id || `temp-${Date.now()}`,
        name: displayName, subject, body: entry, time: Date.now(), replies: [],
        author: { id: user.id, username: user.username, display_name: displayName, avatar_url: user.avatar_url || '' },
      }
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: `Failed to create message: ${error.message}` }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
