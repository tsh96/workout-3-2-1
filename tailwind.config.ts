import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ground: 'var(--c-ground)',
        surface: 'var(--c-surface)',
        raised: 'var(--c-raised)',
        line: 'var(--c-line)',
        ink: 'var(--c-text)',
        muted: 'var(--c-muted)',
        faint: 'var(--c-faint)',
        scrim: 'var(--c-scrim)',
        work: {
          DEFAULT: 'var(--c-work)',
          fill: 'var(--c-work-fill)',
          on: 'var(--c-work-on)',
          soft: 'var(--c-work-soft)',
        },
        rest: {
          DEFAULT: 'var(--c-rest)',
          fill: 'var(--c-rest-fill)',
          on: 'var(--c-rest-on)',
          soft: 'var(--c-rest-soft)',
        },
        prep: {
          DEFAULT: 'var(--c-prep)',
          fill: 'var(--c-prep-fill)',
          on: 'var(--c-prep-on)',
          soft: 'var(--c-prep-soft)',
        },
        danger: {
          DEFAULT: 'var(--c-danger)',
          soft: 'var(--c-danger-soft)',
        },
      },
      fontFamily: {
        // Archivo carries the latin and the numerals; hanzi fall through to
        // whatever the platform ships, which beats shipping a CJK webfont.
        sans: [
          'Archivo',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans CJK SC',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
} satisfies Config
