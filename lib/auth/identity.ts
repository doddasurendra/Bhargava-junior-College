import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { AuthError, checkPassword, hashPassword } from './service';
import type { AuthStore } from './types';

/**
 * Who holds the password. Production: Supabase Auth (invite + reset emails). Local file store: scrypt
 * hashes on the auth record, and one-time set-password links printed to the server console (no mailer).
 */
export interface Identity {
  readonly emails: boolean;
  /** creates the sign-in identity and emails an invitation to set a password; returns the user id */
  invite(email: string, fullName: string): Promise<string>;
  /** undo an invite when saving the profile failed */
  removeInvite(id: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** token from the emailed link + the new password → the user id, or null if the link is invalid/expired/used */
  completeReset(tokenHash: string, type: 'recovery' | 'invite', password: string): Promise<string | null>;
  /**
   * Self-registration (teachers and staff): the sign-in identity with the password the applicant chose.
   * It grants nothing by itself: there is no staff profile (so no roles) until an administrator approves.
   */
  register(email: string, fullName: string, password: string): Promise<string>;
  /** Is this the password of identity `id`? (to tell an applicant their request is still pending) */
  passwordMatches(id: string, email: string, password: string): Promise<boolean>;
}

const TOKEN_TTL_MS = 24 * 3600_000;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * Local file store. `store` holds the password hash and the one-time link token; `idForEmail` finds staff
 * (approved) or pending applicants by email; `siteUrl` builds the link printed to the console.
 */
export function createFileIdentity(store?: AuthStore, idForEmail?: (email: string) => Promise<string | null>, siteUrl = 'http://localhost:3000'): Identity {
  async function issueLink(id: string, email: string, type: 'invite' | 'recovery') {
    if (!store) return;
    const token = randomBytes(24).toString('base64url');
    await store.update(id, { resetTokenHash: sha(token), resetTokenExp: new Date(Date.now() + TOKEN_TTL_MS).toISOString() });
    // No mailer locally: the link goes to the server console only (never to the browser or the admin's screen).
    console.info(`[dev identity] ${type === 'invite' ? 'invitation' : 'password reset'} for ${email}: ${siteUrl}/crm/login/reset?token_hash=${token}&type=${type} (valid 24 h)`);
  }
  return {
    emails: false,
    async invite(email) {
      const id = `staff-${randomUUID().slice(0, 8)}`;
      await issueLink(id, email, 'invite');
      return id;
    },
    async removeInvite() {},
    async sendPasswordReset(email) {
      const id = idForEmail ? await idForEmail(email) : null;
      if (id) await issueLink(id, email, 'recovery');
    },
    async completeReset(tokenHash, _type, password) {
      if (!store) return null;
      const h = sha(tokenHash);
      const row = (await store.listAll()).find((a) => a.resetTokenHash === h);
      if (!row || !row.resetTokenExp || new Date(row.resetTokenExp) < new Date()) return null;
      await store.update(row.staffId, { passwordHash: hashPassword(password), resetTokenHash: null, resetTokenExp: null });
      return row.staffId;
    },
    async register(_email, _fullName, password) {
      if (!store) throw new Error('file identity needs an auth store');
      const id = `staff-${randomUUID().slice(0, 8)}`;
      await store.update(id, { passwordHash: hashPassword(password) });
      return id;
    },
    async passwordMatches(id, _email, password) {
      return store ? checkPassword(password, (await store.get(id)).passwordHash) : false;
    },
  };
}

export function createSupabaseIdentity(url: string, serviceKey: string, anonKey: string, siteUrl: string): Identity {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, serviceKey, opts);
  const redirectTo = `${siteUrl}/crm/login/reset`;
  return {
    emails: true,
    async invite(email, fullName) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName } });
      if (error || !data.user) {
        if (error && /already/i.test(error.message)) throw new AuthError('Someone with this email already has a sign-in. Check the deactivated staff below.');
        throw new Error(`invite failed: ${error?.message ?? 'no user'}`);
      }
      return data.user.id;
    },
    async removeInvite(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) console.error('[identity] could not remove invite', id, error.message);
    },
    async sendPasswordReset(email) {
      const anon = createClient(url, anonKey, opts);
      const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) console.error('[identity] reset email failed', error.message);
    },
    async completeReset(tokenHash, type, password) {
      const sb = createClient(url, anonKey, opts);
      const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error || !data.user || !data.session) return null;
      const upd = await sb.auth.updateUser({ password });
      await sb.auth.signOut().catch(() => undefined);
      if (upd.error) throw new AuthError(upd.error.message);
      return data.user.id;
    },
    async register(email, fullName, password) {
      // email_confirm stays false: Supabase sends its confirmation email, and an administrator still has to approve.
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: fullName, self_registered: true } });
      if (error || !data.user) {
        if (error && /already|registered|exists/i.test(error.message)) throw new AuthError('This email already has a sign-in. Sign in, or use Forgot password.');
        throw new Error(`register failed: ${error?.message ?? 'no user'}`);
      }
      return data.user.id;
    },
    async passwordMatches(id, email, password) {
      const sb = createClient(url, anonKey, opts);
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      await sb.auth.signOut().catch(() => undefined);
      return !error && data.user?.id === id;
    },
  };
}
