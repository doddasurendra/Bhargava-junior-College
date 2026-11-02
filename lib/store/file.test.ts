import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Store } from './types';

let dir: string;
let cwd: string;
let store: Store;

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-store-'));
  process.chdir(dir); // file store resolves .data/ against cwd at import time
  store = (await import('./file')).createFileStore();
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const base = { name: 'Parent', consent: true as const };

describe('file store', () => {
  it('dedupes leads by phone and keeps history', async () => {
    const a = await store.captureLead({ ...base, phone: '+919000000001', source: 'callback' });
    const b = await store.captureLead({ ...base, phone: '+919000000001', source: 'brochure', program: 'neet' });
    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(false);
    expect(b.leadId).toBe(a.leadId);
    const rec = await store.findAdmission('+919000000001');
    expect(rec?.program).toBe('neet');
  });

  it('enforces slot capacity, including under concurrent bookings', async () => {
    const book = (i: number) => store.createVisit({ ...base, phone: `+91900000${String(100 + i)}`, date: '2026-11-05', slot: '10:00', familySize: 1 });
    const results = await Promise.allSettled([0, 1, 2, 3, 4, 5, 6].map(book));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason.code).toBe('slot_full');
    expect((await store.slotBookings('2026-11-05'))['10:00']).toBe(5);
  });

  it('imports: creates new leads, merges into existing ones without overwriting', async () => {
    const { createFileCrmRepo } = await import('../crm/fileRepo');
    const repo = createFileCrmRepo();
    await store.captureLead({ ...base, name: 'Web Parent', phone: '+919111111111', source: 'callback', program: 'neet' });
    const rec = (p: Partial<import('../crm/importer').ImportRecord>) => ({ line: 2, phone: '', studentPhone: null, studentName: null, parentName: null, school: null, classLevel: null, board: null, area: null, program: null, note: null, ...p });
    expect(await repo.findExistingPhones(['+919111111111', '+919222222222'])).toEqual(new Set(['+919111111111']));
    const res = await repo.importLeads(
      [
        rec({ phone: '+919111111111', studentName: 'Imported Student', program: 'iit-jee', school: 'ZPHS' }),
        rec({ line: 3, phone: '+919222222222', studentPhone: '+919333333333', studentName: 'New Kid', parentName: 'New Parent' }),
      ],
      { fileName: 'school.csv', source: 'school_data', actorId: 'staff-manager', totalRows: 3, invalid: 1, duplicatesInFile: 0 },
    );
    expect(res).toMatchObject({ created: 1, merged: 1 });
    const [merged] = await repo.listLeads({ q: '9111111111' });
    expect(merged).toMatchObject({ contactName: 'Web Parent', studentName: 'Imported Student', program: 'neet', school: 'ZPHS', lastSource: 'school_data' });
    // A later web enquiry from the student's own phone is recognised as the same family.
    expect(await repo.findExistingPhones(['+919333333333'])).toEqual(new Set(['+919333333333']));
    const [batch] = await repo.listImportBatches();
    expect(batch).toMatchObject({ fileName: 'school.csv', created: 1, merged: 1, invalid: 1 });
  });

  it('issues one hall ticket per lead', async () => {
    const r1 = await store.registerBsat({ ...base, phone: '+919000000009', stream: 'MPC', sessionId: '2026-11-16-campus' });
    const r2 = await store.registerBsat({ ...base, phone: '+919000000009', stream: 'MPC', sessionId: '2026-11-30-online' });
    expect(r1.hallTicket).toMatch(/^BSAT27-\d{5}$/);
    expect(r2).toEqual({ hallTicket: r1.hallTicket, alreadyRegistered: true });
  });
});
