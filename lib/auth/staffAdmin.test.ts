import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CrmRepo, Staff } from '../crm/types';
import type { Identity } from './identity';
import type { StaffAdmin } from './staffAdmin';
import { passwordProblem } from './staffAdmin';
import type { AuthStore } from './types';

let dir: string;
let cwd: string;
let repo: CrmRepo;
let store: AuthStore;
let admin: StaffAdmin;

/** Stands in for Supabase Auth: records emails, accepts one known token. */
const sent: string[] = [];
const passwords = new Map<string, string>();
const tokens = new Map<string, string>(); // token → user id
let n = 0;
const identity: Identity = {
  emails: true,
  async invite(email) {
    sent.push(`invite:${email}`);
    const id = `staff-new-${++n}`;
    tokens.set(`invitetoken${n}xx`, id);
    return id;
  },
  async removeInvite() {},
  async sendPasswordReset(email) {
    sent.push(`reset:${email}`);
  },
  async completeReset(token, _type, password) {
    const id = tokens.get(token);
    if (!id) return null;
    tokens.delete(token); // single use
    passwords.set(id, password);
    return id;
  },
};

const ctx = { ip: '198.51.100.9', userAgent: 'test' };
const superAdmin = { id: 'staff-admin', fullName: 'Super Admin', email: null, phone: null, roles: ['super_admin'], active: true } as Staff;
const manager = { id: 'staff-manager', fullName: 'Admission Manager', email: null, phone: null, roles: ['admission_manager'], active: true } as Staff;

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-staff-'));
  process.chdir(dir);
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  store = (await import('./fileStore')).createFileAuthStore();
  admin = (await import('./staffAdmin')).createStaffAdmin({ repo, store, identity });
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('staff accounts', () => {
  it('only a Super Admin adds staff; the invite goes out and the change is audited', async () => {
    await expect(admin.create(manager, { fullName: 'Meena', email: 'meena@example.test', roles: ['telecaller'] }, ctx)).rejects.toThrow('Super Admin');
    const s = await admin.create(superAdmin, { fullName: '  Meena Rao ', email: 'Meena@Example.test', phone: '98480 22222', roles: ['telecaller', 'front_desk'] }, ctx);
    expect(s).toMatchObject({ fullName: 'Meena Rao', email: 'meena@example.test', phone: '+919848022222', roles: ['telecaller', 'front_desk'], active: true });
    expect(sent).toContain('invite:meena@example.test');
    expect((await repo.getStaff(s.id))?.roles).toEqual(['telecaller', 'front_desk']);
    const [e] = await store.listEvents({ limit: 1, staffId: s.id });
    expect(e).toMatchObject({ method: 'admin', actorId: 'staff-admin', reason: 'staff created: Telecaller, Front Desk, invitation emailed' });
  });

  it('validates input and refuses a duplicate email', async () => {
    await expect(admin.create(superAdmin, { fullName: 'X', email: 'x@example.test', roles: ['telecaller'] }, ctx)).rejects.toThrow('full name');
    await expect(admin.create(superAdmin, { fullName: 'Xavier', email: 'not-an-email', roles: ['telecaller'] }, ctx)).rejects.toThrow('email');
    await expect(admin.create(superAdmin, { fullName: 'Xavier', email: 'x@example.test', roles: [] }, ctx)).rejects.toThrow('role');
    await expect(admin.create(superAdmin, { fullName: 'Xavier', email: 'x@example.test', roles: ['wizard'] }, ctx)).rejects.toThrow();
    await expect(admin.create(superAdmin, { fullName: 'Xavier', email: 'x@example.test', phone: '123', roles: ['telecaller'] }, ctx)).rejects.toThrow('mobile');
    await expect(admin.create(superAdmin, { fullName: 'Meena Two', email: 'MEENA@example.test', roles: ['telecaller'] }, ctx)).rejects.toThrow('already uses this email');
  });

  it('edits roles and deactivates, signing the person out; history of the change is kept', async () => {
    const id = 'staff-new-1';
    const before = await store.get(id);
    await admin.update(superAdmin, id, { fullName: 'Meena Rao', phone: '', roles: ['front_desk', 'accounts'], active: true }, ctx);
    expect((await repo.getStaff(id))?.roles).toEqual(['front_desk', 'accounts']);
    expect((await store.get(id)).sessionVersion).toBe(before.sessionVersion + 1); // telecaller removed
    await admin.update(superAdmin, id, { fullName: 'Meena Rao', roles: ['front_desk', 'accounts'], active: false }, ctx);
    expect((await repo.getStaff(id))?.active).toBe(false);
    expect((await repo.listStaff()).some((s) => s.id === id)).toBe(false);
    expect((await repo.listAllStaff()).some((s) => s.id === id)).toBe(true);
    const reasons = (await store.listEvents({ limit: 10, staffId: id })).map((e) => e.reason);
    expect(reasons).toContain('staff updated: phone removed; +Accounts; −Telecaller');
    expect(reasons).toContain('staff updated: deactivated');
  });

  it('never leaves the college without an active Super Admin, and a Super Admin cannot lock themselves out', async () => {
    await expect(admin.update(superAdmin, 'staff-admin', { fullName: 'Super Admin', roles: ['management'], active: true }, ctx)).rejects.toThrow('own Super Admin');
    await expect(admin.update(superAdmin, 'staff-admin', { fullName: 'Super Admin', roles: ['super_admin'], active: false }, ctx)).rejects.toThrow('deactivate your own');
    // a second Super Admin can't remove the only other one either if that leaves none
    const two = await admin.create(superAdmin, { fullName: 'Second Admin', email: 'admin2@example.test', roles: ['super_admin'] }, ctx);
    await admin.update(two, 'staff-admin', { fullName: 'Super Admin', roles: ['management'], active: true }, ctx);
    await expect(admin.update(two, two.id, { fullName: 'Second Admin', roles: ['management'], active: true }, ctx)).rejects.toThrow('own Super Admin');
    // restore
    await admin.update(two, 'staff-admin', { fullName: 'Super Admin', roles: ['super_admin'], active: true }, ctx);
    await admin.update(superAdmin, two.id, { fullName: 'Second Admin', roles: ['management'], active: true }, ctx);
    await expect(repo.saveStaff({ ...superAdmin, active: false })).rejects.toThrow('Super Admin is required');
  });
});

