# 2026 Learning Hub (VitePress)

Static site for study markdown in this repo, organized as a **5-track curriculum**.

```text
1 Foundations (English)
2 Modeling (UML)
3 Data (SQL)
4 Systems (Distributed + Lab)
5 Architecture (SA + DDD + template)
+ Practice / Notes (off-path)
```

Source of truth stays in the original folders (`sa/`, `sql/`, `docs/`, …).  
`npm run sync` copies them into `content/` before dev/build.

## Local

```bash
cd site
npm install
npm run dev
```

Open http://localhost:5173

## Build / deploy

```bash
npm run build
npm run preview
```

- **GitHub Pages:** workflow `.github/workflows/deploy-site.yml`
- **Live:** https://fightlightdiamond.github.io/uml-2026/
- **Vercel:** root directory `site`

## Sync map (latest editions only)

| Site path | Repo source |
| --- | --- |
| `/foundations/english/*` | `docs/technical-english-…`, `sa/English_12_Tenses_Handbook_v1.3.5.md` |
| `/modeling/uml/*` | `docs/1.md`–`3.md` + images |
| `/data/sql/*` | `sql/1.md`, `sql/2.md` |
| `/systems/*` | DS handbook/workbook v4.13 + `lab/README.md` |
| `/architecture/*` | `sa/sa_*.md`, `sa/ddd_*.md` |
| `/practice/*` | `exercise-05/06` |
| `/notes/sro/*` | `sro/*.md` |
