import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CRASH, staffFor, staffLogin } from './helpers';

/** Marketing & admissions analytics on production. Reads real leads; the only write is a QA campaign that is removed again. */
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
test.setTimeout(3 * 60_000);

test('admission manager: marketing tab with real figures and CSV report', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('admission_manager'));
  await p.goto('/crm/analytics?tab=marketing');
  await expect(p.locator('body')).not.toContainText(CRASH);
  for (const t of ['Total enquiries', 'Admissions confirmed', 'Lead conversion', 'Pipeline now', 'Admission forecast (estimate)', 'Needs immediate follow-up']) await expect(p.getByText(t).first()).toBeVisible();
  console.log('forecast:', (await p.getByText(/Not enough history|more admissions can be expected/).first().innerText()).slice(0, 160));
  await p.screenshot({ path: path.join(SHOTS, 'analytics-marketing.png'), fullPage: true });
  const csv = await p.request.get((await p.getByRole('link', { name: /Download report/ }).getAttribute('href')) as string);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain('Pipeline stage');

  await ctx.close();
});

test('marketing (data executive): register a campaign, see it in the filter, remove it', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('data_executive'));
  await p.goto('/crm/marketing');
  await expect(p.locator('body')).not.toContainText(CRASH);
  const code = `qa-e2e-${Date.now().toString(36)}`;
  await p.locator('input[name=name]').fill('QA E2E campaign');
  await p.locator('input[name=code]').fill(code);
  await p.locator('input[name=startDate]').fill('2026-11-01');
  await p.locator('input[name=budget]').fill('1000');
  await p.getByRole('button', { name: 'Save campaign' }).click();
  await expect(p.getByText(code)).toBeVisible({ timeout: 20_000 });
  await p.goto('/crm/analytics?tab=marketing');
  await expect(p.locator('select[name=campaign] option', { hasText: code })).toHaveCount(1);
  await p.goto('/crm/marketing');
  await p.locator('tr', { hasText: code }).getByRole('button', { name: 'Remove' }).click();
  await expect(p.getByText(code)).toHaveCount(0, { timeout: 20_000 });
  await ctx.close();
});

test('permissions: faculty gets no marketing tab; report refused; signed out is 401', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('faculty'));
  await p.goto('/crm/analytics?tab=marketing');
  await expect(p.locator('body')).not.toContainText('Total enquiries');
  expect((await p.request.get('/api/crm/marketing-report')).status()).toBe(403);
  const anon = await (await browser.newContext()).request.get(new URL('/api/crm/marketing-report', p.url()).toString());
  expect(anon.status()).toBe(401);
  await ctx.close();
});
