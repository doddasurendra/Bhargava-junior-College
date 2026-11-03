import { z } from 'zod';
import type { Role } from '../crm/types';
import type { RecordStore } from '../records/types';
import { BLOCK_KEYS, BLOCKS, canEditBlock, defaultContent, type BlockKey, type Content } from './blocks';

/** Stored CMS blocks live in the record store, collection `cms`, one record per block key. Framework-free. */
export const CMS_COLLECTION = 'cms';
const HISTORY = 'cms_history';

interface Stored {
  value: unknown;
  updatedBy: string;
}

export class CmsError extends Error {}

/** Saved blocks over the sample defaults. A stored block that no longer validates falls back to the default (and is logged). */
export async function loadContent(store: RecordStore): Promise<Content> {
  const content = defaultContent();
  const rows = await store.list<Stored>(CMS_COLLECTION);
  for (const r of rows) {
    const key = r.id as BlockKey;
    if (!BLOCK_KEYS.includes(key)) continue;
    const parsed = BLOCKS[key].schema.safeParse(r.data.value);
    if (parsed.success) (content as Record<BlockKey, unknown>)[key] = parsed.data;
    else console.error(`[cms] stored block "${key}" is invalid; using the default`, parsed.error.issues[0]);
  }
  return content;
}

export function formatIssue(e: z.ZodError): string {
  const i = e.issues[0];
  if (!i) return 'Check the form.';
  const where = i.path.filter((p) => typeof p === 'string' || typeof p === 'number').map((p) => (typeof p === 'number' ? `#${p + 1}` : p)).join(' › ');
  return where ? `${where}: ${i.message}` : i.message;
}

export async function saveBlock(store: RecordStore, user: { id: string; roles: Role[] }, key: string, value: unknown) {
  if (!BLOCK_KEYS.includes(key as BlockKey)) throw new CmsError('Unknown content block.');
  const k = key as BlockKey;
  if (!canEditBlock(user.roles, k)) throw new CmsError('Your role cannot edit this content.');
  const parsed = BLOCKS[k].schema.safeParse(value);
  if (!parsed.success) throw new CmsError(formatIssue(parsed.error));
  const prev = await store.get<Stored>(CMS_COLLECTION, k);
  // keep the previous version so a bad edit can be rolled back (and for the audit trail)
  if (prev) await store.put(HISTORY, { k1: k, k2: prev.updatedAt, data: prev.data });
  await store.put<Stored>(CMS_COLLECTION, { id: k, k1: k, k2: null, data: { value: parsed.data, updatedBy: user.id } });
  return parsed.data;
}

export async function blockHistory(store: RecordStore, key: BlockKey, limit = 10) {
  const rows = await store.list<Stored>(HISTORY, { k1: key, limit });
  return rows.map((r) => ({ id: r.id, savedAt: r.k2 ?? r.createdAt, updatedBy: r.data.updatedBy }));
}

export async function restoreBlock(store: RecordStore, user: { id: string; roles: Role[] }, key: BlockKey, historyId: string) {
  const h = await store.get<Stored>(HISTORY, historyId);
  if (!h || h.k1 !== key) throw new CmsError('That version was not found.');
  return saveBlock(store, user, key, h.data.value);
}

export async function blockMeta(store: RecordStore) {
  const rows = await store.list<Stored>(CMS_COLLECTION);
  return new Map(rows.map((r) => [r.id, { updatedAt: r.updatedAt, updatedBy: r.data.updatedBy }]));
}
