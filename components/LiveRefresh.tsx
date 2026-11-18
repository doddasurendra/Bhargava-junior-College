'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-renders the current server page every `seconds` while the tab is visible, and as soon as it becomes
 * visible again — so attendance a teacher just saved, or a result just published, appears without a reload.
 */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = window.setInterval(tick, seconds * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, seconds]);
  return null;
}
