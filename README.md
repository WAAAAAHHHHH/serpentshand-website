# serpentshand-website

Kiwi's Archive — a static Cloudflare Pages site (HTML/CSS/vanilla JS)
with a Cloudflare Pages Functions + D1 backend for the forum and, now,
full user accounts.

## What's in this repo

```
/
├── wrangler.toml              ← D1 (and optional R2) bindings, fixed & valid
├── db/
│   └── schema.sql              ← run once against your D1 database
├── functions/                  ← Pages Functions (see note below)
│   └── api/
│       ├── _lib/auth.js        ← shared auth/session/hash/validation helpers
│       ├── auth/                register.js, login.js, logout.js, me.js
│       ├── profile/             update.js, avatar.js, [username].js
│       └── messages.js, messages/[id].js, messages/[id]/reply.js
└── website/                    ← static site + a duplicate functions/ tree
    ├── index.html, login.html, signup.html, profile.html, 404.html
    ├── style.css, script.js, auth-pages.js
    ├── manifest.json, robots.txt, sitemap.xml
    ├── assets/
    └── functions/               ← identical copy of the API, see note below
```

### Important — pick ONE functions directory

Your original repo had `functions/` at the repo root **and** a
duplicate `website/functions/`. Cloudflare Pages only reads the
`functions/` folder that sits inside whatever "Root directory" you've
configured for the Pages project (Settings → Builds & deployments):

- If your Pages project's **Root directory** is set to the repo root
  (`/`), keep `functions/` at the top level and **delete
  `website/functions/`**.
- If your Pages project's **Root directory** is set to `website`,
  keep `website/functions/` and **delete the top-level `functions/`**.

Both copies are included here, fully identical, so this works either
way out of the box — but you should delete the one you're not using
once you confirm your Pages settings, to avoid the two trees drifting
apart later.

## One-time setup

1. **Run the migration** against your existing D1 database
   (`serpentshand-db`) to add the `users` and `sessions` tables and
   link `messages` to accounts:

   ```
   wrangler d1 execute serpentshand-db --remote --file=./db/schema.sql
   ```

   This does **not** touch your existing forum rows — legacy/guest
   entries keep working, they just show "Anonymous" as the author
   until re-posted by a signed-in user.

2. **D1 binding.** Already configured: `wrangler.toml` binds your
   existing database as `DB` (same binding name your existing
   `functions/api/messages.js` already relied on). In the Cloudflare
   dashboard, confirm Pages → your project → Settings → Functions →
   D1 database bindings has `DB` → `serpentshand-db`.

3. **(Optional) Avatar uploads via R2.** By default, avatars are set
   via an image URL (works immediately, zero setup). If you'd rather
   let users upload image files directly:
   - Create an R2 bucket, e.g. `kiwi-archive-avatars`, and make it
     publicly readable (or put a custom domain in front of it).
   - In `wrangler.toml`, uncomment the `[[r2_buckets]]` block and set
     `AVATARS_PUBLIC_URL` to that public domain.
   - In the Cloudflare dashboard, add the same R2 binding (`AVATARS`)
     and the `AVATARS_PUBLIC_URL` variable to your Pages project.
   - No code changes needed — `/api/profile/avatar` automatically
     detects the `AVATARS` binding and switches to file-upload mode.

4. **Deploy** as usual — no build command, no framework preset,
   output directory `/` (or `website/`, matching whichever functions
   tree you kept).

## How the auth system works

- Passwords are hashed with **PBKDF2-SHA256** (100,000 iterations, a
  random 16-byte salt per user) using the Web Crypto API that's
  natively available in the Cloudflare Workers runtime — no external
  library, no native bindings, no secrets to configure.
- Sessions are random 256-bit tokens stored in the `sessions` table
  and set as an **HttpOnly, Secure, SameSite=Lax** cookie
  (`sh_session`), valid for 30 days. Every protected route re-validates
  the cookie against the database on each request.
- All SQL uses **prepared statements** (`db.prepare(...).bind(...)`).
  No string concatenation into queries anywhere.
- All user-supplied text rendered to the page goes through
  `textContent`/DOM APIs, never `innerHTML` with raw input — this is
  unchanged from (and consistent with) the original forum's approach,
  and prevents stored XSS.
- `is_admin` exists on `users` now so admin features are a one-line
  `UPDATE users SET is_admin = 1 WHERE username = '...';` away —
  `messages/[id].js` already checks it for edit/delete override.

## API routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/register` | POST | — | Create account, start session |
| `/api/auth/login` | POST | — | Verify credentials, start session |
| `/api/auth/logout` | POST | — | End session |
| `/api/auth/me` | GET | — | Current user (or `{user: null}`) + post count |
| `/api/profile/update` | POST | required | Change display name / username / bio |
| `/api/profile/avatar` | POST | required | Set avatar (URL, or R2 upload if configured) |
| `/api/profile/:username` | GET | — | Public profile + post count |
| `/api/messages` | GET | — | List all forum threads (with author info) |
| `/api/messages` | POST | required | Create a thread, tied to your account |
| `/api/messages/:id` | PATCH | owner/admin | Edit your own thread |
| `/api/messages/:id` | DELETE | owner/admin | Delete your own thread |
| `/api/messages/:id/reply` | POST | required | Reply to a thread |

See `README-AUTH.md` for a deeper dive into the `_lib/auth.js` helpers.
