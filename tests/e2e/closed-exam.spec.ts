import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { qaStudentPassword, staffFor, staffLogin, studentIdLogin } from './helpers';

/**
 * Closed-book exam on production with the QA batch: the academic coordinator sets a 5-question exam; the QA student
 * takes it in full screen, leaves the window twice → auto-submitted; report + staff dashboard show the result and flags.
 * Writes one QA exam (title "QA closed exam …").
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.skip(!qa || process.env.QA_RUN_EXAM !== '1', 'Set QA_RUN_EXAM=1 (creates a QA exam)');
test.describe.configure({ mode: 'serial' });
test.setTimeout(4 * 60_000);
const TITLE = `QA closed exam ${Date.now().toString(36).slice(-5)}`;
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });

test('staff sets the exam; student takes it; leaving the window twice submits it; dashboards show it', async ({ browser }) => {
  // staff: create
  const sctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const s = await sctx.newPage();
  await staffLogin(s, staffFor('academic_coordinator'));
  await s.goto('/crm/exams');
  await s.locator('input[name=title]').fill(TITLE);
  await s.locator('select[name=batchId]').selectOption({ label: 'QA JEE 1A' }).catch(async () => { await s.locator('select[name=batchId]').selectOption({ index: 0 }); });
  await s.locator('select[name=examId]').selectOption('jee-main');
  await s.locator('input[name=count]').fill('5');
  await s.locator('input[name=minutes]').fill('10');
  await s.locator('input[name=maxFocusLoss]').fill('2');
  await s.getByRole('button', { name: 'Create exam' }).click();
  await expect(s.getByText(/Exam created/)).toBeVisible({ timeout: 60_000 });

  // student: take it
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await studentIdLogin(p, qa.collegeId, qaStudentPassword(qa.otpCode));
  await p.goto('/app/exams');
  const card = p.locator('li').filter({ hasText: TITLE });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Start exam' }).click();
  await p.waitForURL(/\/app\/exam\/[^/]+$/, { timeout: 60_000 });
  // no app menu / study material on the exam screen
  await expect(p.locator('nav')).toHaveCount(0);
  await p.getByRole('button', { name: /Enter full screen and start/ }).click();
  await expect(p.getByText(/Question 1 of 5/)).toBeVisible({ timeout: 20_000 });
  await p.screenshot({ path: path.join(SHOTS, 'closed-exam.png') });
  await p.locator('article button').first().click(); // answer Q1 (option a as shown)
  await p.waitForTimeout(1500);
  // leave the window twice (blur), 2 s apart
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(p.getByText(/left the exam window \(1 of 2\)/)).toBeVisible({ timeout: 20_000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  await p.waitForURL(/\/app\/exam\/report\//, { timeout: 60_000 });
  await expect(p.getByText(/submitted automatically/)).toBeVisible();
  await expect(p.getByText(/left the exam window 2 times/)).toBeVisible();
  await expect(p.getByText('Subject-wise')).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'closed-exam-report.png'), fullPage: true });
  await ctx.close();

  // staff: dashboard shows the attempt and the flag
  await s.goto('/crm/exams');
  await s.getByRole('link', { name: TITLE }).click();
  await expect(s.getByText(/auto-submitted/).first()).toBeVisible();
  await expect(s.getByText(/Suspicious activity \(1\)/)).toBeVisible();
  await s.screenshot({ path: path.join(SHOTS, 'closed-exam-dashboard.png'), fullPage: true });
  await sctx.close();
});
