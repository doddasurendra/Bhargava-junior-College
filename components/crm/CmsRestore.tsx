'use client';
import { restoreCmsAction } from '@/app/crm/cms-actions';
import { ActionForm, Submit } from './forms';

export function RestoreVersionForm({ blockKey, historyId }: { blockKey: string; historyId: string }) {
  return (
    <ActionForm action={restoreCmsAction} reset={false} className="flex items-center gap-2">
      <input type="hidden" name="key" value={blockKey} />
      <input type="hidden" name="historyId" value={historyId} />
      <Submit className="text-xs font-semibold text-maroon underline dark:text-gold">Restore this version</Submit>
    </ActionForm>
  );
}
