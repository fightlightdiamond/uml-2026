import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const siteRoot = join(__dirname, '..')
const repoRoot = join(siteRoot, '..')
const contentRoot = join(siteRoot, 'content')

/** @type {{ from: string, to: string }[]} */
const copies = [
  // Solution Architecture
  { from: 'sa/sa_core_knowledge_base.md', to: 'sa/core-knowledge-base.md' },
  { from: 'sa/sa_10_step_architecture_template.md', to: 'sa/10-step-architecture-template.md' },
  { from: 'sa/ddd_deep_dive_supplement.md', to: 'sa/ddd-deep-dive.md' },

  // Distributed systems (latest only)
  { from: 'distributed-systems-engineering-handbook-v4.13.en.md', to: 'distributed-systems/handbook.md' },
  { from: 'distributed-systems-engineering-workbook-v4.13.en.md', to: 'distributed-systems/workbook.md' },
  { from: 'distributed-systems-engineering-handbook-workbook-v4.13.en.md', to: 'distributed-systems/handbook-workbook.md' },

  // SQL
  { from: 'sql/1.md', to: 'sql/handbook.md' },
  { from: 'sql/2.md', to: 'sql/workbook.md' },

  // UML
  { from: 'docs/2.md', to: 'uml/handbook.md' },
  { from: 'docs/1.md', to: 'uml/workbook.md' },
  { from: 'docs/3.md', to: 'uml/answer-guide.md' },
  { from: 'docs/images', to: 'uml/images' },

  // English
  { from: 'docs/technical-english-learning-process-v2.1.md', to: 'english/learning-process.md' },
  { from: 'sa/English_12_Tenses_Handbook_v1.3.2.md', to: 'english/12-tenses-handbook.md' },

  // SRO
  { from: 'sro/afk-damage.md', to: 'sro/afk-damage.md' },
  { from: 'sro/afk-damage-diagrams.md', to: 'sro/afk-damage-diagrams.md' },

  // Exercises & lab
  { from: 'exercise-05/02-design-notes.md', to: 'exercises/05-design-notes.md' },
  { from: 'exercise-06/02-change-log.md', to: 'exercises/06-change-log.md' },
  { from: 'lab/README.md', to: 'lab/readme.md' },
]

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function copyOne(fromRel, toRel) {
  const from = join(repoRoot, fromRel)
  const to = join(contentRoot, toRel)
  if (!existsSync(from)) {
    console.warn(`skip missing: ${fromRel}`)
    return
  }
  ensureParent(to)
  cpSync(from, to, { recursive: true })
  console.log(`synced ${fromRel} -> content/${toRel}`)
}

if (existsSync(contentRoot)) {
  rmSync(contentRoot, { recursive: true, force: true })
}
mkdirSync(contentRoot, { recursive: true })

for (const { from, to } of copies) {
  copyOne(from, to)
}

// Home page lives in templates/ so sync can wipe content/ safely
cpSync(join(siteRoot, 'templates/index.md'), join(contentRoot, 'index.md'))

writeFileSync(
  join(contentRoot, '.sync-stamp'),
  `${new Date().toISOString()}\n${copies.length} entries\n`,
)

console.log(`\nDone. Content root: ${relative(repoRoot, contentRoot)}`)
