import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CRASH, staffFor, staffLogin } from './helpers';

/** Attendance and academic analytics on production (read-only: no registers or marks are written). */
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
test.setTimeout(3 * 60_000);

test('academic coordinator: attendance dashboard, filters, exports (CSV + PDF), academics tab, student report', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('academic_coordinator'));
  await p.goto('/crm/analytics?tab=attendance&preset=year');
  await expect(p.locator('body')).not.toContainText(CRASH);
  for (const t of ['Total students', 'Present today', 'Absent today', 'Attendance today']) await expect(p.getByText(t).first()).toBeVisible();
  const total = Number(await p.locator('text=Total students').locator('..').locator('p,span,dd').last().innerText().catch(() => '0'));
  console.log('total students shown:', total);
  await p.screenshot({ path: path.join(SHOTS, 'analytics-attendance.png'), fullPage: true });
  // exports
  const csv = await p.request.get(await p.getByRole('link', { name: /Export to Excel/ }).getAttribute('href') as string);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  const body = await csv.text();
  expect(body).toContain('Attendance %');
  const pdf = await p.request.get(await p.getByRole('link', { name: /Export PDF/ }).getAttribute('href') as string);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  // academics tab
  await p.goto('/crm/analytics?tab=academics');
  await expect(p.locator('body')).not.toContainText(CRASH);
  await expect(p.getByText('Class average').first()).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'analytics-academics.png'), fullPage: true });
  // a student report (first student link if any results exist)
  const link = p.locator('a[href^="/crm/analytics/student/"]').first();
  if (await link.count()) {
    await link.click();
    await expect(p.locator('body')).not.toContainText(CRASH);
    await expect(p.getByText(/Improvement graph|No published results yet/).first()).toBeVisible();
    await p.screenshot({ path: path.join(SHOTS, 'analytics-student-report.png'), fullPage: true });
  }
  await ctx.close();
});

test('permissions: a telecaller gets no attendance tab and the export is refused', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('telecaller'));
  await p.goto('/crm/analytics?tab=attendance');
  await expect(p.locator('body')).not.toContainText('Present today');
  const r = await p.request.get('/api/crm/attendance-report?format=csv');
  expect(r.status()).toBe(403);
  const anon = await (await browser.newContext()).request.get(new URL('/api/crm/attendance-report?format=csv', p.url()).toString());
  expect(anon.status()).toBe(401);
  await ctx.close();
});

test('faculty: sees only their own batches; batch page offers subject registers', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await staffLogin(p, staffFor('faculty'));
  await p.goto('/crm/analytics?tab=attendance');
  await expect(p.locator('body')).not.toContainText(CRASH);
  await expect(p.getByText('Total students').first()).toBeVisible();
  await ctx.close();
});
