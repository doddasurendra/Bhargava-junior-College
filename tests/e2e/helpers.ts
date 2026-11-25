import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

export interface QaStaff {
  role: string;
  label: string;
  home: string;
  id: string;
  email: string;
  name: string;
  password: string;
}

const FILE = path.join(process.cwd(), '.data', 'qa-accounts.json');
export const qaStaff = (): QaStaff[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : []);
export const staffFor = (role: string) => {
  const s = qaStaff().find((x) => x.role === role);
  if (!s) throw new Error(`No QA account for ${role}: run node scripts/qa-accounts.mjs and apply the SQL.`);
  return s;
};

/** Text that only appears when a page crashed or the server failed. */
export const CRASH = /Application error|Internal Server Error|This page could not be found|Something went wrong|Unhandled Runtime Error/i;

export async function staffLogin(page: Page, s: Pick<QaStaff, 'email' | 'password'>) {
  await page.goto('/crm/login');
  await page.locator('input[name="email"]').fill(s.email);
  await page.locator('input[name="password"]').fill(s.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/crm/login'), { timeout: 60_000 });
}

export async function expectHealthy(page: Page) {
  await expect(page.locator('body')).not.toContainText(CRASH);
}

/** Watches console errors and failed same-origin requests (5xx) for the page's lifetime. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('response', (r) => {
    if (r.status() >= 500 && r.url().startsWith(new URL(page.url() || 'http://x').origin)) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return errors;
}