describe('forgot password', () => {
  it('answers the same for unknown, inactive and real staff, and throttles to 3 an hour', async () => {
    sent.length = 0;
    await admin.requestReset('nobody@example.test', ctx);
    await admin.requestReset('meena@example.test', ctx); // deactivated above
    expect(sent).toEqual([]);
    for (let i = 0; i < 5; i++) await admin.requestReset('ADMIN2@example.test', ctx);
    expect(sent).toEqual(['reset:admin2@example.test', 'reset:admin2@example.test', 'reset:admin2@example.test']);
    const failed = (await store.listEvents({ limit: 20, failedOnly: true })).map((e) => e.reason);
    expect(failed).toEqual(expect.arrayContaining(['reset requested: unknown email', 'reset requested: inactive', 'reset requested: too many this hour']));
  });

  it('sets the password from the link once, signs out other sessions and clears a lock', async () => {
    const id = 'staff-new-2'; // Second Admin, invited above
    await store.update(id, { failedCount: 5, lockedUntil: new Date(Date.now() + 600_000).toISOString() });
    const sv = (await store.get(id)).sessionVersion;
    expect(await admin.completeReset('invitetoken2xx', 'invite', 'short', 'short', ctx)).toMatchObject({ ok: false, message: expect.stringContaining('10') });
    expect(await admin.completeReset('invitetoken2xx', 'invite', 'a long enough phrase', 'a different phrase!!', ctx)).toMatchObject({ ok: false, message: expect.stringContaining('match') });
    expect(await admin.completeReset('invitetoken2xx', 'invite', 'mango season in hyderabad', 'mango season in hyderabad', ctx)).toEqual({ ok: true });
    expect(passwords.get(id)).toBe('mango season in hyderabad');
    expect(await store.get(id)).toMatchObject({ sessionVersion: sv + 1, failedCount: 0, lockedUntil: null });
    expect(await admin.completeReset('invitetoken2xx', 'invite', 'mango season in hyderabad', 'mango season in hyderabad', ctx)).toMatchObject({ ok: false, message: expect.stringContaining('expired') });
  });

  it('rejects weak passwords', () => {
    expect(passwordProblem('aaaaaaaaaaaa')).toMatch(/repeated/);
    expect(passwordProblem('MyPassword2026')).toMatch(/easy/);
    expect(passwordProblem('priya-at-college-99', 'priya@example.test')).toMatch(/email/);
    expect(passwordProblem('mango season in hyderabad')).toBeNull();
  });
});
