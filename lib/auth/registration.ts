import { z } from 'zod';
import { ROLE_LABELS, ROLES, type CrmRepo, type Role, type Staff } from '../crm/types';
import { normalizeIndianMobile } from '../phone';
import { DEPARTMENTS, SELF_REGISTER_ROLES, staffProfiles, staffRegistrations } from '../records/collections';
import type { RecordStore } from '../records/types';
import type { Identity } from './identity';
import { AuthError, type Ctx } from './service';
import { passwordProblem } from './staffAdmin';
import type { AuthStore } from './types';

/**
 * Teacher and staff self-registration (master prompt §2): the applicant fills the form and chooses their own
 * password; nothing is granted until a Super Admin (or Developer) approves the request and confirms the role.
 * Leadership, Super Admin and Developer roles can never be requested here.
 */

const PRIVILEGED: Role[] = ['developer', 'super_admin', 'management', 'principal'];

export const registrationSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(80, 'Name is too long.'),
    employeeId: z.string().trim().regex(/^[A-Za-z0-9/-]{2,30}$/, 'Enter your employee ID (letters, digits, / or -).'),
    email: z.string().trim().toLowerCase().email('Enter your official email address.').max(254),
    phone: z.string().trim().max(20).transform((v, ctx) => {
      const n = normalizeIndianMobile(v);
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10-digit Indian mobile number.' });
        return z.NEVER;
      }
      return n;
    }),
    department: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Choose your department.' }) }),
    designation: z.string().trim().min(2, 'Enter your designation.').max(60),
    requestedRole: z.enum(SELF_REGISTER_ROLES, { errorMap: () => ({ message: 'Choose the account you need.' }) }),
    password: z.string().max(200),
    confirm: z.string().max(200),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirm) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirm'], message: 'The two passwords don’t match.' });
    const p = passwordProblem(v.password, v.email);
    if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: p });
  });

export type RegistrationInput = z.input<typeof registrationSchema>;
type Reg = z.infer<(typeof staffRegistrations)['schema']>;

const first = (e: z.ZodError) => e.issues[0]?.message ?? 'Check the form.';

export function createRegistration({ records, store, identity, repo }: { records: RecordStore; store: AuthStore; identity: Identity; repo: Pick<CrmRepo, 'getStaff' | 'saveStaff' | 'listAllStaff'> }) {
  const log = (staffId: string | null, actorId: string | null, success: boolean, reason: string, ctx: Ctx, email: string | null) =>
    store.logEvent({ staffId, actorId, success, method: 'register', reason, email, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null });

  const canApprove = (a: Staff) => a.roles.includes('super_admin') || a.roles.includes('developer');

  async function byEmail(email: string) {
    return (await staffRegistrations.list(records, { k1: email.toLowerCase() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return {
    /** Public form. Throws AuthError with a message for the applicant. */
    async submit(input: unknown, ctx: Ctx) {
      const parsed = registrationSchema.safeParse(input);
      if (!parsed.success) throw new AuthError(first(parsed.error));
      const v = parsed.data;
      if (await store.staffIdForEmail(v.email)) throw new AuthError('This email already has a staff account. Sign in, or use Forgot password.');
      const mine = await byEmail(v.email);
      if (mine.some((r) => r.data.status === 'pending')) throw new AuthError('A request with this email is already waiting for approval.');
      const empTaken = (await staffProfiles.list(records, { k2: v.employeeId.toUpperCase() })).length > 0 || (await staffRegistrations.list(records, { k2: 'pending' })).some((r) => r.data.employeeId.toUpperCase() === v.employeeId.toUpperCase());
      if (empTaken) throw new AuthError('This employee ID is already registered. Contact the admin office.');

      const identityId = await identity.register(v.email, v.fullName, v.password);
      const rec = await staffRegistrations.put(records, { identityId, fullName: v.fullName, email: v.email, phone: v.phone, employeeId: v.employeeId, department: v.department, designation: v.designation, requestedRole: v.requestedRole, status: 'pending', decidedBy: null, decidedAt: null, decisionNote: null, approvedRoles: [] });
      await log(null, null, true, `registration requested: ${ROLE_LABELS[v.requestedRole]}`, ctx, v.email);
      return { id: rec.id, emails: identity.emails };
    },

    list: async (status?: Reg['status']) => (await staffRegistrations.list(records, status ? { k2: status } : undefined)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    async approve(actor: Staff, id: string, roles: string[], ctx: Ctx): Promise<Staff> {
      if (!canApprove(actor)) throw new AuthError('Only a Super Admin can approve staff accounts.');
      const r = await staffRegistrations.get(records, id);
      if (!r || r.data.status !== 'pending') throw new AuthError('This request has already been decided.');
      const clean = [...new Set(roles)].filter((x): x is Role => (ROLES as readonly string[]).includes(x));
      if (clean.length === 0) throw new AuthError('Pick at least one role.');
      if (clean.some((x) => PRIVILEGED.includes(x)) && !actor.roles.includes('developer')) throw new AuthError('Leadership, Super Admin and Developer roles are given from Staff accounts, not from a registration request.');
      if (await store.staffIdForEmail(r.data.email)) throw new AuthError('Someone already has a staff account with this email.');
      const staff: Staff = { id: r.data.identityId, fullName: r.data.fullName, email: r.data.email, phone: r.data.phone, roles: clean, active: true };
      await repo.saveStaff(staff);
      await staffProfiles.put(records, { staffId: staff.id, employeeId: r.data.employeeId, department: r.data.department, designation: r.data.designation, joinedOn: null });
      const at = new Date().toISOString();
      await staffRegistrations.put(records, { ...r.data, status: 'approved', decidedBy: actor.id, decidedAt: at, approvedRoles: clean }, r.id);
      await log(staff.id, actor.id, true, `registration approved: ${clean.map((x) => ROLE_LABELS[x]).join(', ')}`, ctx, r.data.email);
      return staff;
    },

    async reject(actor: Staff, id: string, note: string, ctx: Ctx) {
      if (!canApprove(actor)) throw new AuthError('Only a Super Admin can decide staff registrations.');
      if (note.trim().length < 3) throw new AuthError('Give a reason, so the applicant knows what to fix.');
      const r = await staffRegistrations.get(records, id);
      if (!r || r.data.status !== 'pending') throw new AuthError('This request has already been decided.');
      await staffRegistrations.put(records, { ...r.data, status: 'rejected', decidedBy: actor.id, decidedAt: new Date().toISOString(), decisionNote: note.trim().slice(0, 300) }, r.id);
      await log(null, actor.id, true, `registration rejected: ${note.trim().slice(0, 120)}`, ctx, r.data.email);
    },

    /**
     * After a failed sign-in: if this email + password belong to a registration that is not approved yet, say
     * so. Checked only with the right password, so it reveals nothing to someone guessing emails.
     */
    async pendingMessage(email: string, password: string): Promise<string | null> {
      const latest = (await byEmail(email.trim().toLowerCase()))[0];
      if (!latest || latest.data.status === 'approved') return null;
      if (!(await identity.passwordMatches(latest.data.identityId, latest.data.email, password))) return null;
      return latest.data.status === 'pending'
        ? 'Your registration is waiting for approval by the college administrator. You can sign in once it is approved.'
        : `Your registration was not approved${latest.data.decisionNote ? `: ${latest.data.decisionNote}` : '.'} Contact the admin office, or register again with the corrected details.`;
    },
  };
}

export type Registration = ReturnType<typeof createRegistration>;
