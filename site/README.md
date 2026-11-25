# 2026 Learning Hub (VitePress)

Static site for all learning markdown in this repo. Source of truth stays in the original `.md` files; `npm run sync` copies them into `content/` before dev/build.

## Local

```bash
cd site
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Deploy

- **Vercel / Netlify:** set root to `site`, build `npm run build`, output `.vitepress/dist` (or `dist` depending on VitePress outDir — default is `site/.vitepress/dist`).
- **GitHub Pages:** use the workflow in `.github/workflows/deploy-site.yml`.

## What is synced

| Section | Source |
| --- | --- |
| Solution Architecture | `sa/*.md` (latest) |
| Distributed Systems | handbook/workbooks v4.13 |
| SQL | `sql/1.md`, `sql/2.md` |
| UML | `docs/1–3.md` + images |
| English | learning process + 12 tenses v1.3.2 |
| SRO / exercises / lab | matching folders |

Older handbook revisions (e.g. English v1.2, DS workbook v4.12) are intentionally not published.
