import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;

beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-report-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('7 PM report', () => {
  it('stores a snapshot, messages management with a phone once a day, and is safe to re-run', async () => {
    const { tx } = await import('../store/file');
    await tx((db) => {
      db.staff.push({ id: 'staff-md', fullName: 'Managing Director', email: null, phone: '+919777700001', roles: ['management'], active: true });
    });
    const store = (await import('../store/file')).createFileStore();
    await store.captureLead({ name: 'Parent', phone: '+919777700002', consent: true, source: 'callback' });
    // the report below is for 3 Nov; pin the lead to that day so the test doesn't depend on the real clock
    await tx((db) => {
      for (const l of db.leads) l.createdAt = '2026-11-03T05:00:00.000Z';
    });

    const reports = await import('./reports');
    const now = new Date('2026-11-03T13:30:00Z'); // 19:00 IST
    expect(await reports.generateDailyReport(now)).toMatchObject({ date: '2026-11-03', recipients: 1 });
    // Re-run (cron retry): no second WhatsApp, recipient count kept.
    expect(await reports.generateDailyReport(now)).toMatchObject({ recipients: 1 });
    const msgs = await tx((db) => db.waMessages.filter((m) => m.template === 'bjc_daily_report'), false);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toMatch(/Bhargava admissions, Tue, 3 Nov: \d+ new leads/);

    const manager = { id: 'staff-manager', fullName: 'Admission Manager', email: null, phone: null, roles: ['admission_manager' as const], active: true };
    const r = await reports.getReport(manager, '2026-11-03');
    expect(r?.today.funnel.find((f) => f.key === 'leads')?.value).toBeGreaterThanOrEqual(1);
    expect(r?.recipients).toBe(1);
    await expect(reports.getReport({ ...manager, roles: ['telecaller'] }, '2026-11-03')).rejects.toThrow(/management/);
  });
});
