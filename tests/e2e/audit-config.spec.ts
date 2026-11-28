import { expect, test } from '@playwright/test';
import { staffFor, staffLogin } from './helpers';

/** Read-only: what the production server reports about its AI configuration (no values are ever shown). */
test('production AI configuration as the server sees it', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('super_admin'));
  await p.goto('/crm/openbook');
  for (const t of ['AI (question generation', 'Semantic duplicate check', 'Google Books:']) {
    const line = p.locator('li', { hasText: t }).first();
    if (await line.count()) console.log('openbook |', (await line.innerText()).replace(/\s+/g, ' ').slice(0, 160));
  }
  await p.goto('/crm/knowledge/supabase');
  const emb = p.locator('li', { hasText: 'Embeddings:' }).first();
  if (await emb.count()) console.log('kb |', (await emb.innerText()).replace(/\s+/g, ' ').slice(0, 160));
  await expect(p.locator('body')).toBeVisible();
  await ctx.close();
  const d = await (await browser.newContext()).newPage();
  await staffLogin(d, staffFor('developer'));
  await d.goto('/crm/developer');
  for (const t of ['ANTHROPIC_API_KEY', 'VOYAGE', 'GOOGLE_BOOKS']) { const row = d.locator('dl > div', { has: d.locator('dt', { hasText: t }) }).first(); if (await row.count()) console.log('dev |', (await row.innerText()).replace(/\s+/g, ' ').slice(0, 120)); }
});
