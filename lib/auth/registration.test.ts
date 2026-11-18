import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CrmRepo, Staff } from '../crm/types';
import type { Registration } from './registration';
import type { AuthService } from './service';
import type { AuthStore } from './types';

/**
 * The first end-to-end slice with the real local stores: a teacher registers with their own password, can't
 * sign in until approved, the Super Admin approves, and the teacher signs in with that password.
 */
let dir: string;
let cwd: string;
let repo: CrmRepo;
let store: AuthStore;
let reg: Registration;
let auth: AuthService;
let verify: (email: string, pw: string) => Promise<string | null>;

const ctx = { ip: '198.51.100.7', userAgent: 'test' };
const superAdmin = { id: 'staff-admin', fullName: 'Super Admin', email: null, phone: null, roles: ['super_admin'], active: true } as Staff;
const teacher = { id: 'staff-x', fullName: 'Some Teacher', email: null, phone: null, roles: ['faculty'], active: true } as Staff;
const form = (over: Record<string, string> = {}) => ({ fullName: 'Lakshmi Devi', employeeId: 'BJC-T-104', email: 'Lakshmi.Devi@college.test', phone: '98480 11111', department: 'Physics', designation: 'Senior Lecturer', requestedRole: 'faculty', password: 'orbit-cedar-2741', confirm: 'orbit-cedar-2741', ...over });

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-reg-'));
  process.chdir(dir);
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  store = (await import('./fileStore')).createFileAuthStore();
  const records = (await import('../records/fileStore')).createFileRecordStore();
  const { createFileIdentity } = await import('./identity');
  const identity = createFileIdentity(store, (e) => store.staffIdForEmail(e));
  const svc = await import('./service');
  verify = svc.fileVerifier(store);
  auth = svc.createAuthService({ store, repo });
  reg = (await import('./registration')).createRegistration({ records, store, identity, repo });
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('teacher registration → approval → sign-in', () => {
  it('validates the form and never offers privileged roles', async () => {
    await expect(reg.submit(form({ confirm: 'something-else-1' }), ctx)).rejects.toThrow('don’t match');
    await expect(reg.submit(form({ password: 'short', confirm: 'short' }), ctx)).rejects.toThrow('10 characters');
    await expect(reg.submit(form({ phone: '12345' }), ctx)).rejects.toThrow('mobile');
    await expect(reg.submit(form({ requestedRole: 'principal' }), ctx)).rejects.toThrow('account you need');
    await expect(reg.submit(form({ requestedRole: 'super_admin' }), ctx)).rejects.toThrow('account you need');
  });

  it('a pending applicant cannot sign in, and is told why only with the right password', async () => {
    await reg.submit(form(), ctx);
    await expect(reg.submit(form(), ctx)).rejects.toThrow('already waiting');
    await expect(reg.submit(form({ email: 'other@college.test' }), ctx)).rejects.toThrow('employee ID');
    const r = await auth.passwordLogin('lakshmi.devi@college.test', 'orbit-cedar-2741', verify, ctx);
    expect(r.kind).toBe('error');
    expect(await reg.pendingMessage('lakshmi.devi@college.test', 'orbit-cedar-2741')).toMatch(/waiting for approval/);
    expect(await reg.pendingMessage('lakshmi.devi@college.test', 'wrong-password-9')).toBeNull();
  });

  it('only a Super Admin approves; approval cannot hand out leadership roles', async () => {
    const [p] = await reg.list('pending');
    await expect(reg.approve(teacher, p.id, ['faculty'], ctx)).rejects.toThrow('Super Admin');
    await expect(reg.approve(superAdmin, p.id, ['principal'], ctx)).rejects.toThrow('Leadership');
    const s = await reg.approve(superAdmin, p.id, ['faculty', 'class_teacher'], ctx);
    expect(s).toMatchObject({ fullName: 'Lakshmi Devi', email: 'lakshmi.devi@college.test', phone: '+919848011111', roles: ['faculty', 'class_teacher'], active: true });
    await expect(reg.approve(superAdmin, p.id, ['faculty'], ctx)).rejects.toThrow('already been decided');
    const events = await store.listEvents({ limit: 5, staffId: s.id });
    expect(events[0]).toMatchObject({ method: 'register', actorId: 'staff-admin', reason: 'registration approved: Faculty, Class Teacher / Mentor' });
  });

  it('the approved teacher signs in with the password they chose; a wrong password still fails', async () => {
    const ok = await auth.passwordLogin('LAKSHMI.DEVI@college.test', 'orbit-cedar-2741', verify, ctx);
    expect(ok.kind).toBe('session');
    const bad = await auth.passwordLogin('lakshmi.devi@college.test', 'orbit-cedar-0000', verify, ctx);
    expect(bad).toEqual({ kind: 'error', message: 'Email or password is incorrect.' });
  });

  it('a declined request says why', async () => {
    await reg.submit(form({ email: 'ravi@college.test', employeeId: 'BJC-T-200', fullName: 'Ravi K' }), ctx);
    const p = (await reg.list('pending')).find((x) => x.data.email === 'ravi@college.test')!;
    await expect(reg.reject(superAdmin, p.id, '', ctx)).rejects.toThrow('reason');
    await reg.reject(superAdmin, p.id, 'Employee ID not on our rolls', ctx);
    expect(await reg.pendingMessage('ravi@college.test', 'orbit-cedar-2741')).toMatch(/not approved: Employee ID not on our rolls/);
    expect((await auth.passwordLogin('ravi@college.test', 'orbit-cedar-2741', verify, ctx)).kind).toBe('error');
  });

  it('a one-time set-password link works once (staff added by the Super Admin, local mode)', async () => {
    const { createFileIdentity } = await import('./identity');
    const logs: string[] = [];
    const orig = console.info;
    console.info = (m: string) => void logs.push(m);
    const identity = createFileIdentity(store, (e) => store.staffIdForEmail(e));
    const id = await identity.invite('new@college.test', 'New Person');
    console.info = orig;
    const token = /token_hash=([^&]+)/.exec(logs.join('\n'))![1];
    expect(await identity.completeReset(token, 'invite', 'lotus-amber-5521')).toBe(id);
    expect(await identity.completeReset(token, 'invite', 'lotus-amber-5522')).toBeNull();
    expect(await identity.passwordMatches(id, 'new@college.test', 'lotus-amber-5521')).toBe(true);
  });
});
