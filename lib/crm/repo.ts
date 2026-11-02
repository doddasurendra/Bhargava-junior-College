import 'server-only';
import { createFileCrmRepo } from './fileRepo';
import { createSupabaseCrmRepo } from './supabaseRepo';
import type { CrmRepo } from './types';

let repo: CrmRepo | null = null;

export const usingSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getCrmRepo(): CrmRepo {
  if (repo) return repo;
  if (usingSupabase()) repo = createSupabaseCrmRepo(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  else if (process.env.NODE_ENV === 'production') throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production');
  else repo = createFileCrmRepo();
  return repo;
}
