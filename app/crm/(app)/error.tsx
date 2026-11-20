'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Staff portal error screen: shown instead of the browser-level "Application error" crash. */
export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[crm] page error', error.digest ?? error.message);
  }, [error]);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-display text-3xl text-heading">This page could not be shown</h1>
      <div className="card space-y-2 p-4 text-sm">
        <p>Either this page is not part of your role, or something went wrong while loading it. Nothing was changed.</p>
        {error.digest && <p className="text-xs text-muted">Reference for the developer: {error.digest}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={reset} className="btn-outline text-xs">Try again</button>
          <Link href="/crm" className="btn-outline text-xs">Back to my dashboard</Link>
        </div>
      </div>
    </div>
  );
}
