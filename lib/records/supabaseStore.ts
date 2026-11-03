import { createClient } from '@supabase/supabase-js';
import type { Rec, RecFilter, RecordStore } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toRec = <T,>(r: Row): Rec<T> => ({ id: r.id, collection: r.collection, k1: r.k1, k2: r.k2, data: r.data as T, createdAt: r.created_at, updatedAt: r.updated_at });

/** Server-only, service role; `records` has RLS on and no policies. */
export function createSupabaseRecordStore(url: string, serviceKey: string): RecordStore {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async list<T>(collection: string, f: RecFilter = {}) {
      let q = sb.from('records').select('*').eq('collection', collection).order('created_at', { ascending: false });
      if (f.k1 !== undefined) q = q.eq('k1', f.k1);
      if (f.k2 !== undefined) q = q.eq('k2', f.k2);
      if (f.k2From !== undefined) q = q.gte('k2', f.k2From);
      if (f.k2To !== undefined) q = q.lte('k2', f.k2To);
      if (f.ids) q = q.in('id', f.ids.length ? f.ids : ['00000000-0000-0000-0000-000000000000']);
      q = q.limit(f.limit ?? 5000);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => toRec<T>(r));
    },
    async get<T>(collection: string, id: string) {
      const { data, error } = await sb.from('records').select('*').eq('collection', collection).eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toRec<T>(data) : null;
    },
    async put<T>(collection: string, r: { id?: string; k1: string | null; k2: string | null; data: T }) {
      const row: Row = { collection, k1: r.k1, k2: r.k2, data: r.data, updated_at: new Date().toISOString() };
      if (r.id) row.id = r.id;
      const { data, error } = await sb.from('records').upsert(row, { onConflict: 'collection,id' }).select('*').single();
      if (error) throw new Error(error.message);
      return toRec<T>(data as Row);
    },
    async remove(collection, id) {
      const { error } = await sb.from('records').delete().eq('collection', collection).eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}
