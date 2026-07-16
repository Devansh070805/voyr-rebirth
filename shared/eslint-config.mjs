/**
 * @voyr/eslint-config - Shared ESLint flat config for Voyr monorepo.
 *
 * Usage in root eslint.config.mjs:
 *   import voyrConfig from './shared/eslint-config.mjs';
 *   export default [...voyrConfig, { ...workspaceOverrides }];
 *
 * File-size rules:
 *   - max-lines:               warn at 400 effective lines
 *   - max-lines-per-function:  warn at 80 effective lines
 *   - max-depth:               warn at 4 levels
 *   - max-params:              warn at 6 parameters
 */

import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

/** Base config shared across all workspaces */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.wrangler/**',
      '**/out/**',
      '**/coverage/**',
      '**/.vercel/**',
      'frontend/next-env.d.ts',
    ],
  },

  // ── Base TypeScript rules ──────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      // Custom overrides
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',

      // ── File-size enforcement ──────────────────────────────────
      // Warn if a file has more than 400 effective lines
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],

      // Warn if a function has more than 80 effective lines
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],

      // Warn if blocks are nested more than 4 levels deep
      'max-depth': ['warn', 4],

      // Warn if a function has more than 6 parameters
      'max-params': ['warn', 6],
    },
  },

  // ── Next.js + React hooks (frontend only) ──────────────────────
  {
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      'react': { version: 'detect' },
    },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': ['error', 'frontend/src/app'],
      ...reactHooks.configs['recommended'].rules,

      // Allow setState-in-effect for async data-fetching patterns
      'react-hooks/set-state-in-effect': 'warn',

      // Suppress <img> for external logo URLs
      '@next/next/no-img-element': 'off',
    },
  },

  // ── Looser limits for test files (more verbose by nature) ──
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/*.integration.test.ts'],
    rules: {
      'max-lines': ['warn', { max: 800, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },

  // ── Seed / data files can be large by nature ────────────────────
  {
    files: ['backend/src/db/**', '**/seed-*.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
];
