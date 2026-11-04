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

describe('§7.1 allocation by school / area', () => {
  it('gives each school to one telecaller, balancing load, and round-robins leads without a school', async () => {
    const { groupedRoundRobin } = await import('./rules');
    const plan = groupedRoundRobin(
      [
        { id: '1', key: 'ZPHS' }, { id: '2', key: 'zphs ' }, { id: '3', key: 'ZPHS' },
        { id: '4', key: 'Narayana' }, { id: '5', key: 'Narayana' },
        { id: '6', key: null }, { id: '7', key: '' },
      ],
      ['t1', 't2'],
      { t1: 0, t2: 1 },
    );
    expect(new Set([plan['1'], plan['2'], plan['3']]).size).toBe(1); // case/space-insensitive, one owner
    expect(plan['4']).toBe(plan['5']);
    expect(plan['1']).toBe('t1'); // biggest group to the lightest load
    expect(plan['4']).toBe('t2');
    expect(plan['6']).toBeDefined();
    expect(plan['7']).toBeDefined();
    expect(groupedRoundRobin([{ id: 'x', key: 'A' }], [])).toEqual({});
  });
});
