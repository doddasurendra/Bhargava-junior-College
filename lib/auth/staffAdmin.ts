import { z } from 'zod';
import { CLOSED_STATUSES, ROLE_LABELS, ROLES, type CrmRepo, type Role, type Staff } from '../crm/types';
import { normalizeIndianMobile } from '../phone';
import type { Identity } from './identity';
import { AuthError, type Ctx } from './service';
import type { AuthStore } from './types';

/** Staff accounts (Super Admin) and the forgot-password flow. Framework-free; unit tested with the file store. */

const rolesSchema = z.array(z.union([z.enum(ROLES), z.string().regex(/^custom_[a-z0-9_]{2,30}$/).transform((r) => r as Role)])).min(1, 'Pick at least one role.').max(60);
const phone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeIndianMobile(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10-digit Indian mobile number, or leave it blank.' });
      return z.NEVER;
    }
    return n;
  });
const name = z.string().trim().min(2, 'Enter their full name.').max(80, 'Name is too long.');

export const newStaffSchema = z.object({ fullName: name, email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254), phone, roles: rolesSchema });
export const staffPatchSchema = z.object({ fullName: name, phone, roles: rolesSchema, active: z.boolean() });

export const PASSWORD_MIN = 10;
export function passwordProblem(pw: string, email?: string | null): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (pw.length > 200) return 'That password is too long.';
  if (/^(.)\1+$/.test(pw)) return 'Don’t use one character repeated.';
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) return 'Don’t include your email name in the password.';
  if (['password', 'bhargava', 'qwerty', '12345678', 'welcome'].some((w) => pw.toLowerCase().includes(w))) return 'That password is too easy to guess.';
  return null;
}

const RESETS_PER_HOUR = 3;

const first = (e: unknown) => (e instanceof z.ZodError ? e.issues[0]?.message ?? 'Check the form.' : null);
const labels = (roles: Role[]) => roles.map((r) => ROLE_LABELS[r]).join(', ');

