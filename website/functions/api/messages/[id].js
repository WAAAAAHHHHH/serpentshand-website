/**
 * PATCH  /api/messages/:id — edit a thread's subject/entry (owner or admin only)
 * DELETE /api/messages/:id — delete a thread (owner or admin only)
 * Requires a D1 Database binding named `DB`.
 */
import { json, getSessionUser, sanitizeText } from '../_lib/auth.js';

export async function onRequestPatch(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    const currentUser = await getSessionUser(context.request, db);
    if (!currentUser) return json({ error: 'You must be signed in.' }, 401);

    const id = context.params.id;
    const existing = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Entry not found.' }, 404);

    if (existing.user_id !== currentUser.id && !currentUser.is_admin) {
      return json({ error: 'You can only edit your own entries.' }, 403);
    }

    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const subject = sanitizeText(data.subject, 80);
    const entry = sanitizeText(data.body, 600);
    if (!subject || !entry) return json({ error: 'Subject and entry are required.' }, 400);

    await db
      .prepare('UPDATE messages SET subject = ?, entry = ?, updated_at = ? WHERE id = ?')
      .bind(subject, entry, new Date().toISOString(), id)
      .run();

    return json({ success: true, thread: { id, subject, body: entry } });
  } catch (error) {
    console.error('PATCH /api/messages/[id] error:', error);
    return json({ error: 'Failed to update entry.' }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    const currentUser = await getSessionUser(context.request, db);
    if (!currentUser) return json({ error: 'You must be signed in.' }, 401);

    const id = context.params.id;
    const existing = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Entry not found.' }, 404);

    if (existing.user_id !== currentUser.id && !currentUser.is_admin) {
      return json({ error: 'You can only delete your own entries.' }, 403);
    }

    await db.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
    return json({ success: true });
  } catch (error) {
    console.error('DELETE /api/messages/[id] error:', error);
    return json({ error: 'Failed to delete entry.' }, 500);
  }
}
