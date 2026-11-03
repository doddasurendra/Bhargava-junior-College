import { z } from 'zod';
import type { Rec, RecFilter, RecordStore } from './types';

/**
 * A typed, validated view of one collection. Every write is parsed by the zod schema, so bad data from a
 * form or a hand-edited row never reaches the screens.
 */
export interface CollectionDef<S extends z.ZodTypeAny> {
  name: string;
  schema: S;
  k1?: (d: z.infer<S>) => string | null;
  k2?: (d: z.infer<S>) => string | null;
}

export function collection<S extends z.ZodTypeAny>(def: CollectionDef<S>) {
  type T = z.infer<S>;
  return {
    name: def.name,
    schema: def.schema,
    list: (store: RecordStore, f?: RecFilter) => store.list<T>(def.name, f),
    get: (store: RecordStore, id: string) => store.get<T>(def.name, id),
    async put(store: RecordStore, data: unknown, id?: string): Promise<Rec<T>> {
      const d = def.schema.parse(data) as T;
      return store.put<T>(def.name, { id, k1: def.k1?.(d) ?? null, k2: def.k2?.(d) ?? null, data: d });
    },
    remove: (store: RecordStore, id: string) => store.remove(def.name, id),
  };
}

export type Collection<T> = {
  name: string;
  list: (store: RecordStore, f?: RecFilter) => Promise<Rec<T>[]>;
  get: (store: RecordStore, id: string) => Promise<Rec<T> | null>;
  put: (store: RecordStore, data: unknown, id?: string) => Promise<Rec<T>>;
  remove: (store: RecordStore, id: string) => Promise<void>;
};
