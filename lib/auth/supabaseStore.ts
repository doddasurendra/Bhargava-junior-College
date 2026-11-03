import { createClient } from '@supabase/supabase-js';
import { emptyAuth, type AuthStore, type LoginEvent, type StaffAuth } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toAuth = (r: Row): StaffAuth => ({
  staffId: r.profile_id,
  totpSecretEnc: r.totp_secret_enc,
  totpPendingEnc: r.totp_pending_enc,
  totpEnabledAt: r.totp_enabled_at,
  totpLastStep: Number(r.totp_last_step ?? 0),
  recoveryHashes: r.recovery_hashes ?? [],
  failedCount: r.failed_count ?? 0,
  lockedUntil: r.locked_until,
  sessionVersion: r.session_version ?? 0,
});

const COLS: Record<string, string> = {
  totpSecretEnc: 'totp_secret_enc',
  totpPendingEnc: 'totp_pending_enc',
  totpEnabledAt: 'totp_enabled_at',
  totpLastStep: 'totp_last_step',
  recoveryHashes: 'recovery_hashes',
  failedCount: 'failed_count',
  lockedUntil: 'locked_until',
  sessionVersion: 'session_version',
};

const toEvent = (r: Row): LoginEvent => ({
  id: String(r.id),
  at: r.at,
  email: r.email,
  staffId: r.user_id,
  success: r.success,
  method: r.method ?? 'password',
  reason: r.reason ?? (r.success ? 'ok' : 'failed'),
  ip: r.ip,
  userAgent: r.user_agent,
  actorId: r.actor_id,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Server-only, service role. staff_auth and login_audit have RLS on and no policies: nothing else can read them. */
export function createSupabaseAuthStore(url: string, serviceKey: string): AuthStore {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async get(staffId) {
      const r = check(await sb.from('staff_auth').select('*').eq('profile_id', staffId).maybeSingle());
      return r ? toAuth(r) : emptyAuth(staffId);
    },
    async listAll() {
      return (check(await sb.from('staff_auth').select('*')) ?? []).map(toAuth);
    },
    async update(staffId, patch) {
      const row: Row = { profile_id: staffId, updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(patch)) if (COLS[k]) row[COLS[k]] = v;
      return toAuth(check(await sb.from('staff_auth').upsert(row, { onConflict: 'profile_id' }).select('*').single()) as Row);
    },
    async recordFailure(staffId, _now, max, lockMs) {
      return toAuth(check(await sb.rpc('auth_record_failure', { p_profile: staffId, p_max: max, p_lock_seconds: Math.round(lockMs / 1000) }).single()) as Row);
    },
    async useStep(staffId, step) {
      return Boolean(check(await sb.rpc('auth_use_step', { p_profile: staffId, p_step: step })));
    },
    async consumeRecovery(staffId, hash) {
      return Boolean(check(await sb.rpc('auth_consume_recovery', { p_profile: staffId, p_hash: hash })));
    },
    async staffIdForEmail(email) {
      const r = check(await sb.from('profiles').select('id').ilike('email', email.replace(/[%_\\]/g, '\\$&')).maybeSingle());
      return r?.id ?? null;
    },
    async logEvent(e) {
      const { error } = await sb.from('login_audit').insert({
        email: e.email?.toLowerCase() ?? null,
        user_id: e.staffId,
        success: e.success,
        method: e.method,
        reason: e.reason,
        ip: e.ip,
        user_agent: e.userAgent,
        actor_id: e.actorId ?? null,
      });
      // Never block a sign-in on the audit write, but make the failure loud.
      if (error) console.error('[auth] login audit write failed', error.message);
    },
    async listEvents({ limit, failedOnly, staffId }) {
      let q = sb.from('login_audit').select('*').order('at', { ascending: false }).limit(limit);
      if (failedOnly) q = q.eq('success', false);
      if (staffId) q = q.eq('user_id', staffId);
      return (check(await q) ?? []).map(toEvent);
    },
  };
}
