import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BLOCK_KEYS, canEditBlock } from '../cms/blocks';

vi.mock('server-only', () => ({}));
import { homeFor } from '../crm/home';
import { can, DEFAULT_RULES, isDeveloper, PERMISSIONS, permissionsFor } from '../crm/permissions';
import type { Matrix } from '../crm/permissions';
import type { Staff } from '../crm/types';
import type { Identity } from './identity';
import { requiresMfa } from './service';

const dev = { id: 'staff-developer', fullName: 'Developer', email: null, phone: null, roles: ['developer'], active: true } as Staff;
const superAdmin = { id: 'staff-admin', fullName: 'Super Admin', email: null, phone: null, roles: ['super_admin'], active: true } as Staff;

describe('Developer role', () => {
  it('has every permission, even when the matrix takes them away, plus all content, assistant and audit', async () => {
    // Imported after beforeAll's chdir: modules that touch the store resolve .data/ at import time,
    // so a top-level import would write into the real local store.
    const { canSeeAudit, canUseAssistant } = await import('../staffAssistant/service');
    expect(permissionsFor(['developer'])).toEqual(PERMISSIONS);
    const empty = Object.fromEntries(PERMISSIONS.map((p) => [p, []])) as unknown as Matrix;
    expect(permissionsFor(['developer'], empty)).toEqual(PERMISSIONS);
    for (const p of PERMISSIONS) expect(can(dev, p), p).toBe(true);
    expect(can({ roles: ['developer'], perms: [] }, 'staff.manage')).toBe(true); // a stale session can't strip it
    for (const k of BLOCK_KEYS) expect(canEditBlock(['developer'], k), k).toBe(true);
    expect([isDeveloper(dev), isDeveloper(superAdmin)]).toEqual([true, false]);
    expect([canUseAssistant(dev), canSeeAudit(dev)]).toEqual([true, true]);
    expect(requiresMfa(dev)).toBe(false); // normal sign-in, like the Admission Manager
    expect(homeFor('developer')).toBe('/crm/developer');
    // other roles are unchanged
    expect(permissionsFor(['telecaller'])).toEqual(PERMISSIONS.filter((p) => (DEFAULT_RULES[p] as string[]).includes('telecaller')));
  });
});

let dir: string;
let cwd: string;
const identity: Identity = { emails: false, async invite() { return `staff-new-${Math.random().toString(36).slice(2, 8)}`; }, async removeInvite() {}, async sendPasswordReset() {}, async completeReset() { return null; } };
const ctx = { ip: '198.51.100.9', userAgent: 'test' };

beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-dev-'));
  process.chdir(dir);
});
afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('Developer role: staff administration guards', () => {
  it('only a Developer can grant, remove or change the Developer role; nobody removes their own', async () => {
    const repo = (await import('../crm/fileRepo')).createFileCrmRepo();
    const store = (await import('./fileStore')).createFileAuthStore();
    const admin = (await import('./staffAdmin')).createStaffAdmin({ repo, store, identity });

    // the sample developer is in the local store
    expect((await repo.listAllStaff()).some((s) => s.roles.includes('developer'))).toBe(true);

    await expect(admin.create(superAdmin, { fullName: 'New Dev', email: 'dev2@example.test', roles: ['developer'] }, ctx)).rejects.toThrow(/Only a Developer/);
    const second = await admin.create(dev, { fullName: 'New Dev', email: 'dev2@example.test', roles: ['developer'] }, ctx);
    await expect(admin.update(superAdmin, second.id, { fullName: 'New Dev', roles: ['faculty'], active: true }, ctx)).rejects.toThrow(/Only a Developer/);
    await expect(admin.update(superAdmin, second.id, { fullName: 'Renamed', roles: ['developer'], active: false }, ctx)).rejects.toThrow(/Only a Developer/);
    await expect(admin.update(dev, dev.id, { fullName: 'Developer', roles: ['super_admin'], active: true }, ctx)).rejects.toThrow(/own Developer role/);
    // a Developer manages staff like a Super Admin
    const t = await admin.create(dev, { fullName: 'Teacher', email: 't@example.test', roles: ['faculty'] }, ctx);
    expect((await admin.update(dev, t.id, { fullName: 'Teacher', roles: ['faculty', 'class_teacher'], active: true }, ctx)).roles).toEqual(['faculty', 'class_teacher']);
  });
});
