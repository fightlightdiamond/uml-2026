import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const base = process.env.VITEPRESS_BASE || '/'

export default withMermaid(
  defineConfig({
    title: '2026 Learning Hub',
    description: 'Solution Architecture, Distributed Systems, SQL, UML, and English — personal knowledge base',
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
      logo: undefined,
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Solution Architecture', link: '/sa/core-knowledge-base' },
        { text: 'Distributed Systems', link: '/distributed-systems/handbook' },
        { text: 'SQL', link: '/sql/handbook' },
        { text: 'UML', link: '/uml/handbook' },
        { text: 'English', link: '/english/learning-process' },
      ],

      sidebar: {
        '/sa/': [
          {
            text: 'Solution Architecture',
            items: [
              { text: 'Core Knowledge Base', link: '/sa/core-knowledge-base' },
              { text: '10-Step Architecture Template', link: '/sa/10-step-architecture-template' },
              { text: 'DDD Deep Dive', link: '/sa/ddd-deep-dive' },
            ],
          },
        ],
        '/distributed-systems/': [
          {
            text: 'Distributed Systems',
            items: [
              { text: 'Handbook v4.13', link: '/distributed-systems/handbook' },
              { text: 'Workbook v4.13', link: '/distributed-systems/workbook' },
              { text: 'Handbook Workbook v4.13', link: '/distributed-systems/handbook-workbook' },
            ],
          },
        ],
        '/sql/': [
          {
            text: 'SQL Server',
            items: [
              { text: 'Handbook', link: '/sql/handbook' },
              { text: 'Workbook', link: '/sql/workbook' },
            ],
          },
        ],
        '/uml/': [
          {
            text: 'UML Modeling',
            items: [
              { text: 'Handbook', link: '/uml/handbook' },
              { text: 'Workbook', link: '/uml/workbook' },
              { text: 'Answer Guide', link: '/uml/answer-guide' },
            ],
          },
        ],
        '/english/': [
          {
            text: 'Technical English',
            items: [
              { text: 'Learning Process', link: '/english/learning-process' },
              { text: '12 Tenses Handbook', link: '/english/12-tenses-handbook' },
            ],
          },
        ],
        '/sro/': [
          {
            text: 'SRO',
            items: [
              { text: 'AFK Damage', link: '/sro/afk-damage' },
              { text: 'AFK Damage Diagrams', link: '/sro/afk-damage-diagrams' },
            ],
          },
        ],
        '/exercises/': [
          {
            text: 'Exercises',
            items: [
              { text: '05 — Design Notes', link: '/exercises/05-design-notes' },
              { text: '06 — Change Log', link: '/exercises/06-change-log' },
            ],
          },
        ],
        '/lab/': [
          {
            text: 'Lab',
            items: [
              { text: 'Runtime README', link: '/lab/readme' },
            ],
          },
        ],
      },

      search: {
        provider: 'local',
      },

      socialLinks: [],

      outline: {
        level: [2, 3],
      },

      footer: {
        message: 'Personal learning hub — synced from repo markdown',
        copyright: 'Source of truth remains the .md files in the repository',
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
