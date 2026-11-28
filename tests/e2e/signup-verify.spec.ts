import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { CRASH, staffFor, staffLogin } from './helpers';

/**
 * Production, QA data only, cleaned up at the end:
 * unknown College ID → pending (DOB typed as 28/11/2010) · same details again → friendly "already have an account" ·
 * QA College ID with another name → pending + conflict · pending cannot open private pages · admin office sees the
 * queue and conflict · CSV import of the matching record links the pending account (active) · all QA sign-ups and the
 * imported QA record are marked Test and the Super Admin deletes the test sign-ups (student records are kept, marked Test).
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.skip(!qa || process.env.QA_RUN_SIGNUP2 !== '1', 'Set QA_RUN_SIGNUP2=1 (creates and removes QA sign-ups)');
test.describe.configure({ mode: 'serial' });
test.setTimeout(6 * 60_000);
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
const tag = Date.now().toString(36).slice(-4).toUpperCase();
const CID = `BJC-2027-JEE-9${String(Date.now() % 1000).padStart(3, '0')}`;
const NAME = `QA Pending ${tag}`;
const PW = `Qa-${tag}-pass9`;

async function signUp(p: Page, name: string, cid: string, dobText: string, pw: string) {
  await p.goto('/app/register/student');
  await p.locator('input[name=name]').fill(name);
  await p.locator('input[name=collegeId]').fill(cid);
  // type the date the way people write it in India (DD/MM/YYYY, en-IN date field); the server stores YYYY-MM-DD with no time-zone shift
  const dob = p.locator('input[name=dob]');
  if (/^\d{4}-/.test(dobText)) await dob.fill(dobText);
  await p.locator('input[name=password]').fill(pw);
  await p.locator('input[name=confirm]').fill(pw);
  await p.locator('input[name=consent]').check();
  if (!/^\d{4}-/.test(dobText)) {
    // submit the literal text as typed (28/11/2010): set type + value together right before submitting
    await dob.evaluate((el: HTMLInputElement, v) => { el.type = 'text'; el.value = v; }, dobText);
    await expect(dob).toHaveValue(dobText);
  }
  await p.getByRole('button', { name: 'Create account' }).click();
}

test('sign-up cases, pending limits, admin office queue, import auto-link, test clean-up', async ({ browser }) => {
  // B: unknown College ID → pending
  const sc = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-IN' });
  const s = await sc.newPage();
  await signUp(s, NAME, CID, '28/11/2010', PW);
  await expect(s).toHaveURL(/\/app\?welcome=pending/, { timeout: 60_000 });
  await expect(s.getByTestId('signup-pending')).toContainText('The admin office will verify your details soon');
  await expect(s.getByTestId('pending-banner')).toBeVisible();
  await expect(s.locator('body')).not.toContainText('match our records');
  await s.screenshot({ path: path.join(SHOTS, 'task2-pending-verification.png'), fullPage: true });
  // limited access: private pages refused on the server, general ones open
  for (const priv of ['/app/attendance', '/app/results', '/app/fees', '/app/hostel']) { await s.goto(priv); await expect(s.getByTestId('pending-blocked'), priv).toBeVisible(); }
  await s.goto('/app/openbook');
  await expect(s.getByTestId('pending-blocked')).toHaveCount(0);
  await expect(s.locator('body')).not.toContainText(CRASH);

  // D: same details again → friendly information, no new account
  const dc = await browser.newContext();
  const d = await dc.newPage();
  await signUp(d, NAME.toLowerCase(), CID.replace(/-/g, '').toLowerCase(), '2010-11-28', PW);
  await expect(d.getByTestId('signup-exists')).toBeVisible({ timeout: 30_000 });
  await expect(d.getByTestId('signup-exists').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', /\/app\/login/);
  await expect(d.locator('[role=alert]').filter({ hasText: /\S/ })).toHaveCount(0);
  await dc.close();

  // E: the QA student's College ID (which has an account) with another name → pending + conflict
  const ec = await browser.newContext({ locale: 'en-IN' });
  const e = await ec.newPage();
  await signUp(e, `QA Conflict ${tag}`, qa.collegeId, '01/01/2010', PW);
  await expect(e).toHaveURL(/\/app\?welcome=pending/, { timeout: 60_000 });
  await ec.close();

  // admin office: queue + conflicts
  const oc = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const o = await oc.newPage();
  await staffLogin(o, staffFor('admin_office'));
  await o.goto('/crm/students?view=pending');
  await expect(o.getByTestId('pending-row').filter({ hasText: NAME })).toBeVisible();
  await o.screenshot({ path: path.join(SHOTS, 'task2-admin-pending-signups.png'), fullPage: true });
  await o.goto('/crm/students?view=conflicts');
  const conflict = o.getByTestId('conflict-row').filter({ hasText: `QA Conflict ${tag}` });
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText('Duplicate College ID');

  // import the matching record → the pending account is linked and becomes active
  await o.goto('/crm/students?view=import');
  const csv = `college_id,full_name,dob,gender,program,stay,guardian_name,guardian_phone\n${CID},${NAME},28/11/2010,male,iit-jee,day,QA Parent,${qa.numbers.parent.replace('+91', '')}\n`;
  await o.locator('input[name=file]').setInputFiles({ name: `qa-import-${tag}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await o.getByRole('button', { name: 'Import' }).click();
  await expect(o.getByText(/Import done: 1 rows · 1 new · 1 pending sign-ups linked/)).toBeVisible({ timeout: 60_000 });
  await s.goto('/app');
  await expect(s.getByTestId('pending-banner')).toHaveCount(0);
  await expect(s.getByText(CID).first()).toBeVisible();
  await expect(s.getByTestId('verified-notice')).toBeVisible();
  await s.screenshot({ path: path.join(SHOTS, 'task2-linked-after-import.png'), fullPage: true });
  await sc.close();

  // clean-up: mark the QA sign-ups and the imported QA record as Test; the Super Admin deletes test sign-ups
  await o.goto('/crm/students?view=test');
  // every QA sign-up (this run and any earlier interrupted run)
  const qaRows = o.locator('label', { hasText: /QA (Pending|Conflict) /i }).locator('input[name=pendingIds]');
  const nQa = await qaRows.count();
  for (let i = 0; i < nQa; i++) await qaRows.nth(i).check();
  await o.locator('label', { hasText: CID }).locator('input[name=studentIds]').check();
  await o.getByRole('button', { name: 'Mark selected as test' }).click();
  await expect(o.getByText(/\d+ record\(s\) marked as test/)).toBeVisible({ timeout: 30_000 });
  await oc.close();

  const ac = await browser.newContext();
  const a = await ac.newPage();
  await staffLogin(a, staffFor('super_admin'));
  await a.goto('/crm/students?view=test');
  await a.locator('input[name=confirm]').fill('DELETE');
  await a.getByRole('button', { name: /Delete \d+ test record/ }).click();
  await expect(a.getByText(/Deleted \d+ test sign-up\(s\) and \d+ test account\(s\)\. Student records were not touched/)).toBeVisible({ timeout: 60_000 });
  await ac.close();
});
