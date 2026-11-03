import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { AuthError } from './service';

/**
 * Who holds the password. Production: Supabase Auth (invite + reset emails). Local file store: a stand-in
 * that only mints ids — staff use the dev sign-in picker there.
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
}

export function createFileIdentity(): Identity {
  return {
    emails: false,
    async invite(email) {
      console.info(`[dev identity] invited ${email} (no email sent; sign in with the dev picker)`);
      return `staff-${randomUUID().slice(0, 8)}`;
    },
    async removeInvite() {},
    async sendPasswordReset(email) {
      console.info(`[dev identity] password reset for ${email} (no email sent)`);
    },
    async completeReset() {
      return null;
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
  };
}
