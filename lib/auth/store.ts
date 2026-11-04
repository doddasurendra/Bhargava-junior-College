import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getCrmRepo, usingSupabase } from '../crm/repo';
import { createFileAuthStore } from './fileStore';
import { createAuthService, fileVerifier, type AuthService, type PasswordVerifier } from './service';
import { createSupabaseAuthStore } from './supabaseStore';
import type { AuthStore } from './types';
import { siteUrl } from '../seo';
import { loadRbac } from '../crm/rbac';
import { getRecordStore } from '../records';
import { createFileIdentity, createSupabaseIdentity, type Identity } from './identity';
import { createStaffAdmin, type StaffAdmin } from './staffAdmin';

let store: AuthStore | null = null;
let service: AuthService | null = null;

export function getAuthStore(): AuthStore {
  if (!store) store = usingSupabase() ? createSupabaseAuthStore(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) : createFileAuthStore();
  return store;
}

export function getAuthService(): AuthService {
  if (!service) service = createAuthService({ store: getAuthStore(), repo: getCrmRepo() });
  return service;
}

let identity: Identity | null = null;
let staffAdmin: StaffAdmin | null = null;

export function getIdentity(): Identity {
  if (identity) return identity;
  if (!usingSupabase()) return (identity = createFileIdentity());
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!anon) throw new Error('SUPABASE_ANON_KEY must be set for staff sign-in emails');
  return (identity = createSupabaseIdentity(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, anon, siteUrl));
}

export function getStaffAdmin(): StaffAdmin {
  if (!staffAdmin) staffAdmin = createStaffAdmin({ repo: getCrmRepo(), store: getAuthStore(), identity: getIdentity(), customRoles: async () => (await loadRbac(getRecordStore())).customRoles.map((r) => r.key) });
  return staffAdmin;
}

/** Supabase Auth checks the password; we only take the user id and issue our own session cookie. */
export function getPasswordVerifier(): PasswordVerifier | null {
  if (!usingSupabase()) return fileVerifier(getAuthStore());
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return async (email, password) => {
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    await sb.auth.signOut().catch(() => undefined); // drop the Supabase session; ours is the cookie
    return data.user.id;
  };
}
