import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { qaStudentPassword, staffFor, staffLogin, studentIdLogin } from './helpers';

/**
 * Simple student sign-up on production. Uses the two QA students:
 *  - BJC-2027-JEE-0001 (QA Test Student): already has an account → "already exists"; parent + office reset; block.
 *  - BJC-2027-JEE-0002 (QA Workflow Student 5620): no account yet → a real sign-up (Supabase Auth user is created).
 * The QA student's password is put back to its usual value at the end.
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.skip(!qa || process.env.QA_RUN_SIGNUP !== '1', 'Set QA_RUN_SIGNUP=1 (creates a QA student account)');
test.describe.configure({ mode: 'serial' });
test.setTimeout(4 * 60_000);
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
const PW = qaStudentPassword(qa?.otpCode ?? '');
const NEW_ID = 'BJC-2027-JEE-0002', NEW_NAME = 'QA Workflow Student 5620', DOB = '2010-06-15';
const NEW_PW = `Wf${Date.now().toString(36)}9x`;

async function phone(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  return ctx.newPage();
}
async function fill(p: Page, v: { name: string; id: string; dob: string; pw: string; confirm?: string; consent?: boolean }) {
  await p.goto('/app/register/student');
  await p.locator('input[name=name]').fill(v.name);
  await p.locator('input[name=collegeId]').fill(v.id);
  await p.locator('input[name=dob]').fill(v.dob);
  await p.locator('input[name=password]').fill(v.pw);
  await p.locator('input[name=confirm]').fill(v.confirm ?? v.pw);
  if (v.consent !== false) await p.locator('input[name=consent]').check();
  await p.getByRole('button', { name: 'Create account' }).click();
}
async function parentLogin(browser: Browser) {
  const p = await phone(browser);
  await p.goto('/app/login?as=parent');
  await p.locator('input[type=tel]').first().fill(qa.numbers.parent.replace(/^\+91/, ''));
  await p.getByRole('button', { name: 'Send sign-in code' }).click();
  await p.locator('input[name=code]').fill(qa.otpCode);
  await p.locator('form').filter({ has: p.locator('input[name=code]') }).getByRole('button', { name: 'Sign in' }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/app/login'), { timeout: 60_000 });
  return p;
}
async function resetWith(p: Page, code: string, pw: string) {
  await p.goto('/app/forgot-password');
  await p.locator('input[name=collegeId]').fill(qa.collegeId);
  await p.locator('input[name=code]').fill(code);
  await p.locator('input[name=password]').fill(pw);
  await p.locator('input[name=confirm]').fill(pw);
  await p.getByRole('button', { name: 'Set new password' }).click();
  await expect(p.getByText('Password changed.')).toBeVisible({ timeout: 30_000 });
}

test('page: one form with exactly the agreed fields; DOB empty; no email or mobile; phone width', async ({ browser }) => {
  const p = await phone(browser);
  await p.goto('/app/register/student');
  await expect(p.getByRole('heading', { name: 'Student sign-up' })).toBeVisible();
  for (const n of ['name', 'collegeId', 'dob', 'password', 'confirm', 'consent']) await expect(p.locator(`input[name=${n}]`)).toHaveCount(1);
  await expect(p.locator('input[type=email], input[type=tel], input[name=phone], input[name=email]')).toHaveCount(0);
  await expect(p.locator('input[name=dob]')).toHaveValue('');
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await p.screenshot({ path: path.join(SHOTS, 'student-signup.png'), fullPage: true });
  // field rules, shown under each field
  await fill(p, { name: 'R', id: 'abc', dob: '2020-01-01', pw: 'abcdefgh', confirm: 'zz', consent: false });
  await expect(p.getByText('Use at least one letter and one number.')).toBeVisible();
  await expect(p.getByText('Please agree to the terms and privacy policy to continue.')).toBeVisible();
  await expect(p.locator('input[name=name]')).toBeFocused();
  await p.context().close();
});

test('wrong DOB / unknown College ID → the same generic message; existing account → "already exists"', async ({ browser }) => {
  const p = await phone(browser);
  const generic = 'These details don’t match our records. Check your College ID and date of birth, or contact the admin office.';
  await fill(p, { name: NEW_NAME, id: NEW_ID, dob: '2010-06-16', pw: NEW_PW });
  await expect(p.locator('form [role=alert]')).toHaveText(generic);
  await fill(p, { name: NEW_NAME, id: 'BJC-2027-JEE-9999', dob: DOB, pw: NEW_PW });
  await expect(p.locator('form [role=alert]')).toHaveText(generic);
  await fill(p, { name: qa.studentName, id: qa.collegeId, dob: qa.dob, pw: NEW_PW });
  await expect(p.locator('form [role=alert]')).toContainText('An account already exists for this College ID.');
  await expect(p.locator('form [role=alert]').getByRole('link', { name: 'reset your password' })).toBeVisible();
  await p.context().close();
});

test('correct details create the account (no email) and sign the student in; signing up again says it exists; sign-in works, wrong password fails', async ({ browser }) => {
  const p = await phone(browser);
  await fill(p, { name: 'qa workflow  student 5620', id: NEW_ID.toLowerCase(), dob: DOB, pw: NEW_PW });
  await p.waitForURL(/\/app(\?welcome=1)?$/, { timeout: 60_000 });
  if (new URL(p.url()).pathname.startsWith('/app/consent')) await p.goto('/app?welcome=1');
  await expect(p.getByText('Account created.')).toBeVisible();
  await expect(p.locator('body')).toContainText(NEW_ID);
  await p.context().close();
  const q = await phone(browser);
  await fill(q, { name: NEW_NAME, id: NEW_ID, dob: DOB, pw: NEW_PW });
  await expect(q.locator('form [role=alert]')).toContainText('already exists');
  await studentIdLogin(q, NEW_ID, NEW_PW);
  await expect(q.locator('body')).toContainText(NEW_ID);
  await q.context().close();
  const w = await phone(browser);
  await w.goto('/app/login?as=student');
  await w.locator('input[name=collegeId]').fill(NEW_ID);
  await w.locator('input[name=password]').fill(NEW_PW + 'x');
  await w.getByRole('button', { name: 'Sign in' }).click();
  await expect(w.locator('body')).toContainText(/incorrect/i);
  await w.context().close();
});

test('QA student: older password still signs in (moved into Supabase Auth); parent sees the account; parent reset code works; old password stops working', async ({ browser }) => {
  const s = await phone(browser);
  await studentIdLogin(s, qa.collegeId, PW);
  await s.context().close();
  const par = await parentLogin(browser);
  await par.goto('/app/student-account');
  await expect(par.getByText(/Status: Active/)).toBeVisible();
  await par.getByRole('button', { name: 'Reset student password' }).click();
  const code = (await par.getByTestId('reset-code').innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);
  const r = await phone(browser);
  const tmp = `Tmp${Date.now().toString(36)}7`;
  await resetWith(r, code, tmp);
  await r.goto('/app/login?as=student');
  await r.locator('input[name=collegeId]').fill(qa.collegeId);
  await r.locator('input[name=password]').fill(PW);
  await r.getByRole('button', { name: 'Sign in' }).click();
  await expect(r.locator('body')).toContainText(/incorrect/i); // old password no longer works
  await studentIdLogin(r, qa.collegeId, tmp);
  await r.context().close();
  // admin office: reset code (24 h) → put the usual QA password back
  const ctx = await browser.newContext();
  const o = await ctx.newPage();
  await staffLogin(o, staffFor('admin_office'));
  const sid = await (async () => { await o.goto('/crm/students'); await o.getByRole('link', { name: new RegExp(qa.studentName) }).first().click(); return o.url(); })();
  await expect(o.getByTestId('student-account-status')).toHaveText('Active');
  await o.getByRole('button', { name: 'Reset password (one-time code)' }).click();
  const msg = await o.getByText(/One-time code \d{6}/).innerText();
  const officeCode = /One-time code (\d{6})/.exec(msg)![1];
  const back = await phone(browser);
  await resetWith(back, officeCode, PW);
  await studentIdLogin(back, qa.collegeId, PW);
  await back.context().close();
  // parent blocks → sign-in refused; admin office enables again
  await par.goto('/app/student-account');
  await par.locator('input[name=confirm]').check();
  await par.getByRole('button', { name: 'Block student account' }).click();
  await expect(par.getByText(/blocked and signed out everywhere/)).toBeVisible();
  const b = await phone(browser);
  await b.goto('/app/login?as=student');
  await b.locator('input[name=collegeId]').fill(qa.collegeId);
  await b.locator('input[name=password]').fill(PW);
  await b.getByRole('button', { name: 'Sign in' }).click();
  await expect(b.locator('body')).toContainText('This account is blocked');
  await o.goto(sid);
  await expect(o.getByTestId('student-account-status')).toHaveText('Blocked by a parent');
  await o.getByRole('button', { name: 'Enable account' }).click();
  await expect(o.getByTestId('student-account-status')).toHaveText('Active', { timeout: 30_000 });
  await o.getByRole('button', { name: 'Disable account' }).click();
  await expect(o.getByTestId('student-account-status')).toHaveText('Disabled by the admin office', { timeout: 30_000 });
  await o.getByRole('button', { name: 'Enable account' }).click();
  await expect(o.getByTestId('student-account-status')).toHaveText('Active', { timeout: 30_000 });
  await studentIdLogin(b, qa.collegeId, PW);
  await ctx.close(); await par.context().close(); await b.context().close();
});

test('rate limit: a 6th sign-up attempt for one College ID in a day is refused; Telugu page works', async ({ browser }) => {
  const p = await phone(browser);
  for (let i = 0; i < 6; i++) await fill(p, { name: 'Nobody Here', id: 'BJC-2027-JEE-0999', dob: '2010-01-01', pw: 'mango77river' });
  await expect(p.locator('form [role=alert]')).toHaveText('Too many attempts. Please try again later.');
  await p.context().addCookies([{ name: 'bjc_lang', value: 'te', url: new URL(p.url()).origin }]);
  await p.goto('/app/register/student');
  await expect(p.getByRole('heading', { name: 'విద్యార్థి సైన్-అప్' })).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'student-signup-telugu.png'), fullPage: true });
  await p.context().close();
});

test('parent sign-in still works', async ({ browser }) => {
  const p = await parentLogin(browser);
  await expect(p.locator('body')).toContainText(qa.studentName);
  await p.context().close();
});
