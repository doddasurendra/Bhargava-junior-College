'use client';
import type { AppState } from '@/app/app/portal-actions';
import { ActionForm, Submit } from '@/components/crm/forms';

export function UploadForm({ action, docKey }: { action: (s: AppState, fd: FormData) => Promise<AppState>; docKey: string }) {
  return (
    <ActionForm action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="key" value={docKey} />
      <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="min-w-0 flex-1 text-xs" aria-label="Choose file" />
      <Submit className="btn-outline py-1 text-xs">Upload</Submit>
    </ActionForm>
  );
}
