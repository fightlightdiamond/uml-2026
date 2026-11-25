import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const base = process.env.VITEPRESS_BASE || '/'

export default withMermaid(
  defineConfig({
    title: '2026 Learning Hub',
    description: 'Ordered curriculum: Foundations → Modeling → Data → Systems → Architecture',
    lang: 'en-US',
    base,
    srcDir: 'content',
    cleanUrls: true,
    lastUpdated: true,
    ignoreDeadLinks: true,

    head: [
      ['meta', { name: 'theme-color', content: '#0f766e' }],
    ],

    themeConfig: {
      nav: [
        { text: 'Path', link: '/path' },
        {
          text: 'Curriculum',
          items: [
            { text: '1 · Foundations', link: '/foundations/' },
            { text: '2 · Modeling', link: '/modeling/' },
            { text: '3 · Data', link: '/data/' },
            { text: '4 · Systems', link: '/systems/' },
            { text: '5 · Architecture', link: '/architecture/' },
          ],
        },
        {
          text: 'More',
          items: [
            { text: 'Practice', link: '/practice/' },
            { text: 'Notes', link: '/notes/' },
          ],
        },
      ],

      sidebar: {
        '/foundations/': [
          {
            text: '1 · Foundations',
            items: [
              { text: 'Overview', link: '/foundations/' },
              { text: 'English · Learning process', link: '/foundations/english/learning-process' },
              { text: 'English · 12 tenses', link: '/foundations/english/12-tenses-handbook' },
            ],
          },
        ],
        '/modeling/': [
          {
            text: '2 · Modeling',
            items: [
              { text: 'Overview', link: '/modeling/' },
              { text: 'UML · Handbook', link: '/modeling/uml/handbook' },
              { text: 'UML · Workbook', link: '/modeling/uml/workbook' },
              { text: 'UML · Answer guide', link: '/modeling/uml/answer-guide' },
            ],
          },
        ],
        '/data/': [
          {
            text: '3 · Data',
            items: [
              { text: 'Overview', link: '/data/' },
              { text: 'SQL · Handbook', link: '/data/sql/handbook' },
              { text: 'SQL · Workbook', link: '/data/sql/workbook' },
            ],
          },
        ],
        '/systems/': [
          {
            text: '4 · Systems',
            items: [
              { text: 'Overview', link: '/systems/' },
              { text: 'Handbook v4.13', link: '/systems/handbook' },
              { text: 'Workbook v4.13', link: '/systems/workbook' },
              { text: 'Lab runtime', link: '/systems/lab' },
              { text: 'Full edition (optional)', link: '/systems/full-edition' },
            ],
          },
        ],
        '/architecture/': [
          {
            text: '5 · Architecture',
            items: [
              { text: 'Overview', link: '/architecture/' },
              { text: 'Core knowledge base', link: '/architecture/core-knowledge-base' },
              { text: 'DDD deep dive', link: '/architecture/ddd-deep-dive' },
              { text: '10-step template', link: '/architecture/10-step-template' },
            ],
          },
        ],
        '/practice/': [
          {
            text: 'Practice',
            items: [
              { text: 'Overview', link: '/practice/' },
              { text: 'UML 05 — Design notes', link: '/practice/uml-05-design-notes' },
              { text: 'UML 06 — Change log', link: '/practice/uml-06-change-log' },
            ],
          },
        ],
        '/notes/': [
          {
            text: 'Notes',
            items: [
              { text: 'Overview', link: '/notes/' },
              { text: 'SRO · AFK damage', link: '/notes/sro/afk-damage' },
              { text: 'SRO · Diagrams', link: '/notes/sro/afk-damage-diagrams' },
            ],
          },
        ],
        '/path': [
          {
            text: 'Curriculum',
            items: [
              { text: 'Learning path', link: '/path' },
              { text: '1 · Foundations', link: '/foundations/' },
              { text: '2 · Modeling', link: '/modeling/' },
              { text: '3 · Data', link: '/data/' },
              { text: '4 · Systems', link: '/systems/' },
              { text: '5 · Architecture', link: '/architecture/' },
              { text: 'Practice', link: '/practice/' },
              { text: 'Notes', link: '/notes/' },
            ],
          },
        ],
      },

      search: {
        provider: 'local',
      },

      outline: {
        level: [2, 3],
      },

      footer: {
        message: 'Ordered curriculum — sync from repo markdown on each build',
        copyright: 'Edit source files in sa/, sql/, docs/, … — not site/content/',
      },
    },

    markdown: {
      lineNumbers: false,
    },

    mermaid: {
      theme: 'neutral',
    },
  }),
)
