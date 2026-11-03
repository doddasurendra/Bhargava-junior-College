import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Staff } from '../crm/types';
import { hashPassword, LOCK_MS, MAX_FAILS, type AuthService } from './service';
import { base32Decode, stepAt, totpAt, unseal } from './totp';
import type { AuthStore } from './types';

let dir: string;
let cwd: string;
let store: AuthStore;
let auth: AuthService;
// The file store fixes its path at import time, so it's imported only after chdir into a temp dir.
let tx: typeof import('../store/file').tx;
let fileVerifier: typeof import('./service').fileVerifier;

const ctx = (now: Date) => ({ ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', now });
const T0 = new Date('2026-11-03T04:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const codeAt = (secret: string, d: Date) => totpAt(secret, stepAt(d.getTime()));
const superAdmin = { id: 'staff-admin', fullName: 'Super Admin', email: null, phone: null, roles: ['super_admin'], active: true } as Staff;
const manager = { id: 'staff-manager', fullName: 'Admission Manager', email: null, phone: null, roles: ['admission_manager'], active: true } as Staff;

async function secretOf(staffId: string) {
  const a = await store.get(staffId);
  return unseal((a.totpSecretEnc ?? a.totpPendingEnc)!)!;
}

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-auth-'));
  process.chdir(dir);
  ({ tx } = await import('../store/file'));
  const { createFileAuthStore } = await import('./fileStore');
  const { createFileCrmRepo } = await import('../crm/fileRepo');
  const svc = await import('./service');
  fileVerifier = svc.fileVerifier;
  store = createFileAuthStore();
  auth = svc.createAuthService({ store, repo: createFileCrmRepo() });
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('staff sign-in', () => {
  it('lets roles without 2FA straight in and records it', async () => {
    const r = await auth.devLogin('staff-priya', ctx(T0));
    expect(r).toEqual({ kind: 'session', staffId: 'staff-priya', sv: 0 });
    const [e] = await store.listEvents({ limit: 1, staffId: 'staff-priya' });
    expect(e).toMatchObject({ success: true, method: 'dev', reason: 'ok', ip: '203.0.113.7' });
  });

  it('makes Super Admin, Management and Accounts enrol in 2FA, then asks for a code every time', async () => {
    expect(await auth.devLogin('staff-accounts', ctx(T0))).toEqual({ kind: 'mfa', staffId: 'staff-accounts', enrolled: false });

    const setup = (await auth.enrolment('staff-accounts'))!;
    expect(setup.uri).toContain('otpauth://totp/Bhargava%20CRM');
    expect((await auth.enrolment('staff-accounts'))!.secret).toBe(setup.secret); // stable across reloads
    expect(base32Decode(setup.secret)).toHaveLength(20);

    expect(await auth.confirmEnrolment('staff-accounts', '000000', ctx(T0))).toMatchObject({ kind: 'error' });
    const done = await auth.confirmEnrolment('staff-accounts', codeAt(setup.secret, T0), ctx(T0));
    expect(done.kind).toBe('session');
    if (done.kind === 'session') expect(done.codes).toHaveLength(8);
    expect(await auth.enrolment('staff-accounts')).toBeNull();

    expect(await auth.devLogin('staff-accounts', ctx(at(5)))).toEqual({ kind: 'mfa', staffId: 'staff-accounts', enrolled: true });
    const ok = await auth.secondFactor('staff-accounts', codeAt(setup.secret, at(5)), ctx(at(5)));
    expect(ok).toMatchObject({ kind: 'session', method: 'totp', recoveryLeft: 8 });
  });

  it('refuses a replayed code', async () => {
    const secret = await secretOf('staff-accounts');
    const code = codeAt(secret, at(10));
    expect(await auth.secondFactor('staff-accounts', code, ctx(at(10)))).toMatchObject({ kind: 'session' });
    const again = await auth.secondFactor('staff-accounts', code, ctx(at(10)));
    expect(again).toMatchObject({ kind: 'error', message: expect.stringContaining('already been used') });
  });

  it('accepts each recovery code once', async () => {
    await auth.devLogin('staff-admin', ctx(at(20)));
    const secret = (await auth.enrolment('staff-admin'))!.secret;
    const done = await auth.confirmEnrolment('staff-admin', codeAt(secret, at(20)), ctx(at(20)));
    if (done.kind !== 'session') throw new Error('enrol failed');
    const [first] = done.codes;
    expect(await auth.secondFactor('staff-admin', first.toUpperCase(), ctx(at(21)))).toMatchObject({ kind: 'session', method: 'recovery', recoveryLeft: 7 });
    expect(await auth.secondFactor('staff-admin', first, ctx(at(22)))).toMatchObject({ kind: 'error' });
  });

  it('locks the account after repeated bad codes, until it lapses or a Super Admin unlocks it', async () => {
    // reset the failure count left by the last test
    await store.update('staff-accounts', { failedCount: 0, lockedUntil: null });
    for (let i = 0; i < MAX_FAILS - 1; i++) expect(await auth.secondFactor('staff-accounts', '000000', ctx(at(30)))).toMatchObject({ kind: 'error' });
    const last = await auth.secondFactor('staff-accounts', '000000', ctx(at(30)));
    expect(last).toMatchObject({ kind: 'error', message: expect.stringContaining('locked') });

    // even the right code and a fresh first step are refused while locked
    const secret = await secretOf('staff-accounts');
    expect(await auth.secondFactor('staff-accounts', codeAt(secret, at(31)), ctx(at(31)))).toMatchObject({ kind: 'error', message: expect.stringContaining('locked') });
    expect(await auth.devLogin('staff-accounts', ctx(at(31)))).toMatchObject({ kind: 'error' });

    // lapses on its own…
    const later = new Date(at(30).getTime() + LOCK_MS + 60_000);
    expect(await auth.devLogin('staff-accounts', ctx(later))).toMatchObject({ kind: 'mfa' });

    // …or a Super Admin unlocks it (a manager can't)
    for (let i = 0; i < MAX_FAILS; i++) await auth.secondFactor('staff-accounts', '000000', ctx(later));
    await expect(auth.adminUnlock(manager, 'staff-accounts', ctx(later))).rejects.toThrow('Super Admin');
    await auth.adminUnlock(superAdmin, 'staff-accounts', ctx(later));
    expect(await auth.devLogin('staff-accounts', ctx(later))).toMatchObject({ kind: 'mfa' });
  });

  it('checks passwords, hides which emails exist, and locks after repeated wrong passwords', async () => {
    await tx((db) => {
      db.staff.find((s) => s.id === 'staff-priya')!.email = 'priya@example.test';
    });
    await store.update('staff-priya', { passwordHash: hashPassword('correct horse battery') });
    const verify = fileVerifier(store);

    expect(await auth.passwordLogin('PRIYA@example.test ', 'correct horse battery', verify, ctx(at(40)))).toMatchObject({ kind: 'session', staffId: 'staff-priya' });
    const unknown = await auth.passwordLogin('nobody@example.test', 'x', verify, ctx(at(40)));
    const wrong = await auth.passwordLogin('priya@example.test', 'wrong', verify, ctx(at(40)));
    expect(unknown).toEqual(wrong); // same message either way

    const [u] = await store.listEvents({ limit: 1, failedOnly: true });
    expect(u).toMatchObject({ email: 'priya@example.test', reason: 'bad_password' });

    for (let i = 0; i < MAX_FAILS - 1; i++) await auth.passwordLogin('priya@example.test', 'wrong', verify, ctx(at(41)));
    expect(await auth.passwordLogin('priya@example.test', 'correct horse battery', verify, ctx(at(42)))).toMatchObject({ kind: 'error', message: expect.stringContaining('locked') });
    const unknownLog = (await store.listEvents({ limit: 500, failedOnly: true })).find((e) => e.reason === 'unknown_email');
    expect(unknownLog).toMatchObject({ email: 'nobody@example.test', staffId: null });
  });

  it('invalidates sessions on version bump, and without the 2FA claim for 2FA roles', async () => {
    const admin = superAdmin;
    expect(await auth.sessionValid(admin, { sv: 0, mfa: true })).toBe(true);
    expect(await auth.sessionValid(admin, { sv: 0, mfa: false })).toBe(false);
    expect(await auth.sessionValid(manager, { sv: 0, mfa: false })).toBe(true);
    const sv = await auth.signOutEverywhere('staff-manager', ctx(at(50)));
    expect(sv).toBe(1);
    expect(await auth.sessionValid(manager, { sv: 0 })).toBe(false);
    expect(await auth.sessionValid(manager, { sv: 1 })).toBe(true);
  });

  it('lets only another Super Admin reset 2FA, with a reason, signing the user out', async () => {
    await expect(auth.adminReset2fa(superAdmin, 'staff-admin', 'lost phone', ctx(at(60)))).rejects.toThrow('own');
    await expect(auth.adminReset2fa(manager, 'staff-accounts', 'lost phone', ctx(at(60)))).rejects.toThrow('Super Admin');
    await expect(auth.adminReset2fa(superAdmin, 'staff-accounts', 'x', ctx(at(60)))).rejects.toThrow('reason');
    const before = await store.get('staff-accounts');
    await auth.adminReset2fa(superAdmin, 'staff-accounts', 'Lost phone, verified in person', ctx(at(60)));
    const after = await store.get('staff-accounts');
    expect(after).toMatchObject({ totpSecretEnc: null, totpEnabledAt: null, recoveryHashes: [], sessionVersion: before.sessionVersion + 1 });
    expect(await auth.devLogin('staff-accounts', ctx(at(61)))).toEqual({ kind: 'mfa', staffId: 'staff-accounts', enrolled: false });
    const [e] = await store.listEvents({ limit: 1, staffId: 'staff-accounts' });
    expect(e.reason).toBe('ok, 2fa enrolment pending');
    const reset = (await store.listEvents({ limit: 10, staffId: 'staff-accounts' })).find((x) => x.method === 'admin' && x.reason.startsWith('2fa reset'));
    expect(reset).toMatchObject({ actorId: 'staff-admin', reason: '2fa reset: Lost phone, verified in person' });
  });

  it('lets other roles opt in to 2FA and out again; required roles cannot opt out', async () => {
    const secret = (await auth.enrolment('staff-ramesh'))!.secret;
    await auth.confirmEnrolment('staff-ramesh', codeAt(secret, at(70)), ctx(at(70)));
    expect(await auth.devLogin('staff-ramesh', ctx(at(71)))).toMatchObject({ kind: 'mfa', enrolled: true });
    await auth.disable2fa('staff-ramesh', codeAt(secret, at(72)), ctx(at(72)));
    expect(await auth.devLogin('staff-ramesh', ctx(at(73)))).toMatchObject({ kind: 'session' });
    await expect(auth.disable2fa('staff-admin', '000000', ctx(at(73)))).rejects.toThrow('required');
  });

  it('refuses inactive staff', async () => {
    await tx((db) => {
      db.staff.find((s) => s.id === 'staff-divya')!.active = false;
    });
    expect(await auth.devLogin('staff-divya', ctx(at(80)))).toMatchObject({ kind: 'error', message: expect.stringContaining('no CRM access') });
  });
});
