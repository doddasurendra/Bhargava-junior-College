import 'server-only';
import { createFileCrmRepo } from './fileRepo';
import { createSupabaseCrmRepo } from './supabaseRepo';
import type { CrmRepo } from './types';

let repo: CrmRepo | null = null;

export const usingSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * The local JSON store is for development. A production build may use it only for local testing on a developer's
 * machine (`npm run start:local` sets LOCAL_FILE_STORE=1), never on Vercel.
 */
export const fileStoreAllowed = () => process.env.NODE_ENV !== 'production' || (process.env.LOCAL_FILE_STORE === '1' && !process.env.VERCEL);

export function getCrmRepo(): CrmRepo {
  if (repo) return repo;
  if (usingSupabase()) repo = createSupabaseCrmRepo(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  else if (!fileStoreAllowed()) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production');
  else repo = createFileCrmRepo();
  return repo;
}
