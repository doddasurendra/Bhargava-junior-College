import { test } from '@playwright/test';
import { staffFor, staffLogin } from './helpers';

/** Diagnostic: what the server returns for the AI summary action on production. */
test.skip(process.env.QA_RUN_AI !== '1', 'Set QA_RUN_AI=1');
test.setTimeout(3 * 60_000);
test('probe AI summary action response', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await staffLogin(p, staffFor('academic_coordinator'));
  await p.goto('/crm/analytics?tab=academics');
  await p.locator('a[href^="/crm/analytics/student/"]').first().click();
  await p.waitForLoadState('networkidle');
  const t0 = Date.now();
  const resP = p.waitForResponse((r) => r.request().method() === 'POST', { timeout: 150_000 });
  await p.getByRole('button', { name: 'Write an AI summary of these figures' }).click();
  const res = await resP;
  console.log('action status', res.status(), 'after', Math.round((Date.now() - t0) / 1000), 's', 'body:', (await res.text().catch(() => '')).slice(0, 300).replace(/\s+/g, ' '));
  await p.waitForTimeout(3000);
  const st = p.locator('p[role=status], p[role=alert]').filter({ hasText: /\S/ });
  console.log('shown:', (await st.count()) ? (await st.first().innerText()).slice(0, 300).replace(/\s+/g, ' ') : '(nothing)');
});
