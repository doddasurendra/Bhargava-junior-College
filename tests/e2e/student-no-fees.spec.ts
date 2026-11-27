import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Browser } from '@playwright/test';
import { qaStudentPassword, staffFor, staffLogin, studentIdLogin } from './helpers';

/**
 * College rule on production: students see no fee information; parents keep everything; staff fee views unchanged.
 * Read-only. Screenshots go to Desktop/BJC-screenshots.
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.skip(!qa, 'QA family file missing');
test.describe.configure({ mode: 'serial' });
test.setTimeout(4 * 60_000);
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
const FEE_TEXT = /Fees paid|Receipts →|Fees & receipts|Fees, dues|Next fee instalment|₹\s?\d/;
let receiptUrl: string | null = null;

async function appLogin(browser: Browser, phone: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto('/app/login');
  await p.locator('input[type=tel]').first().fill(phone.replace(/^\+91/, ''));
  await p.getByRole('button', { name: 'Send sign-in code' }).click();
  await p.locator('input[name=code]').fill(qa.otpCode);
  await p.locator('form').filter({ has: p.locator('input[name=code]') }).getByRole('button', { name: 'Sign in' }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/app/login'), { timeout: 60_000 });
  if (new URL(p.url()).pathname.startsWith('/app/consent')) { await p.locator('input[name=agree]').check({ force: true }); await p.getByRole('button', { name: /agree|continue|accept/i }).first().click(); await p.waitForURL((u) => !u.pathname.startsWith('/app/consent')); }
  return p;
}

test('parent still sees fees, dues and receipts', async ({ browser }) => {
  const p = await appLogin(browser, qa.numbers.parent);
  await p.goto('/app');
  await expect(p.getByText('Fees paid')).toBeVisible();
  await p.goto('/app/fees');
  await expect(p.getByRole('heading', { name: 'Fees & receipts' })).toBeVisible();
  const r = p.locator('a[href^="/app/receipts/"]').first();
  if (await r.count()) receiptUrl = await r.getAttribute('href');
  await p.screenshot({ path: path.join(SHOTS, 'parent-fees.png'), fullPage: true });
  if (receiptUrl) { expect((await p.request.get(receiptUrl)).status()).toBe(200); }
  await p.context().close();
});

test('student: no fee card, menu item, link or amount; fee URLs blocked; assistants redirect', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await studentIdLogin(p, qa.collegeId, qaStudentPassword(qa.otpCode));
  for (const url of ['/app', '/app/more', '/app/id-card', '/app/results', '/app/knowledge']) {
    await p.goto(url);
    await p.waitForLoadState('networkidle');
    await expect(p.locator('main, body').first(), url).not.toContainText(FEE_TEXT);
    expect(await p.locator('a[href^="/app/fees"], a[href^="/app/receipts"]').count(), `fee link on ${url}`).toBe(0);
  }
  await p.goto('/app');
  await expect(p.getByText(/Guardians with app access/)).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'student-home.png'), fullPage: true });
  // phone width: no horizontal overflow
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  // direct fee URLs
  await p.goto('/app/fees');
  await expect(p).toHaveURL(/\/app$/);
  if (receiptUrl) {
    expect((await p.request.get(receiptUrl)).status()).toBe(404);
    expect((await p.request.get(`${receiptUrl}/pdf`)).status()).toBe(404);
  }
  // college AI: personal fee questions get the polite redirect, no amounts
  for (const q of ['how much fee is due?', 'what is my fee balance?']) {
    const r = await p.request.post('/api/kb/ask', { data: { q, assistant: 'student', surface: 'app' } });
    const j = await r.json();
    expect(j.text, q).toBe('Fee details are shared with your parent or guardian. Please ask them or contact the accounts office.');
    expect(JSON.stringify(j)).not.toMatch(/₹/);
  }
  console.log(`student checks PASS (receipt URL tested: ${receiptUrl ?? 'parent has no receipt yet'})`);
  await p.context().close();
});

test('staff fee views unchanged (Accounts)', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('accounts'));
  await p.goto('/crm/accounts');
  await expect(p.locator('body')).toContainText(/Dues|Daily collection/);
  await ctx.close();
});
