import {
  getSessionUser,
  errorResponse,
  sanitizeString,
  jsonResponse,
} from '../../_auth.js';

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const url = new URL(context.request.url);
    const query = url.searchParams.get('q');
    
    let sql = `
      SELECT p.*, u.username as owner_username, u.display_name as owner_display_name, u.avatar_url as owner_avatar
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      WHERE p.visibility = 'public'
    `;
    let params = [];

    if (query) {
      sql += ` AND (p.title LIKE ? OR p.description_short LIKE ? OR p.tags LIKE ? OR p.category LIKE ?)`;
      const likeQuery = `%${query}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    }
    
    sql += ` ORDER BY p.created_at DESC`;

    const { results } = await db.prepare(sql).bind(...params).all();
    
    return jsonResponse(results);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return errorResponse(`Failed to fetch projects: ${error.message}`, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return errorResponse('Database binding not found.', 500);

    const user = await getSessionUser(db, context.request);
    if (!user) {
      return errorResponse('You must be logged in to create a project.', 401, { loginRequired: true });
    }

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
    const visibility = sanitizeString(data.visibility, 20) || 'public';

    if (!title) return errorResponse('Project Name is required.');
    if (!descShort) return errorResponse('Short Description is required.');
    if (!category) return errorResponse('Category is required.');

    // Generate unique slug
    let baseSlug = generateSlug(title) || 'project';
    let slug = baseSlug;
    let suffix = 1;
    let slugIsUnique = false;
    
    while (!slugIsUnique) {
      const existing = await db.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first();
      if (!existing) {
        slugIsUnique = true;
      } else {
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }
    }

    const info = await db.prepare(`
      INSERT INTO projects (
        owner_id, title, slug, description_short, description_full, 
        category, banner_url, icon_url, visibility, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id, title, slug, descShort, descFull,
      category, bannerUrl, iconUrl, visibility, tags
    ).run();

    if (!info.success) throw new Error('Database insert failed');
    const projectId = info.meta.last_row_id;
    
    // Auto add as owner in project_members
    await db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).bind(projectId, user.id, 'Owner').run();

    return jsonResponse({
      success: true,
      slug: slug,
      id: projectId
    }, 201);
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return errorResponse(`Failed to create project: ${error.message}`, 500);
  }
}
