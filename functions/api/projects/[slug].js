import {
  getSessionUser,
  errorResponse,
  sanitizeString,
  jsonResponse,
} from '../../_auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const slug = context.params.slug;

    const project = await db.prepare(`
      SELECT p.*, u.username as owner_username, u.display_name as owner_display_name, u.avatar_url as owner_avatar
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      WHERE p.slug = ?
    `).bind(slug).first();

    if (!project) return errorResponse('Project not found.', 404);

    const projectId = project.id;

    // Fetch related data concurrently
    const [
      membersRes,
      updatesRes,
      galleryRes,
      downloadsRes,
      roadmapRes
    ] = await Promise.all([
      db.prepare(`
        SELECT pm.role, u.id, u.username, u.display_name, u.avatar_url
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ?
      `).bind(projectId).all(),
      db.prepare(`SELECT * FROM project_updates WHERE project_id = ? ORDER BY created_at DESC`).bind(projectId).all(),
      db.prepare(`SELECT * FROM project_gallery WHERE project_id = ? ORDER BY display_order ASC, created_at ASC`).bind(projectId).all(),
      db.prepare(`SELECT * FROM project_downloads WHERE project_id = ? ORDER BY created_at DESC`).bind(projectId).all(),
      db.prepare(`SELECT * FROM project_roadmap WHERE project_id = ? ORDER BY created_at ASC`).bind(projectId).all()
    ]);

    return jsonResponse({
      ...project,
      members: membersRes.results,
      updates: updatesRes.results,
      gallery: galleryRes.results,
      downloads: downloadsRes.results,
      roadmap: roadmapRes.results
    });
  } catch (error) {
    console.error('GET /api/projects/[slug] error:', error);
    return errorResponse(`Failed to fetch project: ${error.message}`, 500);
  }
}

export async function onRequestPut(context) {
  try {
    const db = context.env.DB;
    const slug = context.params.slug;
    const user = await getSessionUser(db, context.request);

    if (!user) return errorResponse('Unauthorized', 401);

    const project = await db.prepare('SELECT id, owner_id FROM projects WHERE slug = ?').bind(slug).first();
    if (!project) return errorResponse('Project not found', 404);
    if (project.owner_id !== user.id) return errorResponse('Forbidden: Only owner can update.', 403);

    let data;
    try {
      data = await context.request.json();
    } catch {
      return errorResponse('Invalid JSON body.');
    }

    const title = sanitizeString(data.title, 100);
    const descShort = sanitizeString(data.description_short, 250);
    const descFull = sanitizeString(data.description_full, 5000);
    const category = sanitizeString(data.category, 50);
    const bannerUrl = sanitizeString(data.banner_url, 1024);
    const iconUrl = sanitizeString(data.icon_url, 1024);
    const tags = sanitizeString(data.tags, 250);
    const status = sanitizeString(data.status, 50);
    let progress = parseInt(data.progress, 10);
    if (isNaN(progress)) progress = 0;
    if (progress < 0) progress = 0;
    if (progress > 100) progress = 100;
    const visibility = sanitizeString(data.visibility, 20) || 'public';

    await db.prepare(`
      UPDATE projects SET 
        title = ?, description_short = ?, description_full = ?, category = ?, 
        banner_url = ?, icon_url = ?, tags = ?, status = ?, progress = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      title, descShort, descFull, category, bannerUrl, iconUrl, tags, status, progress, visibility, project.id
    ).run();

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('PUT /api/projects/[slug] error:', error);
    return errorResponse(`Failed to update project: ${error.message}`, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;
    const slug = context.params.slug;
    const user = await getSessionUser(db, context.request);

    if (!user) return errorResponse('Unauthorized', 401);

    const project = await db.prepare('SELECT id, owner_id FROM projects WHERE slug = ?').bind(slug).first();
    if (!project) return errorResponse('Project not found', 404);
    if (project.owner_id !== user.id) return errorResponse('Forbidden: Only owner can delete.', 403);

    await db.prepare('DELETE FROM projects WHERE id = ?').bind(project.id).run();

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[slug] error:', error);
    return errorResponse(`Failed to delete project: ${error.message}`, 500);
  }
}
