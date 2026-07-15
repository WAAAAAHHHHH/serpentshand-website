# Kiwi — The Archive

A static site (HTML + CSS + vanilla JS, no build step) backed by
Cloudflare Pages Functions + D1 for the forum and user accounts.

## Before you deploy

1. **Add your portrait.** Drop a photo at `assets/kiwi.jpg` (square,
   at least 440×440px works best). Until it's added, a hand-drawn
   fallback sigil displays automatically.
2. **Update links.** The GitHub and Discord entries under Sealed
   Channels in `index.html` are placeholders — update the `href`
   values to your real profiles/invite link.
3. **Update the domain.** Replace `https://kiwi.pages.dev/` in
   `index.html` (canonical + Open Graph tags), `robots.txt`, and
   `sitemap.xml` with your real Cloudflare Pages URL or custom domain.
4. **Run the auth migration** — see the root-level `README.md` for
   the one `wrangler d1 execute` command needed before the account
   system will work.

## Deploying to Cloudflare Pages

1. Push this repo to Git (GitHub/GitLab).
2. In Cloudflare Pages: **Create a project → connect the repo.**
3. Build settings: **no build command, no framework preset.** Root
   directory / output directory: wherever this `website/` folder ends
   up relative to your repo (see the root `README.md`'s note about
   the two `functions/` copies).
4. Bind your D1 database as `DB` under Settings → Functions.
5. Deploy. Everything here is static except the `/api/*` routes,
   which run as Pages Functions against D1.

## File structure

```
/
├── index.html
├── login.html
├── signup.html
├── profile.html
├── style.css
├── script.js           (site chrome + nav auth state + forum)
├── auth-pages.js        (login/signup/profile form handlers)
├── 404.html
├── manifest.json
├── robots.txt
├── sitemap.xml
├── functions/api/...    (see root README — auth + profile + forum API)
└── assets/
    ├── seal.svg              (signature ward-seal mark, used throughout)
    ├── favicon.svg
    ├── portrait-fallback.svg (shown until kiwi.jpg is added)
    └── kiwi.jpg          (add this yourself)
```

## Accessibility & performance notes

- Respects `prefers-reduced-motion` (disables ambient animation, canvas
  particles, and long transitions).
- Skip link, semantic landmarks, visible focus states, and alt text
  throughout, including on the new auth/profile pages.
- Ambient background (fog, dust, grain, sigils) is decorative and
  `aria-hidden`, and sits behind content with `pointer-events: none`.
- No external JS dependencies — only Google Fonts are loaded from a CDN.
- Forum and profile rendering use `textContent`/DOM APIs for all
  user-supplied text — never `innerHTML` with untrusted input.
