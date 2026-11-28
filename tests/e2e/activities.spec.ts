import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { CRASH, qaStudentPassword, staffFor, staffLogin, studentIdLogin } from './helpers';

/**
 * Yoga & wellness programs on production with the QA batch: the sports coach creates a QA program for QA JEE 1A only
 * (so its notice reaches QA students only), the QA student registers, the coach marks attendance, the student sees it,
 * the coach pauses the program. Leaves one paused "QA yoga …" program. Then role checks for the Student life tab.
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.describe.configure({ mode: 'serial' });
test.setTimeout(4 * 60_000);
const TITLE = `QA yoga ${Date.now().toString(36).slice(-5)}`;
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });

test('coach creates a program; student registers; coach marks attendance; student sees it; coach pauses', async ({ browser }) => {
  test.skip(!qa || process.env.QA_RUN_ACTIVITIES !== '1', 'Set QA_RUN_ACTIVITIES=1 (creates a QA program)');
  const sctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const s = await sctx.newPage();
  await staffLogin(s, staffFor('sports_coach'));
  await s.goto('/crm/activities');
  await expect(s.locator('body')).not.toContainText(CRASH);
  await s.locator('input[name=title]').fill(TITLE);
  await s.locator('select[name=kind]').selectOption('yoga');
  await s.locator('input[name=instructor]').fill('QA Instructor');
  for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) await s.locator(`input[name=days][value=${d}]`).check();
  await s.locator('select[name=audience]').selectOption({ label: 'Batch QA JEE 1A' });
  await s.getByRole('button', { name: 'Create program' }).click();
  await expect(s.getByText(/Program created/)).toBeVisible({ timeout: 30_000 });

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await studentIdLogin(p, qa.collegeId, qaStudentPassword(qa.otpCode));
  await p.goto('/app/activities');
  await expect(p.locator('body')).not.toContainText(CRASH);
  const card = p.locator('article', { hasText: TITLE });
  await card.getByRole('button', { name: 'Register' }).click();
  await expect(p.getByText(/Registered\. See you there/)).toBeVisible({ timeout: 20_000 });

  await s.reload();
  await s.locator('details', { hasText: TITLE }).locator('summary').click();
  const form = s.locator('details', { hasText: TITLE }).locator('form', { has: s.locator('input[name=present]') });
  await form.locator('input[name=present]').first().check();
  await form.getByRole('button', { name: 'Save attendance' }).click();
  await expect(s.getByText(/Attendance saved: 1 present/)).toBeVisible({ timeout: 20_000 });

  await p.reload();
  await expect(p.getByText(new RegExp(`${TITLE}: attended 1 of 1`))).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'app-yoga-wellness.png'), fullPage: true });

  await s.reload();
  await s.locator('details', { hasText: TITLE }).locator('summary').click();
  await s.locator('details', { hasText: TITLE }).getByRole('button', { name: 'Pause program' }).click();
  await s.reload();
  await expect(s.locator('details', { hasText: TITLE }).getByText('paused')).toBeVisible({ timeout: 20_000 });
  await s.screenshot({ path: path.join(SHOTS, 'crm-yoga-wellness.png'), fullPage: true });
  await p.reload();
  await expect(p.locator('article', { hasText: TITLE })).toHaveCount(0);
  await ctx.close();
  await sctx.close();
});

test('principal sees the Student life tab; telecaller does not and cannot open the timetable', async ({ browser }) => {
  const a = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await a.newPage();
  await staffLogin(p, staffFor('principal'));
  await p.goto('/crm/analytics?tab=life&preset=year');
  await expect(p.locator('body')).not.toContainText(CRASH);
  for (const t of ['Sports & physical education', 'Yoga, wellness & practice programs', 'Motivation & personal development']) await expect(p.getByText(t).first()).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'analytics-student-life.png'), fullPage: true });
  await a.close();
  const b = await browser.newContext();
  const t = await b.newPage();
  await staffLogin(t, staffFor('telecaller'));
  await t.goto('/crm/analytics?tab=life');
  await expect(t.locator('body')).not.toContainText('Sports & physical education');
  await t.goto('/crm/activities');
  await expect(t.getByText(/No access/).first()).toBeVisible();
  await b.close();
});
