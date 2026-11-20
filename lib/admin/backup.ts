import 'server-only';
import { getAuthStore } from '../auth/store';
import { can } from '../crm/permissions';
import { getCrmRepo, usingSupabase } from '../crm/repo';
import type { Staff } from '../crm/types';
import { getRecordStore } from '../records';
import * as C from '../records/collections';

/** Every record collection (anything exported from collections.ts with a name and a list()). */
type Listable = { name: string; list: (s: ReturnType<typeof getRecordStore>) => Promise<unknown[]> };
export function recordCollections(): Listable[] {
  return (Object.values(C) as unknown[]).filter((v): v is Listable =>
    !!v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string' && typeof (v as { list?: unknown }).list === 'function');
}

/** Row counts per collection, for the backup panel and the developer dashboard. */
export async function backupSummary(user: Staff) {
  if (!can(user, 'security.view')) throw new Error('No permission.');
  const store = getRecordStore();
  const rows = await Promise.all(recordCollections().map(async (c) => ({ name: c.name, count: (await c.list(store)).length })));
  return { backend: usingSupabase() ? 'supabase' : 'local-file', collections: rows.sort((a, b) => a.name.localeCompare(b.name)), total: rows.reduce((n, r) => n + r.count, 0) };
}

/** A full JSON snapshot of the record collections and staff list. Super Admin only; every download is logged. */
export async function buildBackup(user: Staff, ctx: { ip: string | null; userAgent: string | null }) {
  if (!can(user, 'security.manage')) return null;
  const store = getRecordStore();
  const collections: Record<string, unknown[]> = {};
  for (const c of recordCollections()) collections[c.name] = await c.list(store);
  const staff = await getCrmRepo().listStaff();
  await getAuthStore().logEvent({ staffId: user.id, actorId: user.id, email: user.email, success: true, method: 'admin', reason: 'backup_download', ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null });
  return { version: 1, takenAt: new Date().toISOString(), takenBy: user.id, backend: usingSupabase() ? 'supabase' : 'local-file', staff, collections };
}
