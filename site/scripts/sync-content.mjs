import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const siteRoot = join(__dirname, '..')
const repoRoot = join(siteRoot, '..')
const contentRoot = join(siteRoot, 'content')
const templatesRoot = join(siteRoot, 'templates')

/**
 * Curriculum order (scientific path):
 * 1 Foundations (English) → 2 Modeling (UML) → 3 Data (SQL)
 * → 4 Systems (Distributed) → 5 Architecture (SA) → Practice / Notes
 *
 * @type {{ from: string, to: string }[]}
 */
const copies = [
  // 1 — Foundations: Technical English
  { from: 'docs/technical-english-learning-process-v2.1.md', to: 'foundations/english/learning-process.md' },
  { from: 'sa/English_12_Tenses_Handbook_v1.3.5.md', to: 'foundations/english/12-tenses-handbook.md' },

  // 2 — Modeling: UML
  { from: 'docs/2.md', to: 'modeling/uml/handbook.md' },
  { from: 'docs/1.md', to: 'modeling/uml/workbook.md' },
  { from: 'docs/3.md', to: 'modeling/uml/answer-guide.md' },
  { from: 'docs/images', to: 'modeling/uml/images' },

  // 3 — Data: SQL Server
  { from: 'sql/1.md', to: 'data/sql/handbook.md' },
  { from: 'sql/2.md', to: 'data/sql/workbook.md' },

  // 4 — Systems: Distributed Systems + Lab
  { from: 'distributed-systems-engineering-handbook-v4.13.en.md', to: 'systems/handbook.md' },
  { from: 'distributed-systems-engineering-workbook-v4.13.en.md', to: 'systems/workbook.md' },
  { from: 'distributed-systems-engineering-handbook-workbook-v4.13.en.md', to: 'systems/full-edition.md' },
  { from: 'lab/README.md', to: 'systems/lab.md' },

  // 5 — Architecture: Solution Architecture
  { from: 'sa/sa_core_knowledge_base.md', to: 'architecture/core-knowledge-base.md' },
  { from: 'sa/ddd_deep_dive_supplement.md', to: 'architecture/ddd-deep-dive.md' },
  { from: 'sa/sa_10_step_architecture_template.md', to: 'architecture/10-step-template.md' },

  // Practice (UML exercises)
  { from: 'exercise-05/02-design-notes.md', to: 'practice/uml-05-design-notes.md' },
  { from: 'exercise-06/02-change-log.md', to: 'practice/uml-06-change-log.md' },

  // Notes / side projects (not on the main curriculum path)
  { from: 'sro/afk-damage.md', to: 'notes/sro/afk-damage.md' },
  { from: 'sro/afk-damage-diagrams.md', to: 'notes/sro/afk-damage-diagrams.md' },
]

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function copyOne(fromRel, toRel) {
  const from = join(repoRoot, fromRel)
  const to = join(contentRoot, toRel)
  if (!existsSync(from)) {
    console.warn(`skip missing: ${fromRel}`)
    return false
  }
  ensureParent(to)
  cpSync(from, to, { recursive: true })
  console.log(`synced ${fromRel} -> content/${toRel}`)
  return true
}

function copyTemplates() {
  for (const name of readdirSync(templatesRoot)) {
    if (!name.endsWith('.md')) continue
    const from = join(templatesRoot, name)
    // section indexes: foundations.md → foundations/index.md
    if (name === 'index.md' || name === 'path.md') {
      cpSync(from, join(contentRoot, name))
      console.log(`template ${name} -> content/${name}`)
      continue
    }
    const stem = name.replace(/\.md$/, '')
    const dest = join(contentRoot, stem, 'index.md')
    ensureParent(dest)
    cpSync(from, dest)
    console.log(`template ${name} -> content/${stem}/index.md`)
  }
}

if (existsSync(contentRoot)) {
  rmSync(contentRoot, { recursive: true, force: true })
}
mkdirSync(contentRoot, { recursive: true })

let ok = 0
for (const { from, to } of copies) {
  if (copyOne(from, to)) ok += 1
}

copyTemplates()

writeFileSync(
  join(contentRoot, '.sync-stamp'),
  `${new Date().toISOString()}\n${ok}/${copies.length} synced\n`,
)

console.log(`\nDone. Content root: ${relative(repoRoot, contentRoot)} (${ok}/${copies.length})`)
