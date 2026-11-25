import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests (tests/e2e). Uses the Chrome already installed on the machine (no browser download):
 *   npx playwright test                         # against the live site
 *   QA_BASE_URL=https://<preview>.vercel.app npx playwright test
 * Staff logins come from .data/qa-accounts.json (node scripts/qa-accounts.mjs; gitignored).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: Number(process.env.QA_WORKERS || 2),
  reporter: [['list'], ['json', { outputFile: '.data/e2e-results.json' }]],
  use: {
    baseURL: process.env.QA_BASE_URL || 'https://bhargava-junior-college.vercel.app',
    channel: process.env.QA_BROWSER_CHANNEL || 'chrome',
    headless: true,
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
});
