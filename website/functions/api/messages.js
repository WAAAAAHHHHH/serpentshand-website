/**
 * Cloudflare Pages Function for the global forum ("The Reading Room").
 * Requires a D1 Database binding named `DB`.
 *
 * GET  — public, returns all threads with author info attached.
 * POST — requires an authenticated user (guests may read but not post).
 */
import { json, getSessionUser, sanitizeText } from './_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    // LEFT JOIN so legacy/guest rows without a user_id still render fine.
    const { results } = await db
      .prepare(
        `SELECT m.*, u.username AS author_username, u.display_name AS author_display_name,
                u.avatar_url AS author_avatar_url
         FROM messages m
         LEFT JOIN users u ON u.id = m.user_id
         ORDER BY m.created_at DESC`
      )
      .all();

    const threads = results.map((row) => {
      let replies = [];
      try {
        if (row.replies) replies = JSON.parse(row.replies);
      } catch (e) {
        console.error('Failed to parse replies for row', row.id, e);
      }

      return {
        id: row.id,
        subject: row.subject,
        body: row.entry,
        time: new Date(row.created_at).getTime(),
        updated: row.updated_at ? new Date(row.updated_at).getTime() : null,
        replies,
        author: {
          id: row.user_id || null,
          username: row.author_username || null,
          display_name: row.author_display_name || row.name || 'Anonymous',
          avatar_url: row.author_avatar_url || null
        }
      };
    });

    return json(threads);
  } catch (error) {
    console.error('GET /api/messages error:', error);
    return json({ error: `Failed to fetch messages: ${error.message}` }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    const currentUser = await getSessionUser(context.request, db);
    if (!currentUser) {
      return json({ error: 'You must be signed in to leave an entry.' }, 401);
    }

    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const subject = sanitizeText(data.subject, 80);
    const entry = sanitizeText(data.body, 600);

    if (!subject || !entry) {
      return json({ error: 'Subject and entry are required.' }, 400);
    }

    // SECURITY: the author name is derived ONLY from the authenticated
    // session (currentUser), never from the request body. Even if a
    // client sends a `name`/`display_name` field in the JSON payload,
    // it is silently ignored — this is what prevents one user from
    // impersonating another by typing an arbitrary name.
    const emptyReplies = JSON.stringify([]);
    const displayName = (currentUser.display_name || currentUser.username).substring(0, 40);

    // Prepared statement — safe from SQL injection. `name` is kept for
    // backwards compatibility with older rows/readers; user_id is the
    // source of truth for ownership going forward.
    const info = await db
      .prepare('INSERT INTO messages (name, replies, subject, entry, user_id) VALUES (?, ?, ?, ?, ?)')
      .bind(displayName, emptyReplies, subject, entry, currentUser.id)
      .run();

    if (!info.success) throw new Error('Database insert failed');

    return json(
      {
        success: true,
        thread: {
          id: info.meta?.last_row_id || `temp-${Date.now()}`,
          subject,
          body: entry,
          time: Date.now(),
          updated: null,
          replies: [],
          author: {
            id: currentUser.id,
            username: currentUser.username,
            display_name: displayName,
            avatar_url: currentUser.avatar_url || null
          }
        }
      },
      201
    );
  } catch (error) {
    console.error('POST /api/messages error:', error);
    return json({ error: `Failed to create message: ${error.message}` }, 500);
  }
}
