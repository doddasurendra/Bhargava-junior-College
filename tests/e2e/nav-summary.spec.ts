import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CRASH, staffFor } from './helpers';

/** Read-only: every top navigation item opens its own page; Staff CRM and Summary go where they should. */
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
test.setTimeout(4 * 60_000);

test('public navigation: each item opens its own page', async ({ page }) => {
  await page.goto('/');
  const seen = new Map<string, string>();
  for (const [label, href] of [['Results', '/results'], ['Programs', '/programs'], ['Fees', '/fees'], ['Scholarship', '/scholarship'], ['Hostel', '/hostel'], ['Campus visit', '/visit'], ['Parents', '/parents'], ['Resources', '/resources'], ['Open Book', '/open-book'], ['Knowledge Base', '/knowledge-base']]) {
    const r = await page.goto(href);
    expect(r?.status(), href).toBe(200);
    await expect(page.locator('body')).not.toContainText(CRASH);
    const h1 = (await page.locator('h1').first().innerText()).trim();
    console.log(`${label} → ${page.url().replace(/^https?:\/\/[^/]+/, '')} · "${h1.slice(0, 60)}"`);
    expect(seen.has(h1), `${label} shows the same heading as ${seen.get(h1)}`).toBe(false);
    seen.set(h1, label);
  }
  // header links point to these pages
  await page.goto('/');
  for (const href of ['/results', '/crm/summary', '/programs', '/fees', '/scholarship', '/hostel', '/visit', '/parents', '/resources']) await expect(page.locator(`header a[href="${href}"]`).first()).toHaveCount(1);
  for (const href of ['/crm/login', '/open-book', '/knowledge-base']) await expect(page.locator(`nav[aria-label="Platform"] a[href="${href}"]`).first()).toHaveCount(1);
});

test('Staff CRM opens the staff login; Summary asks to sign in and then opens the Summary dashboard', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('/');
  await p.locator('nav[aria-label="Platform"] a[href="/crm/login"]').first().click();
  await expect(p).toHaveURL(/\/crm\/login$/);
  await expect(p.getByText('Staff sign-in')).toBeVisible();
  await expect(p.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  await expect(p.getByRole('link', { name: /Request an account/ })).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'task1-staff-crm-login.png'), fullPage: true });

  await p.goto('/');
  await p.locator('header a[href="/crm/summary"]').first().click();
  await expect(p).toHaveURL(/\/crm\/login\?next=%2Fcrm%2Fsummary/);
  await expect(p.getByText(/Sign in to open the Summary dashboard/)).toBeVisible();
  const m = staffFor('management');
  await p.locator('input[name=email]').fill(m.email);
  await p.locator('input[name=password]').fill(m.password);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.waitForURL(/\/crm\/(summary|login\/2fa)/, { timeout: 60_000 });
  test.skip(p.url().includes('/2fa'), 'management QA account uses 2FA');
  await expect(p).toHaveURL(/\/crm\/summary/);
  await expect(p.getByTestId('institution-dashboard')).toBeVisible({ timeout: 60_000 });
  await expect(p.locator('body')).not.toContainText(CRASH);
  for (const t of ['Institution', 'Academics', 'Admissions', 'Students & parents', 'Staff & management', 'Fees & finance', 'Open Book & knowledge base', 'Campus & other modules']) await expect(p.getByTestId('institution-dashboard').getByRole('heading', { name: t, exact: true })).toBeVisible();
  await expect(p.getByTestId('admission-funnel')).toBeVisible();
  const students = await p.locator('text=Students').first().locator('xpath=..').innerText();
  console.log('summary students tile:', students.replace(/\s+/g, ' ').slice(0, 60));
  await p.screenshot({ path: path.join(SHOTS, 'task1-summary-dashboard.png'), fullPage: true });
  // filter
  await p.locator('select[name=year]').selectOption('month');
  await p.getByRole('button', { name: 'Apply' }).first().click();
  await expect(p).toHaveURL(/year=month/);
  await expect(p.getByTestId('institution-dashboard')).toBeVisible();
  // module link
  await p.locator('a[href="#admissions"]').click();
  await ctx.close();
});

test('role-based landing and dashboards: telecaller gets its home and the role summary, not the institution dashboard', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const t = staffFor('telecaller');
  await p.goto('/crm/login');
  await p.locator('input[name=email]').fill(t.email);
  await p.locator('input[name=password]').fill(t.password);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/crm/login'), { timeout: 60_000 });
  console.log('telecaller landed on', new URL(p.url()).pathname);
  await p.goto('/crm/summary');
  await expect(p.getByTestId('institution-dashboard')).toHaveCount(0);
  await expect(p.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();
  // an outside URL in next= is ignored (no open redirect)
  const c2 = await browser.newContext();
  const q = await c2.newPage();
  await q.goto('/crm/login?next=https://example.com/x');
  await expect(q.getByText(/Sign in to open/)).toHaveCount(0);
  await ctx.close();
  await c2.close();
});
