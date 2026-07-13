# Ruiarneb — The Archive

A static, dependency-free personal site. HTML + CSS + vanilla JS only —
no build step, deployable to Cloudflare Pages as-is.

## Before you deploy

1. **Add your portrait.** Drop a photo at `assets/ruiarneb.jpg` (square,
   at least 440×440px works best). Until it's added, a hand-drawn
   fallback sigil displays automatically.
2. **Update links.** In `index.html`:
   - The four "Open File" buttons under Artifacts currently point to `#`.
     Point them at your real project URLs.
   - The GitHub and Discord entries under Sealed Channels are placeholders —
     update the `href` values to your real profiles/invite link.
3. **Update the domain.** Replace `https://ruiarneb.pages.dev/` in
   `index.html` (canonical + Open Graph tags), `robots.txt`, and
   `sitemap.xml` with your real Cloudflare Pages URL or custom domain.

## Deploying to Cloudflare Pages

1. Push this folder to a Git repo (GitHub/GitLab), or use direct upload.
2. In Cloudflare Pages: **Create a project → Upload assets** (or connect
   the repo).
3. Build settings: **no build command, no framework preset.** Output
   directory: `/` (project root).
4. Deploy. That's it — everything here is static.

## File structure

```
/
├── index.html
├── style.css
├── script.js
├── 404.html
├── manifest.json
├── robots.txt
├── sitemap.xml
└── assets/
    ├── seal.svg              (signature ward-seal mark, used throughout)
    ├── favicon.svg
    ├── portrait-fallback.svg (shown until ruiarneb.jpg is added)
    └── ruiarneb.jpg          (add this yourself)
```

## Accessibility & performance notes

- Respects `prefers-reduced-motion` (disables ambient animation, canvas
  particles, and long transitions).
- Skip link, semantic landmarks, visible focus states, and alt text
  throughout.
- Ambient background (fog, dust, grain, sigils) is decorative and
  `aria-hidden`, and sits behind content with `pointer-events: none`.
- No external JS dependencies — only Google Fonts are loaded from a CDN.
