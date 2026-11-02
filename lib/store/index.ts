import 'server-only';
import { createFileStore } from './file';
import { createSupabaseStore } from './supabase';
import type { Store } from './types';

export * from './types';

let store: Store | null = null;

/** Supabase when configured; otherwise the local JSON store (development only). */
export function getStore(): Store {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) store = createSupabaseStore(url, key);
  else if (process.env.NODE_ENV === 'production') throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production');
  else store = createFileStore();
  return store;
}
