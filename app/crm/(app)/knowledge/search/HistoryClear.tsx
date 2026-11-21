'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Deletes the signed-in person's own AI conversation history (§17). */
export function HistoryClear({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/kb/history', { method: 'DELETE' });
        setBusy(false);
        router.refresh();
      }}
      className="text-xs text-maroon underline dark:text-gold"
    >
      {busy ? '…' : label}
    </button>
  );
}
