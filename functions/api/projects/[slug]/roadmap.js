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
    
    if (project.owner_id !== user.id) return errorResponse('Forbidden: Only owner can add roadmap items.', 403);

    let data;
    try {
      data = await context.request.json();
    } catch {
      return errorResponse('Invalid JSON body.');
    }

    const title = sanitizeString(data.title, 100);
    const description = sanitizeString(data.description, 500);
    const status = sanitizeString(data.status, 50) || 'Planned';

    if (!title) return errorResponse('Title is required.');

    const info = await db.prepare(`
      INSERT INTO project_roadmap (project_id, title, description, status)
      VALUES (?, ?, ?, ?)
    `).bind(project.id, title, description, status).run();

    if (!info.success) throw new Error('Database insert failed');

    return jsonResponse({
      success: true,
      id: info.meta.last_row_id
    }, 201);
  } catch (error) {
    console.error('POST /api/projects/[slug]/roadmap error:', error);
    return errorResponse(`Failed to add roadmap item: ${error.message}`, 500);
  }
}
