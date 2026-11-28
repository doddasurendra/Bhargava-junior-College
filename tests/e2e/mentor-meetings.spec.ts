import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { CRASH, qaStudentPassword, staffFor, staffLogin, studentIdLogin } from './helpers';

/**
 * Mentor meetings + in-app reminders on production with the QA student and their QA mentor (class teacher).
 * Writes one QA meeting and one shared QA mentor note for the QA student.
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.skip(!qa || process.env.QA_RUN_MENTOR !== '1', 'Set QA_RUN_MENTOR=1 (creates a QA mentor meeting)');
test.setTimeout(4 * 60_000);
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
const TAG = `QA meeting ${Date.now().toString(36).slice(-5)}`;

test('student requests; mentor sets a time; it shows in Coming up; mentor shares the outcome; student sees it', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await studentIdLogin(p, qa.collegeId, qaStudentPassword(qa.otpCode));
  await p.goto('/app/mentor');
  await expect(p.locator('body')).not.toContainText(CRASH);
  await p.locator('textarea[name=reason]').fill(TAG);
  await p.getByRole('button', { name: 'Send request' }).click();
  await expect(p.getByText(/Request sent|already have a request/)).toBeVisible({ timeout: 20_000 });

  const sctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const s = await sctx.newPage();
  await staffLogin(s, staffFor('class_teacher'));
  await s.goto('/crm/mentor');
  await expect(s.locator('body')).not.toContainText(CRASH);
  const req = s.locator('div.rounded-lg', { hasText: 'asked for a meeting' }).first();
  await req.locator('input[name=time]').fill('23:30');
  await req.getByRole('button', { name: 'Set time' }).click();
  // the request moves to Upcoming (its form, and the message, unmount): that is the confirmation
  await expect(s.locator('details', { hasText: TAG }).first()).toBeVisible({ timeout: 20_000 });

  await p.goto('/app');
  await expect(p.getByText('Coming up: today & tomorrow')).toBeVisible();
  await expect(p.getByText('Meeting with your mentor').first()).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'app-coming-up.png'), fullPage: true });

  await s.reload();
  const m = s.locator('details', { hasText: TAG }).first();
  await m.locator('summary').click();
  await m.locator('select[name=status]').selectOption('held');
  await m.locator('textarea[name=outcome]').fill(`${TAG}: plan agreed`);
  await m.locator('input[name=share]').check();
  await m.getByRole('button', { name: 'Save outcome' }).click();
  await expect(s.locator('details', { hasText: TAG })).toHaveCount(0, { timeout: 20_000 });
  await expect(s.getByText(/Recent: .*held/)).toBeVisible();
  await s.screenshot({ path: path.join(SHOTS, 'crm-mentor-meetings.png'), fullPage: true });

  await p.goto('/app/mentor');
  await expect(p.getByText(`${TAG}: plan agreed`)).toBeVisible();
  await ctx.close();
  await sctx.close();
});
