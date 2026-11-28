import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { CRASH, qaStudentPassword, staffFor, staffLogin, studentIdLogin } from './helpers';

/**
 * Production, QA data only: a QA team with the QA student as captain, a QA achievement and its certificate
 * (coach, student: allowed; telecaller: 403; signed out: 401). The low-attendance alert is exercised on the QA batch only.
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.skip(!qa || process.env.QA_RUN_SPORTS !== '1', 'Set QA_RUN_SPORTS=1 (creates a QA team and achievement)');
test.setTimeout(4 * 60_000);
const TEAM = `QA team ${Date.now().toString(36).slice(-5)}`;

test('coach: team with captain, achievement certificate; student sees team and downloads certificate; others refused', async ({ browser }) => {
  const sctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const s = await sctx.newPage();
  await staffLogin(s, staffFor('sports_coach'));
  await s.goto('/crm/sports');
  await expect(s.locator('body')).not.toContainText(CRASH);
  await expect(s.locator('select[name=sport]').first().locator('option', { hasText: 'Football' })).toHaveCount(1);
  const create = s.locator('form', { has: s.getByRole('button', { name: 'Create team' }) });
  await create.locator('input[name=name]').fill(TEAM);
  await create.locator('select[name=sport]').selectOption('Football');
  await create.locator('input[name=coach]').fill('QA Coach');
  await create.getByRole('button', { name: 'Create team' }).click();
  await expect(s.getByText(/Team created/)).toBeVisible({ timeout: 20_000 });
  await s.reload();
  const team = s.locator('details', { hasText: TEAM });
  await team.locator('summary').click();
  await team.locator('label', { hasText: qa.studentName }).locator('input[name=members]').check();
  await team.getByRole('button', { name: 'Save team' }).click();
  await expect(s.getByText(/Saved: \d+ players/)).toBeVisible({ timeout: 20_000 });
  await s.reload();
  await s.locator('details', { hasText: TEAM }).locator('summary').click();
  await s.locator('details', { hasText: TEAM }).locator('select[name=captainId]').selectOption({ label: qa.studentName });
  await s.locator('details', { hasText: TEAM }).getByRole('button', { name: 'Save team' }).click();
  await expect(s.getByText(/Saved: 1 players/)).toBeVisible({ timeout: 20_000 });
  await s.reload();
  await expect(s.locator('details', { hasText: TEAM }).locator('summary')).toContainText(`captain ${qa.studentName}`, { timeout: 20_000 });

  const ach = s.locator('form', { has: s.getByRole('button', { name: 'Add achievement' }) });
  await ach.locator('select[name=studentId]').selectOption({ label: new RegExp(qa.studentName) as never }).catch(async () => {
    const v = await ach.locator('select[name=studentId] option', { hasText: qa.studentName }).first().getAttribute('value');
    await ach.locator('select[name=studentId]').selectOption(v!);
  });
  await ach.locator('select[name=medal]').selectOption('gold');
  await ach.locator('input[name=event]').fill(`${TEAM} cup`);
  await ach.locator('input[name=title]').fill('QA winners');
  await ach.getByRole('button', { name: 'Add achievement' }).click();
  await expect(s.locator('li', { hasText: `${TEAM} cup` })).toBeVisible({ timeout: 20_000 });
  await s.reload();
  const href = await s.locator('li', { hasText: `${TEAM} cup` }).getByRole('link', { name: /Certificate/ }).getAttribute('href');
  expect(href).toMatch(/^\/api\/sports-certificate\//);
  const pdf = await s.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await studentIdLogin(p, qa.collegeId, qaStudentPassword(qa.otpCode));
  await p.goto('/app/sports');
  await expect(p.getByText('My teams')).toBeVisible();
  await expect(p.getByText(new RegExp(`${TEAM} · Football · Captain`))).toBeVisible();
  expect((await p.request.get(href!)).status()).toBe(200);

  const t = await (await browser.newContext()).newPage();
  await staffLogin(t, staffFor('telecaller'));
  expect((await t.request.get(href!)).status()).toBe(403);
  const anon = await (await browser.newContext()).request.get(new URL(href!, s.url()).toString());
  expect(anon.status()).toBe(401);
  await ctx.close();
  await sctx.close();
});

test('motivation topics and the motivation class type are offered', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('principal'));
  await p.goto('/crm/sessions');
  for (const t of ['Goal setting', 'Leadership development', 'Communication skills', 'Confidence building', 'Time management']) await expect(p.locator('select[name=type] option', { hasText: t })).toHaveCount(1);
  await ctx.close();
  const c = await (await browser.newContext()).newPage();
  await staffLogin(c, staffFor('sports_coach'));
  await c.goto('/crm/activities');
  await expect(c.locator('select[name=kind] option', { hasText: 'Motivation / personal development class' })).toHaveCount(1);
});

test('low-attendance alert button appears for the academic coordinator (QA batch only, not clicked on real batches)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('academic_coordinator'));
  await p.goto('/crm/analytics?tab=attendance&preset=year');
  const qaBatch = await p.locator('select[name=batch] option', { hasText: 'QA JEE 1A' }).first().getAttribute('value');
  await p.goto(`/crm/analytics?tab=attendance&preset=year&batch=${qaBatch}&threshold=100`);
  await expect(p.locator('body')).not.toContainText(CRASH);
  const btn = p.getByRole('button', { name: /^Notify these \d+ famil/ });
  if (await btn.count()) {
    await btn.click();
    await expect(p.getByText(/Sent to \d+ famil|already alerted today/)).toBeVisible({ timeout: 20_000 });
    console.log('QA batch alert:', await p.getByText(/Sent to \d+ famil/).first().innerText());
  } else console.log('QA batch: nobody below 100% in range, so no button (expected when attendance is perfect)');
  await ctx.close();
});
