'use server';
import { revalidatePath } from 'next/cache';
import { invalidateContent } from '@/lib/cms';
import { BLOCK_KEYS, type BlockKey } from '@/lib/cms/blocks';
import { CmsError, restoreBlock, saveBlock } from '@/lib/cms/store';
import { syncMasters } from '@/lib/cms/sync';
import { requireStaff } from '@/lib/crm/auth';
import { getRecordStore } from '@/lib/records';
import type { ActionState } from './actions';

function publish(key: string) {
  invalidateContent();
  // every public page may show CMS content
  revalidatePath('/', 'layout');
  revalidatePath(`/crm/cms/${key}`);
}

export async function saveCmsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const key = String(fd.get('key') ?? '');
  let value: unknown;
  try {
    value = JSON.parse(String(fd.get('value') ?? ''));
  } catch {
    return { error: 'The form could not be read. Reload the page and try again.' };
  }
  try {
    const saved = await saveBlock(getRecordStore(), { id: user.id, roles: user.roles }, key, value);
    await syncMasters(key, saved);
    publish(key);
    return { ok: true, message: 'Saved and published.' };
  } catch (e) {
    if (e instanceof CmsError) return { error: e.message };
    console.error('[cms] save failed', (e as Error).message);
    return { error: 'Saved, but syncing it to the booking tables failed. Try saving again.' };
  }
}

export async function restoreCmsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const key = String(fd.get('key') ?? '') as BlockKey;
  if (!BLOCK_KEYS.includes(key)) return { error: 'Unknown content block.' };
  try {
    const saved = await restoreBlock(getRecordStore(), { id: user.id, roles: user.roles }, key, String(fd.get('historyId') ?? ''));
    await syncMasters(key, saved);
    publish(key);
    return { ok: true, message: 'Restored. Reload to see it in the editor.' };
  } catch (e) {
    if (e instanceof CmsError) return { error: e.message };
    throw e;
  }
}
