import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ROLE_LABELS, type CrmRepo, type Role, type Staff } from '../crm/types';
import { generateRecoveryCodes, generateSecret, hashRecovery, looksLikeRecovery, otpauthUri, seal, unseal, verifyTotp } from './totp';
import type { AuthStore, LoginMethod, StaffAuth } from './types';

/** Acceptance criteria: 2FA for Super Admin, Management and Accounts. Anyone else may opt in. */
// The Developer signs in with a normal password (owner's choice); 2FA stays optional from My account.
export const MFA_ROLES: Role[] = ['super_admin', 'management', 'accounts'];
export const requiresMfa = (s: Pick<Staff, 'roles'>) => s.roles.some((r) => MFA_ROLES.includes(r));

export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const ISSUER = 'Bhargava CRM';

export interface Ctx {
  ip: string | null;
  userAgent: string | null;
  now?: Date;
}

/** Correct email + password → the staff id; otherwise null. Supabase Auth in production. */
export type PasswordVerifier = (email: string, password: string) => Promise<string | null>;

export type FirstStep = { kind: 'error'; message: string } | { kind: 'session'; staffId: string; sv: number } | { kind: 'mfa'; staffId: string; enrolled: boolean };
export type SecondStep = { kind: 'error'; message: string } | { kind: 'session'; staffId: string; sv: number; method: 'totp' | 'recovery'; recoveryLeft: number };

const BAD_LOGIN = 'Email or password is incorrect.';
const BAD_CODE = 'That code didn’t work. Check the time on your phone and use the newest code.';
const NO_ACCESS = 'This account has no CRM access. Contact the admin office.';

export const isLocked = (a: Pick<StaffAuth, 'lockedUntil'>, now: Date) => Boolean(a.lockedUntil && new Date(a.lockedUntil) > now);
const lockedMessage = (a: StaffAuth, now: Date) => {
  const mins = Math.max(1, Math.ceil((new Date(a.lockedUntil!).getTime() - now.getTime()) / 60000));
  return `Too many failed attempts. This account is locked for ${mins} more minute${mins === 1 ? '' : 's'}, or ask the Super Admin to unlock it.`;
};

export class AuthError extends Error {}

