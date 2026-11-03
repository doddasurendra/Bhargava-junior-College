import 'server-only';
import { usingSupabase } from '../crm/repo';
import { createFileRecordStore } from './fileStore';
import { createSupabaseRecordStore } from './supabaseStore';
import type { RecordStore } from './types';

let store: RecordStore | null = null;

export function getRecordStore(): RecordStore {
  if (!store) store = usingSupabase() ? createSupabaseRecordStore(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) : createFileRecordStore();
  return store;
}