export function createStaffAdmin({ repo, store, identity, customRoles = async () => [] }: { repo: Pick<CrmRepo, 'getStaff' | 'listAllStaff' | 'saveStaff' | 'listStaff' | 'listLeads' | 'updateLead'>; store: AuthStore; identity: Identity; customRoles?: () => Promise<string[]> }) {
  async function checkRoles(roles: Role[]) {
    const custom = roles.filter((r) => r.startsWith('custom_'));
    if (custom.length === 0) return;
    const known = new Set(await customRoles());
    const missing = custom.find((r) => !known.has(r));
    if (missing) throw new AuthError('That custom role no longer exists. Reload the page.');
  }
  const log = (staffId: string | null, actorId: string | null, success: boolean, method: 'admin' | 'reset', reason: string, ctx: Ctx, email: string | null = null) =>
    store.logEvent({ staffId, actorId, success, method, reason, email, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null });

  const isDev = (s: Pick<Staff, 'roles'>) => s.roles.includes('developer');

  function mustBeSuperAdmin(actor: Staff) {
    if (!actor.roles.includes('super_admin') && !isDev(actor)) throw new AuthError('Only a Super Admin can manage staff accounts.');
  }

  /** Only a Developer may grant or remove the Developer role, or change a Developer's account. */
  function guardDeveloper(actor: Staff, target: Pick<Staff, 'roles'> | null, nextRoles: Role[]) {
    const touches = nextRoles.includes('developer') || (target ? isDev(target) : false);
    if (touches && !isDev(actor)) throw new AuthError('Only a Developer can give, remove or change the Developer role.');
  }

  async function save(s: Staff) {
    try {
      await repo.saveStaff(s);
    } catch (e) {
      if (e instanceof Error && /Super Admin is required/.test(e.message)) throw new AuthError('The college must keep at least one active Super Admin.');
      throw e;
    }
  }

  /** Open leads of a departing owner go to the first active admission manager (or Super Admin). */
  async function reassignOpenLeads(fromId: string, actorId: string) {
    const open = (await repo.listLeads({ ownerId: fromId })).filter((l) => !CLOSED_STATUSES.includes(l.status));
    if (open.length === 0) return { count: 0, to: '' };
    const staff = (await repo.listStaff()).filter((s) => s.id !== fromId);
    const to = staff.find((s) => s.roles.includes('admission_manager')) ?? staff.find((s) => s.roles.includes('super_admin'));
    if (!to) return { count: 0, to: '' };
    const at = new Date().toISOString();
    for (const l of open) await repo.updateLead(l.id, { ownerId: to.id, assignedAt: at }, [{ action: 'reassigned', actorId, field: 'owner', oldValue: fromId, newValue: to.id, reason: 'Staff exit: owner deactivated' }]);
    return { count: open.length, to: to.fullName };
  }

  return {
    async create(actor: Staff, input: unknown, ctx: Ctx): Promise<Staff> {
      mustBeSuperAdmin(actor);
      let v: z.infer<typeof newStaffSchema>;
      try {
        v = newStaffSchema.parse(input);
      } catch (e) {
        throw new AuthError(first(e) ?? 'Check the form.');
      }
      await checkRoles(v.roles);
      guardDeveloper(actor, null, v.roles);
      if (await store.staffIdForEmail(v.email)) throw new AuthError('A staff member already uses this email. Find them below (they may be deactivated).');
      const id = await identity.invite(v.email, v.fullName);
      const staff: Staff = { id, fullName: v.fullName, email: v.email, phone: v.phone, roles: v.roles, active: true };
      try {
        await save(staff);
      } catch (e) {
        await identity.removeInvite(id);
        throw e;
      }
      await log(id, actor.id, true, 'admin', `staff created: ${labels(v.roles)}${identity.emails ? ', invitation emailed' : ''}`, ctx, v.email);
      return staff;
    },

    async update(actor: Staff, id: string, input: unknown, ctx: Ctx): Promise<Staff> {
      mustBeSuperAdmin(actor);
      const cur = await repo.getStaff(id);
      if (!cur) throw new AuthError('Staff member not found.');
      let v: z.infer<typeof staffPatchSchema>;
      try {
        v = staffPatchSchema.parse(input);
      } catch (e) {
        throw new AuthError(first(e) ?? 'Check the form.');
      }
      await checkRoles(v.roles);
      guardDeveloper(actor, cur, v.roles);
      if (id === actor.id && !v.active) throw new AuthError('You can’t deactivate your own account.');
      if (id === actor.id && isDev(actor) && !v.roles.includes('developer')) throw new AuthError('You can’t remove your own Developer role.');
      if (id === actor.id && !isDev(actor) && !v.roles.includes('super_admin')) throw new AuthError('You can’t remove your own Super Admin role. Ask another Super Admin.');

      const next: Staff = { ...cur, fullName: v.fullName, phone: v.phone, roles: v.roles, active: v.active };
      await save(next);

      const changes: string[] = [];
      if (cur.fullName !== next.fullName) changes.push(`name → ${next.fullName}`);
      if (cur.phone !== next.phone) changes.push(`phone ${next.phone ? 'changed' : 'removed'}`);
      const added = next.roles.filter((r) => !cur.roles.includes(r));
      const removed = cur.roles.filter((r) => !next.roles.includes(r));
      if (added.length) changes.push(`+${labels(added)}`);
      if (removed.length) changes.push(`−${labels(removed)}`);
      if (cur.active !== next.active) changes.push(next.active ? 'reactivated' : 'deactivated');
      if (changes.length) {
        // Deactivating or taking a role away ends their current sessions straight away.
        if (!next.active || removed.length) {
          const a = await store.get(id);
          await store.update(id, { sessionVersion: a.sessionVersion + 1 });
        }
        await log(id, actor.id, true, 'admin', `staff updated: ${changes.join('; ')}`, ctx, cur.email);
      }
      // §9A.1 staff exit: deactivating someone hands their open leads to an admission manager
      if (cur.active && !next.active) {
        const moved = await reassignOpenLeads(id, actor.id);
        if (moved.count) await log(id, actor.id, true, 'admin', `staff exit: ${moved.count} open lead${moved.count === 1 ? '' : 's'} reassigned to ${moved.to}`, ctx, cur.email);
      }
      return next;
    },

    async sendReset(actor: Staff, id: string, ctx: Ctx) {
      mustBeSuperAdmin(actor);
      const s = await repo.getStaff(id);
      if (s) guardDeveloper(actor, s, s.roles);
      if (!s?.email) throw new AuthError('This staff member has no email address.');
      if (!s.active) throw new AuthError('Reactivate them first.');
      await identity.sendPasswordReset(s.email);
      await log(id, actor.id, true, 'reset', 'password reset email sent by admin', ctx, s.email);
    },

    /** Public "forgot password": always answers the same, whether or not the email is staff. */
    async requestReset(emailRaw: string, ctx: Ctx, now = new Date()) {
      const email = emailRaw.trim().toLowerCase();
      if (!z.string().email().safeParse(email).success) return;
      const id = await store.staffIdForEmail(email);
      const s = id ? await repo.getStaff(id) : null;
      if (!s || !s.active) {
        await log(id, null, false, 'reset', s ? 'reset requested: inactive' : 'reset requested: unknown email', ctx, email);
        return;
      }
      const recent = (await store.listEvents({ limit: 50, staffId: s.id })).filter((e) => e.method === 'reset' && e.reason.startsWith('reset requested') && now.getTime() - new Date(e.at).getTime() < 3600_000);
      if (recent.length >= RESETS_PER_HOUR) {
        await log(s.id, null, false, 'reset', 'reset requested: too many this hour', ctx, email);
        return;
      }
      await identity.sendPasswordReset(email);
      await log(s.id, null, true, 'reset', 'reset requested', ctx, email);
    },

    /** From the emailed link: set the new password, sign out everywhere, clear any lock. */
    async completeReset(tokenHash: string, type: 'recovery' | 'invite', password: string, confirm: string, ctx: Ctx): Promise<{ ok: true } | { ok: false; message: string }> {
      if (password !== confirm) return { ok: false, message: 'The two passwords don’t match.' };
      const p = passwordProblem(password);
      if (p) return { ok: false, message: p };
      if (!/^[A-Za-z0-9_-]{10,200}$/.test(tokenHash)) return { ok: false, message: 'This link is not valid. Ask for a new one.' };
      const id = await identity.completeReset(tokenHash, type, password);
      if (!id) {
        await log(null, null, false, 'reset', `${type === 'invite' ? 'invitation' : 'reset'} link invalid or expired`, ctx);
        return { ok: false, message: 'This link has expired or was already used. Ask for a new one.' };
      }
      const a = await store.get(id);
      await store.update(id, { sessionVersion: a.sessionVersion + 1, failedCount: 0, lockedUntil: null });
      await log(id, null, true, 'reset', type === 'invite' ? 'password set from invitation' : 'password changed by reset link', ctx);
      return { ok: true };
    },
  };
}

export type StaffAdmin = ReturnType<typeof createStaffAdmin>;
