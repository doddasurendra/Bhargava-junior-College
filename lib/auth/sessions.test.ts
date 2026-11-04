import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RecordStore } from '../records/types';
import { DEFAULT_RULES, permissionsFor, can } from '../crm/permissions';

let dir: string;
let cwd: string;
let store: RecordStore;
let S: typeof import('./sessions');
let R: typeof import('../crm/rbac');

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-sess-'));
  process.chdir(dir);
  store = (await import('../records/fileStore')).createFileRecordStore();
  S = await import('./sessions');
  R = await import('../crm/rbac');
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const ctx = { ip: '203.0.113.1', userAgent: 'Chrome/130 Windows' };

describe('device sessions (§9A.4)', () => {
  it('a session is valid only for its own subject and kind', async () => {
    const t0 = new Date('2026-11-03T08:00:00Z');
    const id = await S.startSession(store, { kind: 'staff', subject: 'staff-priya', ...ctx }, t0);
    expect(await S.checkSession(store, id, 'staff', 'staff-priya', t0, S.STAFF_IDLE_MS)).not.toBeNull();
    expect(await S.checkSession(store, id, 'staff', 'staff-ramesh', t0, S.STAFF_IDLE_MS)).toBeNull();
    expect(await S.checkSession(store, id, 'app', 'staff-priya', t0)).toBeNull();
    expect(await S.checkSession(store, undefined, 'staff', 'staff-priya', t0)).toBeNull();
    expect(await S.checkSession(store, 'forged', 'staff', 'staff-priya', t0)).toBeNull();
  });

  it('signs staff out after 30 minutes idle, and activity keeps it alive', async () => {
    const t0 = new Date('2026-11-03T09:00:00Z');
    const id = await S.startSession(store, { kind: 'staff', subject: 'staff-anil', ...ctx }, t0);
    const at = (min: number) => new Date(t0.getTime() + min * 60_000);
    expect(await S.checkSession(store, id, 'staff', 'staff-anil', at(25), S.STAFF_IDLE_MS)).not.toBeNull(); // touches lastSeen
    expect(await S.checkSession(store, id, 'staff', 'staff-anil', at(50), S.STAFF_IDLE_MS)).not.toBeNull(); // 25 min after last activity
    expect(await S.checkSession(store, id, 'staff', 'staff-anil', at(90), S.STAFF_IDLE_MS)).toBeNull(); // 40 min idle
    expect(await S.checkSession(store, id, 'staff', 'staff-anil', at(91), S.STAFF_IDLE_MS)).toBeNull(); // stays revoked
    const all = await S.listSessions(store, 'staff', 'staff-anil', false);
    expect(all[0]).toMatchObject({ revokedReason: 'inactivity timeout' });
  });

  it('lists devices and signs one out remotely, or all but this one', async () => {
    const a = await S.startSession(store, { kind: 'staff', subject: 'staff-divya', ...ctx });
    const b = await S.startSession(store, { kind: 'staff', subject: 'staff-divya', ip: '198.51.100.2', userAgent: 'Safari iPhone' });
    const c = await S.startSession(store, { kind: 'staff', subject: 'staff-divya', ...ctx });
    expect(await S.listSessions(store, 'staff', 'staff-divya')).toHaveLength(3);
    await S.revokeSession(store, b, 'signed out remotely');
    expect((await S.listSessions(store, 'staff', 'staff-divya')).map((s) => s.id).sort()).toEqual([a, c].sort());
    expect(await S.revokeAll(store, 'staff', 'staff-divya', 'everywhere', a)).toBe(1);
    expect((await S.listSessions(store, 'staff', 'staff-divya')).map((s) => s.id)).toEqual([a]);
  });

  it('keeps a student to two devices, signing out the least recently used', async () => {
    const t = (m: number) => new Date(Date.UTC(2026, 10, 3, 10, m));
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await S.startSession(store, { kind: 'app', subject: '+919700000201', ...ctx }, t(i)));
    await S.enforceDeviceLimit(store, 'app', '+919700000201', S.STUDENT_DEVICE_LIMIT);
    const left = (await S.listSessions(store, 'app', '+919700000201')).map((s) => s.id);
    expect(left).toHaveLength(2);
    expect(left).not.toContain(ids[0]);
  });
});

describe('permission matrix and custom roles (§9A.1, §9A.4)', () => {
  const admin = { id: 'staff-admin', perms: permissionsFor(['super_admin']) };

  it('defaults match the built-in rules; telecallers can’t see raw phones', () => {
    expect(can({ roles: ['telecaller'] }, 'phone.view')).toBe(false);
    expect(can({ roles: ['front_desk'] }, 'phone.view')).toBe(true);
    expect(can({ roles: ['faculty'] }, 'fees.dues')).toBe(false); // faculty can't see fees (§9A.3)
    expect(can({ roles: ['accounts'] }, 'academics.manage')).toBe(false); // accounts can't change academic data
    expect(can({ roles: ['admin_office'] }, 'certificates.issue')).toBe(true);
  });

  it('only the Super Admin saves the matrix, and can never lock themselves out', async () => {
    await expect(R.saveRbac(store, { id: 'x', perms: permissionsFor(['management']) }, { grants: {}, customRoles: [] })).rejects.toThrow('Super Admin');
    const saved = await R.saveRbac(store, admin, { grants: { ...DEFAULT_RULES, 'rbac.manage': [], 'staff.manage': [], 'phone.view': [...DEFAULT_RULES['phone.view'], 'telecaller'] }, customRoles: [] });
    expect(saved.matrix['rbac.manage']).toContain('super_admin');
    expect(saved.matrix['staff.manage']).toContain('super_admin');
    const loaded = await R.loadRbac(store);
    expect(permissionsFor(['telecaller'], loaded.matrix)).toContain('phone.view');
    expect(R.diffFromDefaults(loaded.matrix).find((d) => d.perm === 'phone.view')?.added).toEqual(['telecaller']);
  });

  it('adds a custom role with its own permissions and drops unknown roles', async () => {
    const key = R.slugRole('Sports Coordinator');
    expect(key).toBe('custom_sports_coordinator');
    const saved = await R.saveRbac(store, admin, { grants: { ...DEFAULT_RULES, 'notices.publish': [...DEFAULT_RULES['notices.publish'], key, 'custom_ghost'] }, customRoles: [{ key, label: 'Sports Coordinator', description: null }] });
    expect(saved.matrix['notices.publish']).toContain(key);
    expect(saved.matrix['notices.publish']).not.toContain('custom_ghost');
    expect(permissionsFor([key], (await R.loadRbac(store)).matrix)).toEqual(['notices.publish']);
    await expect(R.saveRbac(store, admin, { grants: {}, customRoles: [{ key, label: 'A', description: null }] })).rejects.toThrow('2–60');
  });
});