// ---------------------------------------------------------------- local passwords (file store / tests only)

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${scryptSync(pw, salt, 32).toString('base64url')}`;
}

export function checkPassword(pw: string, stored: string | null | undefined): boolean {
  const [alg, salt, hash] = (stored ?? '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const a = scryptSync(pw, Buffer.from(salt, 'base64url'), 32);
  const b = Buffer.from(hash, 'base64url');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- service

export function createAuthService({ store, repo }: { store: AuthStore; repo: Pick<CrmRepo, 'getStaff'> }) {
  const log = (e: { email?: string | null; staffId: string | null; success: boolean; method: LoginMethod; reason: string; actorId?: string | null }, ctx: Ctx) =>
    store.logEvent({ email: e.email ?? null, staffId: e.staffId, success: e.success, method: e.method, reason: e.reason, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null, actorId: e.actorId ?? null });

  const usable = (s: Staff | null): s is Staff => Boolean(s && s.active && s.roles.length > 0);

  async function fail(staffId: string, email: string | null, method: LoginMethod, reason: string, ctx: Ctx, now: Date, message: string) {
    const a = await store.recordFailure(staffId, now, MAX_FAILS, LOCK_MS);
    await log({ email, staffId, success: false, method, reason: isLocked(a, now) ? `${reason} → locked` : reason }, ctx);
    return { kind: 'error' as const, message: isLocked(a, now) ? lockedMessage(a, now) : message };
  }

  /** After the password (or the dev picker): straight in, or on to the second factor. */
  async function afterFirstFactor(staffId: string, email: string | null, method: LoginMethod, ctx: Ctx): Promise<FirstStep> {
    const now = ctx.now ?? new Date();
    const staff = await repo.getStaff(staffId);
    if (!usable(staff)) {
      await log({ email, staffId, success: false, method, reason: 'no_access' }, ctx);
      return { kind: 'error', message: NO_ACCESS };
    }
    const auth = await store.get(staffId);
    if (isLocked(auth, now)) {
      await log({ email, staffId, success: false, method, reason: 'locked' }, ctx);
      return { kind: 'error', message: lockedMessage(auth, now) };
    }
    if (requiresMfa(staff) || auth.totpEnabledAt) {
      await log({ email, staffId, success: true, method, reason: auth.totpEnabledAt ? 'ok, 2fa pending' : 'ok, 2fa enrolment pending' }, ctx);
      return { kind: 'mfa', staffId, enrolled: Boolean(auth.totpEnabledAt) };
    }
    if (auth.failedCount > 0) await store.update(staffId, { failedCount: 0, lockedUntil: null });
    await log({ email, staffId, success: true, method, reason: 'ok' }, ctx);
    return { kind: 'session', staffId, sv: auth.sessionVersion };
  }

  async function mfaUser(staffId: string) {
    const staff = await repo.getStaff(staffId);
    if (!usable(staff)) throw new AuthError(NO_ACCESS);
    return { staff, auth: await store.get(staffId) };
  }

  /** Checks a current authenticator code (not a recovery code) and spends its time step. */
  async function checkTotp(auth: StaffAuth, code: string, now: Date): Promise<'ok' | 'bad_code' | 'replayed_code'> {
    const secret = auth.totpSecretEnc ? unseal(auth.totpSecretEnc) : null;
    if (!secret) return 'bad_code';
    const step = verifyTotp(secret, code, now.getTime(), auth.totpLastStep);
    if (step !== null && (await store.useStep(auth.staffId, step))) return 'ok';
    return verifyTotp(secret, code, now.getTime(), 0) !== null ? 'replayed_code' : 'bad_code';
  }

  return {
    async passwordLogin(email: string, password: string, verify: PasswordVerifier, ctx: Ctx): Promise<FirstStep> {
      const now = ctx.now ?? new Date();
      const e = email.trim().toLowerCase();
      const knownId = await store.staffIdForEmail(e);
      if (knownId) {
        const a = await store.get(knownId);
        if (isLocked(a, now)) {
          await log({ email: e, staffId: knownId, success: false, method: 'password', reason: 'locked' }, ctx);
          return { kind: 'error', message: lockedMessage(a, now) };
        }
      }
      const id = await verify(e, password);
      if (!id) {
        if (!knownId) {
          await log({ email: e, staffId: null, success: false, method: 'password', reason: 'unknown_email' }, ctx);
          return { kind: 'error', message: BAD_LOGIN };
        }
        return fail(knownId, e, 'password', 'bad_password', ctx, now, BAD_LOGIN);
      }
      return afterFirstFactor(id, e, 'password', ctx);
    },

    devLogin: (staffId: string, ctx: Ctx) => afterFirstFactor(staffId, null, 'dev', ctx),

    /** The code from the authenticator app, or one of the recovery codes. */
    async secondFactor(staffId: string, code: string, ctx: Ctx): Promise<SecondStep> {
      const now = ctx.now ?? new Date();
      const { auth } = await mfaUser(staffId);
      if (isLocked(auth, now)) {
        await log({ staffId, success: false, method: 'totp', reason: 'locked' }, ctx);
        return { kind: 'error', message: lockedMessage(auth, now) };
      }
      if (!auth.totpEnabledAt) return { kind: 'error', message: 'Two-step verification is not set up yet.' };

      if (looksLikeRecovery(code)) {
        if (!(await store.consumeRecovery(staffId, hashRecovery(code)))) return fail(staffId, null, 'recovery', 'bad_recovery_code', ctx, now, 'That recovery code is not valid or has already been used.');
        await store.update(staffId, { failedCount: 0, lockedUntil: null });
        const left = auth.recoveryHashes.length - 1;
        await log({ staffId, success: true, method: 'recovery', reason: `ok, ${left} recovery codes left` }, ctx);
        return { kind: 'session', staffId, sv: auth.sessionVersion, method: 'recovery', recoveryLeft: left };
      }

      const r = await checkTotp(auth, code, now);
      if (r !== 'ok') return fail(staffId, null, 'totp', r, ctx, now, r === 'replayed_code' ? 'That code has already been used. Wait for the next one.' : BAD_CODE);
      if (auth.failedCount > 0) await store.update(staffId, { failedCount: 0, lockedUntil: null });
      await log({ staffId, success: true, method: 'totp', reason: 'ok' }, ctx);
      return { kind: 'session', staffId, sv: auth.sessionVersion, method: 'totp', recoveryLeft: auth.recoveryHashes.length };
    },

    /** The secret to show on the enrolment screen; stable across reloads until confirmed. */
    async enrolment(staffId: string): Promise<{ secret: string; uri: string } | null> {
      const { staff, auth } = await mfaUser(staffId);
      if (auth.totpEnabledAt) return null;
      let secret = auth.totpPendingEnc ? unseal(auth.totpPendingEnc) : null;
      if (!secret) {
        secret = generateSecret();
        await store.update(staffId, { totpPendingEnc: seal(secret) });
      }
      return { secret, uri: otpauthUri(secret, staff.email ?? staff.fullName, ISSUER) };
    },

    async confirmEnrolment(staffId: string, code: string, ctx: Ctx): Promise<{ kind: 'error'; message: string } | { kind: 'session'; staffId: string; sv: number; codes: string[] }> {
      const now = ctx.now ?? new Date();
      const { auth } = await mfaUser(staffId);
      if (isLocked(auth, now)) return { kind: 'error', message: lockedMessage(auth, now) };
      if (auth.totpEnabledAt) return { kind: 'error', message: 'Two-step verification is already set up.' };
      const secret = auth.totpPendingEnc ? unseal(auth.totpPendingEnc) : null;
      if (!secret) return { kind: 'error', message: 'Reload the page to get a new setup code.' };
      const step = verifyTotp(secret, code, now.getTime(), 0);
      if (step === null) return fail(staffId, null, 'enrol', 'bad_code', ctx, now, BAD_CODE);
      const codes = generateRecoveryCodes();
      await store.update(staffId, {
        totpSecretEnc: auth.totpPendingEnc,
        totpPendingEnc: null,
        totpEnabledAt: now.toISOString(),
        totpLastStep: step,
        recoveryHashes: codes.map(hashRecovery),
        failedCount: 0,
        lockedUntil: null,
      });
      await log({ staffId, success: true, method: 'enrol', reason: '2fa enabled' }, ctx);
      return { kind: 'session', staffId, sv: auth.sessionVersion, codes };
    },

    /** Needs a current authenticator code; the old recovery codes stop working. */
    async regenerateRecoveryCodes(staffId: string, code: string, ctx: Ctx): Promise<string[]> {
      const now = ctx.now ?? new Date();
      const { auth } = await mfaUser(staffId);
      if (!auth.totpEnabledAt) throw new AuthError('Two-step verification is not set up.');
      if (isLocked(auth, now)) throw new AuthError(lockedMessage(auth, now));
      const r = await checkTotp(auth, code, now);
      if (r !== 'ok') {
        const f = await fail(staffId, null, 'totp', `${r} (recovery codes)`, ctx, now, BAD_CODE);
        throw new AuthError(f.message);
      }
      const codes = generateRecoveryCodes();
      await store.update(staffId, { recoveryHashes: codes.map(hashRecovery), failedCount: 0 });
      await log({ staffId, success: true, method: 'totp', reason: 'recovery codes regenerated' }, ctx);
      return codes;
    },

    /** Opt-out, only for roles that don't require 2FA. */
    async disable2fa(staffId: string, code: string, ctx: Ctx) {
      const now = ctx.now ?? new Date();
      const { staff, auth } = await mfaUser(staffId);
      if (requiresMfa(staff)) throw new AuthError('Two-step verification is required for your role.');
      if (!auth.totpEnabledAt) return;
      const r = await checkTotp(auth, code, now);
      if (r !== 'ok') throw new AuthError((await fail(staffId, null, 'totp', `${r} (disable)`, ctx, now, BAD_CODE)).message);
      await store.update(staffId, { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, recoveryHashes: [] });
      await log({ staffId, success: true, method: 'totp', reason: '2fa disabled by user' }, ctx);
    },

    /** Signs out every other browser; returns the new version for the current cookie. */
    async signOutEverywhere(staffId: string, ctx: Ctx): Promise<number> {
      const auth = await store.get(staffId);
      const sv = auth.sessionVersion + 1;
      await store.update(staffId, { sessionVersion: sv });
      await log({ staffId, success: true, method: 'logout', reason: 'signed out everywhere' }, ctx);
      return sv;
    },

    logout: (staffId: string, ctx: Ctx) => log({ staffId, success: true, method: 'logout', reason: 'ok' }, ctx),

    roleSwitched: (staffId: string, from: Role, to: Role, ctx: Ctx) => log({ staffId, success: true, method: 'role', reason: `${ROLE_LABELS[from]} → ${ROLE_LABELS[to]}` }, ctx),

    /** Lost phone and no recovery codes: another Super Admin clears 2FA. The user re-enrols at next sign-in. */
    async adminReset2fa(actor: Staff, targetId: string, reason: string, ctx: Ctx) {
      if (!actor.roles.includes('super_admin') && !actor.roles.includes('developer')) throw new AuthError('Only a Super Admin can reset two-step verification.');
      if (actor.id === targetId) throw new AuthError('You can’t reset your own two-step verification. Use a recovery code, or ask another Super Admin.');
      if (reason.trim().length < 5) throw new AuthError('Give a reason (at least 5 characters).');
      const auth = await store.get(targetId);
      await store.update(targetId, { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: 0, recoveryHashes: [], failedCount: 0, lockedUntil: null, sessionVersion: auth.sessionVersion + 1 });
      await log({ staffId: targetId, success: true, method: 'admin', reason: `2fa reset: ${reason.trim().slice(0, 200)}`, actorId: actor.id }, ctx);
    },

    async adminUnlock(actor: Staff, targetId: string, ctx: Ctx) {
      if (!actor.roles.includes('super_admin') && !actor.roles.includes('developer')) throw new AuthError('Only a Super Admin can unlock accounts.');
      await store.update(targetId, { failedCount: 0, lockedUntil: null });
      await log({ staffId: targetId, success: true, method: 'admin', reason: 'unlocked', actorId: actor.id }, ctx);
    },

    /** Is a decoded session cookie still good for this staff member? */
    async sessionValid(staff: Staff, claims: { sv?: number; mfa?: boolean }) {
      const auth = await store.get(staff.id);
      if ((claims.sv ?? 0) !== auth.sessionVersion) return false;
      if ((requiresMfa(staff) || auth.totpEnabledAt) && !claims.mfa) return false;
      // a 2FA role whose 2FA is gone (reset, restored database) must sign in again and re-enrol
      if (requiresMfa(staff) && !auth.totpEnabledAt) return false;
      return true;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/** Local file store: passwords as scrypt hashes on the auth record (no UI to set them; production uses Supabase Auth). */
export const fileVerifier =
  (store: AuthStore): PasswordVerifier =>
  async (email, password) => {
    const id = await store.staffIdForEmail(email);
    if (!id) return null;
    return checkPassword(password, (await store.get(id)).passwordHash) ? id : null;
  };
