import {
  getSessionUser,
  errorResponse,
  sanitizeString,
  jsonResponse,
} from '../../../_auth.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const slug = context.params.slug;
    const user = await getSessionUser(db, context.request);

    if (!user) return errorResponse('Unauthorized', 401);

    const project = await db.prepare('SELECT id, owner_id FROM projects WHERE slug = ?').bind(slug).first();
    if (!project) return errorResponse('Project not found', 404);
    
    // Check if user is owner or has proper role (for simplicity, just check owner for now)
    if (project.owner_id !== user.id) return errorResponse('Forbidden: Only owner can post updates.', 403);

    let data;
    try {
      data = await context.request.json();
    } catch {
      return errorResponse('Invalid JSON body.');
    }

    const title = sanitizeString(data.title, 200);
    const content = sanitizeString(data.content, 10000);
    const imageUrl = sanitizeString(data.image_url, 1024);

    if (!title || !content) return errorResponse('Title and content are required.');

    const info = await db.prepare(`
      INSERT INTO project_updates (project_id, title, content, image_url)
      VALUES (?, ?, ?, ?)
    `).bind(project.id, title, content, imageUrl).run();

    if (!info.success) throw new Error('Database insert failed');

    return jsonResponse({
      success: true,
      id: info.meta.last_row_id
    }, 201);
  } catch (error) {
    console.error('POST /api/projects/[slug]/updates error:', error);
    return errorResponse(`Failed to post update: ${error.message}`, 500);
  }
}
