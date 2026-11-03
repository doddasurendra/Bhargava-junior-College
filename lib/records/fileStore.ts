import { randomUUID } from 'node:crypto';
import { tx } from '../store/file';
import type { Rec, RecFilter, RecordStore } from './types';

function matches(r: Rec<unknown>, f: RecFilter) {
  if (f.k1 !== undefined && r.k1 !== f.k1) return false;
  if (f.k2 !== undefined && r.k2 !== f.k2) return false;
  if (f.k2From !== undefined && (r.k2 ?? '') < f.k2From) return false;
  if (f.k2To !== undefined && (r.k2 ?? '') > f.k2To) return false;
  if (f.ids && !f.ids.includes(r.id)) return false;
  return true;
}

export function createFileRecordStore(): RecordStore {
  return {
    list: <T,>(collection: string, f: RecFilter = {}) =>
      tx((db) => {
        const all = (db.records[collection] ?? []).filter((r) => matches(r, f)) as Rec<T>[];
        // newest first, like the Supabase implementation
        all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
        return f.limit ? all.slice(0, f.limit) : all;
      }, false),

    get: <T,>(collection: string, id: string) => tx((db) => ((db.records[collection] ?? []).find((r) => r.id === id) as Rec<T>) ?? null, false),

    put: <T,>(collection: string, r: { id?: string; k1: string | null; k2: string | null; data: T }) =>
      tx((db) => {
        const list = (db.records[collection] ??= []);
        const now = new Date().toISOString();
        const id = r.id ?? randomUUID();
        const i = list.findIndex((x) => x.id === id);
        const rec: Rec<T> = { id, collection, k1: r.k1, k2: r.k2, data: r.data, createdAt: i >= 0 ? list[i].createdAt : now, updatedAt: now };
        if (i >= 0) list[i] = rec;
        else list.push(rec);
        return rec;
      }),

    remove: (collection, id) =>
      tx((db) => {
        db.records[collection] = (db.records[collection] ?? []).filter((r) => r.id !== id);
      }),
  };
}
