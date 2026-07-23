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
    
    if (project.owner_id !== user.id) return errorResponse('Forbidden: Only owner can add images.', 403);

    let data;
    try {
      data = await context.request.json();
    } catch {
      return errorResponse('Invalid JSON body.');
    }

    const imageUrl = sanitizeString(data.image_url, 1024);
    const displayOrder = parseInt(data.display_order, 10) || 0;

    if (!imageUrl) return errorResponse('Image URL is required.');

    const info = await db.prepare(`
      INSERT INTO project_gallery (project_id, image_url, display_order)
      VALUES (?, ?, ?)
    `).bind(project.id, imageUrl, displayOrder).run();

    if (!info.success) throw new Error('Database insert failed');

    return jsonResponse({
      success: true,
      id: info.meta.last_row_id
    }, 201);
  } catch (error) {
    console.error('POST /api/projects/[slug]/gallery error:', error);
    return errorResponse(`Failed to add gallery image: ${error.message}`, 500);
  }
}
