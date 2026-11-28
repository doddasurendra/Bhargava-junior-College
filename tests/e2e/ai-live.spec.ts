import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { CRASH, qaStudentPassword, staffFor, staffLogin, studentIdLogin } from './helpers';

/**
 * Real AI calls on production (needs ANTHROPIC_API_KEY / VOYAGE_API_KEY in Vercel). Writes: one AI summary view
 * (not stored), 2 AI questions waiting for review in the Open Book bank, one assistant turn.
 */
const FAM = path.join(process.cwd(), '.data', 'qa-family.json');
const qa = existsSync(FAM) ? JSON.parse(readFileSync(FAM, 'utf8')) : null;
test.skip(process.env.QA_RUN_AI !== '1', 'Set QA_RUN_AI=1 (makes real, billed AI calls)');
test.describe.configure({ mode: 'serial' });
test.setTimeout(4 * 60_000);

test('server reports Anthropic and Voyage configured', async ({ browser }) => {
  const d = await (await browser.newContext()).newPage();
  await staffLogin(d, staffFor('developer'));
  await d.goto('/crm/developer');
  const row = d.locator('dl > div', { has: d.locator('dt', { hasText: 'ANTHROPIC_API_KEY' }) }).first();
  console.log('anthropic:', (await row.innerText()).replace(/\s+/g, ' '));
  await expect(row).not.toContainText('not set');
  const a = await (await browser.newContext()).newPage();
  await staffLogin(a, staffFor('super_admin'));
  await a.goto('/crm/knowledge/supabase');
  const emb = a.locator('li', { hasText: 'Embeddings:' }).first();
  console.log('voyage:', (await emb.innerText()).replace(/\s+/g, ' '));
  await expect(emb).not.toContainText('not configured');
});

test('student AI summary is written from the computed figures', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await staffLogin(p, staffFor('academic_coordinator'));
  await p.goto('/crm/analytics?tab=academics');
  const link = p.locator('a[href^="/crm/analytics/student/"]').first();
  test.skip(!(await link.count()), 'no student with results to summarise');
  await link.click();
  await p.getByRole('button', { name: 'Write an AI summary of these figures' }).click();
  const out = p.locator('[role=status], .whitespace-pre-line').filter({ hasNotText: /^$/ }).last();
  await expect(p.getByText(/not configured|went wrong|rejected/i)).toHaveCount(0, { timeout: 90_000 });
  await expect(out).toBeVisible({ timeout: 90_000 });
  console.log('summary:', (await out.innerText()).slice(0, 300).replace(/\s+/g, ' '));
});

test('AI generates bank questions for review (duplicates checked)', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await staffLogin(p, staffFor('academic_coordinator'));
  await p.goto('/crm/openbook?tab=bank');
  await expect(p.locator('body')).not.toContainText(CRASH);
  const f = p.locator('form', { has: p.getByRole('button', { name: 'Generate for review' }) });
  await f.locator('input[name=chapter]').fill('Laws of Motion');
  await f.locator('input[name=concept]').fill("Newton's second law");
  await f.locator('input[name=count]').fill('2');
  await f.getByRole('button', { name: 'Generate for review' }).click();
  const msg = p.locator('p[role=status], p[role=alert]').filter({ hasText: /\S/ }).first();
  await expect(msg).toBeVisible({ timeout: 150_000 });
  console.log('generate:', await msg.innerText());
  await expect(msg).toContainText('added for review');
});

test('assistant answers with Claude (not the fallback); student AI pages switched on', async ({ browser, request }) => {
  const r = await request.post('/api/voice/turn', { data: { text: 'What programs does Bhargava Junior College offer?', lang: 'en' } });
  const j = await r.json();
  console.log('voice:', r.status(), 'fallback=', j.fallback ?? j.data?.fallback, '|', String(j.caption ?? j.data?.caption ?? j.error ?? '').slice(0, 200).replace(/\s+/g, ' '));
  expect(r.status()).toBe(200);
  expect(j.fallback ?? j.data?.fallback).toBe(false);
  if (!qa) return;
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await studentIdLogin(p, qa.collegeId, qaStudentPassword(qa.otpCode));
  await p.goto('/app/openbook/assistant');
  await expect(p.getByText('AI answers are not switched on yet')).toHaveCount(0);
  await p.goto('/app/openbook/tutor');
  await expect(p.getByText(/hasn’t switched on yet/)).toHaveCount(0);
});

test('library search is semantic', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await staffLogin(p, staffFor('super_admin'));
  await p.goto('/crm/knowledge/search?q=admission%20documents%20required');
  await expect(p.locator('body')).not.toContainText(CRASH);
  const line = p.getByText(/result\(s\) in \d+ ms/).first();
  console.log('search:', await line.innerText());
  await expect(line).toContainText('+ semantic');
});
