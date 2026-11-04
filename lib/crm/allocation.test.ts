import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;

beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-alloc-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('§3.2-A lead qualification before allocation', () => {
  it('refuses to allocate unqualified or invalid leads, and allocates qualified ones', async () => {
    const { tx, createFileStore } = await import('../store/file');
    await tx((db) => {
      db.staff.push({ id: 'staff-tc', fullName: 'Telecaller T', email: null, phone: null, roles: ['telecaller'], active: true });
    });
    const store = createFileStore();
    await store.captureLead({ name: 'Parent One', phone: '+919666600001', consent: true, source: 'callback' });
    await store.captureLead({ name: 'Parent Two', phone: '+919666600002', consent: true, source: 'callback' });
    const [a, b] = await tx((db) => db.leads.map((l) => l.id), false);

    const manager = { id: 'staff-manager', fullName: 'Admission Manager', email: null, phone: null, roles: ['admission_manager' as const], active: true };
    const svc = await import('./service');

    await expect(svc.assignLeads(manager, [a], 'staff-tc', null)).rejects.toThrow(/before allocating/);
    await expect(svc.assignLeads(manager, [a], 'round_robin', null)).rejects.toThrow(/before allocating/);

    await svc.qualifyLead(manager, a, 'hot');
    expect(await svc.assignLeads(manager, [a], 'staff-tc', null)).toBe(1);

    await svc.qualifyLead(manager, b, 'invalid');
    await expect(svc.assignLeads(manager, [b], 'staff-tc', null)).rejects.toThrow(/Invalid leads/);

    const owners = await tx((db) => Object.fromEntries(db.leads.map((l) => [l.id, l.ownerId])), false);
    expect(owners[a]).toBe('staff-tc');
    expect(owners[b]).toBeFalsy();
  });
});
