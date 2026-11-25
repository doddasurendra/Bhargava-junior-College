import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { CRASH, expectHealthy } from './helpers';

/**
 * Student & Parent app with the QA family (docs/qa/TEST_ACCOUNTS.md): needs the deployment to have
 * TEST_OTP_NUMBERS / TEST_OTP_CODE set (lib/testOtp.ts) and .data/qa-family.json with the same code.
 * The QA student BJC-2027-JEE-0001 was admitted through the real CRM workflow (tests/e2e/admission-workflow).
 */
const FILE = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null;
test.skip(!qa, 'No .data/qa-family.json');

async function otpLogin(page: Page, phone: string) {
  await page.goto('/app/login');
  await page.locator('input[type=tel]').first().fill(phone.replace(/^\+91/, ''));
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.locator('input[name=code]'), 'OTP step (fails while test numbers are not configured on this deployment)').toBeVisible({ timeout: 30_000 });
  await page.locator('input[name=code]').fill(qa.otpCode);
  await page.locator('form').filter({ has: page.locator('input[name=code]') }).getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/app/login'), { timeout: 60_000 });
  await page.waitForLoadState('networkidle'); // the app finishes its own redirect first
  if (new URL(page.url()).pathname.startsWith('/app/consent')) {
    await page.locator('input[name=agree]').check({ force: true });
    await page.getByRole('button', { name: /agree|continue|accept/i }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/app/consent'));
  }
}

async function signOut(page: Page) {
  await page.goto('/app');
  await page.getByRole('button', { name: /sign out|log out/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/app') || u.pathname.startsWith('/app/login'));
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/login/);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(5 * 60_000);

test('unknown number gets the same answer and no code (no account enumeration)', async ({ page }) => {
  await page.goto('/app/login');
  await page.locator('input[type=tel]').first().fill('9000099199');
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.waitForTimeout(4000);
  await expect(page.locator('body')).not.toContainText(qa.otpCode);
  await expectHealthy(page);
});

test('wrong OTP is refused', async ({ page }) => {
  await page.goto('/app/login');
  await page.locator('input[type=tel]').first().fill(qa.numbers.parent.replace(/^\+91/, ''));
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.locator('input[name=code]')).toBeVisible({ timeout: 30_000 });
  await page.locator('input[name=code]').fill(qa.otpCode === '482915' ? '482916' : '482915');
  await page.locator('form').filter({ has: page.locator('input[name=code]') }).getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('body')).toContainText(/incorrect|invalid|wrong|expired/i);
});

test('parent: OTP sign-in, sees only the linked child, attendance (absent + remark), published marks, fee receipt', async ({ page }) => {
  await otpLogin(page, qa.numbers.parent);
  await expect(page.locator('body')).toContainText(qa.studentName);
  for (const p of ['/app', '/app/attendance', '/app/results', '/app/fees', '/app/more']) {
    const r = await page.goto(p);
    expect(r?.status() ?? 0, p).toBeLessThan(500);
    await expect(page.locator('body'), p).not.toContainText(CRASH);
  }
  await page.goto('/app/attendance');
  await expect(page.locator('body')).toContainText(/absent/i);
  await page.goto('/app/results');
  await expect(page.locator('body')).toContainText('QA Physics Unit Test 1');
  await expect(page.locator('body')).toContainText('78');
  await page.goto('/app/fees');
  await expect(page.locator('body')).toContainText('BJC/2027-28/00001');

  // forged profile key for a child that is not theirs: ignored, still the linked child only
  // (same session: the app allows 3 codes per number per 10 minutes)
  const context = page.context();
  const origin = new URL(page.url()).origin;
  await context.addCookies([{ name: 'bjc_app_profile', value: 'p:00000000-0000-4000-8000-000000000000', url: origin }]);
  await page.goto('/app');
  await expect(page.locator('body')).toContainText(qa.studentName);
  await signOut(page);
});

test('student: OTP sign-in, sets a College ID password, then signs in with College ID + password', async ({ page }) => {
  await otpLogin(page, qa.numbers.student);
  await expect(page.locator('body')).toContainText(qa.collegeId);
  await page.goto('/app/more');
  const pw = `Qa-Student-${qa.otpCode}-x`;
  const f = page.locator('form').filter({ has: page.locator('input[name=confirm]') });
  await f.locator('input[name=password]').fill(pw);
  await f.locator('input[name=confirm]').fill(pw);
  await f.getByRole('button').first().click();
  await expect(page.locator('body')).toContainText(/Password set/i);
  await signOut(page);
  await page.goto('/app/login');
  await page.getByRole('button', { name: /Sign in with College ID/ }).click(); // the form is folded away
  await page.locator('input[name=collegeId]').fill(qa.collegeId);
  await page.locator('input[name=password]').fill(pw);
  await page.locator('form').filter({ has: page.locator('input[name=collegeId]') }).getByRole('button').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/app/login'), { timeout: 60_000 });
  await expect(page.locator('body')).toContainText(qa.collegeId);
});

test('applicant: OTP sign-in shows the admission tracker', async ({ page }) => {
  await otpLogin(page, qa.numbers.applicant);
  await expect(page.locator('body')).toContainText(/QA Test Applicant|application|admission/i);
  await expectHealthy(page);
  await signOut(page);
});

test('alumni: OTP sign-in opens the alumni network', async ({ page }) => {
  await otpLogin(page, qa.numbers.alumni);
  await page.goto('/app/alumni');
  await expect(page.locator('body')).toContainText(/alumni/i);
  await expectHealthy(page);
});
