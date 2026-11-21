import { OfflineReader } from '@/components/kb/Offline';

export const metadata = { title: 'Knowledge (offline)', robots: { index: false } };

/** Static offline reader (no personal data in the HTML; the articles come from this phone's storage). */
export default function KbOfflinePage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-4 py-6">
      <h1 className="mb-3 font-display text-2xl text-heading">📚 Knowledge</h1>
      <OfflineReader />
    </main>
  );
}
