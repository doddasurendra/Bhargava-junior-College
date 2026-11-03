/**
 * A small document store for the modules that are mostly forms and lists — CMS content, settings,
 * academics (batches, timetable, attendance, tests, marks, doubts), mentoring, hostel, transport,
 * PTM, messages. Each record lives in a named collection with two indexed keys (k1, k2) for the
 * lookups the screens need (e.g. attendance: k1 = student id, k2 = date).
 *
 * Production: one `records` table in Supabase (RLS on, service role only). Local: the JSON file store.
 */
export interface Rec<T> {
  id: string;
  collection: string;
  k1: string | null;
  k2: string | null;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export interface RecFilter {
  k1?: string;
  k2?: string;
  /** k2 range, inclusive (ISO dates sort as text) */
  k2From?: string;
  k2To?: string;
  ids?: string[];
  limit?: number;
}

export interface RecordStore {
  list<T>(collection: string, f?: RecFilter): Promise<Rec<T>[]>;
  get<T>(collection: string, id: string): Promise<Rec<T> | null>;
  /** insert or replace */
  put<T>(collection: string, r: { id?: string; k1: string | null; k2: string | null; data: T }): Promise<Rec<T>>;
  remove(collection: string, id: string): Promise<void>;
}
