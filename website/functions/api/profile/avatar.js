/**
 * POST /api/profile/avatar
 * Auth required.
 *
 * Preferred path (if an R2 bucket binding named `AVATARS` is configured
 * in the Pages project, plus an `AVATARS_PUBLIC_URL` env var pointing at
 * its public domain/custom domain): send multipart/form-data with a
 * `file` field, and the image is uploaded to R2.
 *
 * Fallback path (no R2 configured): send JSON `{ avatar_url }` pointing
 * at an externally-hosted image. This always works with zero extra setup.
 */
import { json, getSessionUser, sanitizeText } from '../_lib/auth.js';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 3 * 1024 * 1024; // 3MB

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ error: "Database binding 'DB' not found." }, 500);

    const currentUser = await getSessionUser(context.request, db);
    if (!currentUser) return json({ error: 'You must be signed in.' }, 401);

    const contentType = context.request.headers.get('Content-Type') || '';

    // --- Preferred: Cloudflare R2 file upload -------------------------
    if (context.env.AVATARS && contentType.startsWith('multipart/form-data')) {
      const form = await context.request.formData();
      const file = form.get('file');

      if (!file || typeof file === 'string') {
        return json({ error: 'No file provided.' }, 400);
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return json({ error: 'Avatar must be a PNG, JPEG, WebP, or GIF image.' }, 400);
      }
      if (file.size > MAX_BYTES) {
        return json({ error: 'Avatar must be smaller than 3MB.' }, 400);
      }

      const publicBase = context.env.AVATARS_PUBLIC_URL;
      if (!publicBase) {
        return json(
          { error: 'Avatar storage is not fully configured (missing AVATARS_PUBLIC_URL).' },
          500
        );
      }

      const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
      const key = `avatars/${currentUser.id}-${Date.now()}.${ext}`;

      await context.env.AVATARS.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      const avatarUrl = `${publicBase.replace(/\/$/, '')}/${key}`;
      await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(avatarUrl, currentUser.id).run();

      return json({ success: true, avatar_url: avatarUrl });
    }

    // --- Fallback: externally-hosted image URL -------------------------
    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return json(
        {
          error: context.env.AVATARS
            ? 'Send a multipart/form-data file upload, or JSON { avatar_url }.'
            : 'Image uploads are not configured on this deployment. Send JSON { avatar_url } with a link to an image instead.'
        },
        400
      );
    }

    const url = sanitizeText(data.avatar_url, 500);
    if (!url || !/^https:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url)) {
      return json(
        { error: 'Avatar URL must be a valid https:// link to a png, jpg, gif, or webp image.' },
        400
      );
    }

    await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(url, currentUser.id).run();
    return json({ success: true, avatar_url: url });
  } catch (error) {
    console.error('POST /api/profile/avatar error:', error);
    return json({ error: 'Failed to update avatar.' }, 500);
  }
}
