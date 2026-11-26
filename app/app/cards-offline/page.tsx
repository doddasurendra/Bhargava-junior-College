import { OfflineCardReview } from '@/components/openbook/OfflineCards';

export const metadata = { title: 'Flashcards (offline)', robots: { index: false } };

/** Static offline reviewer (no personal data in the HTML; the cards come from this phone's storage). */
export default function CardsOfflinePage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-4 py-6">
      <h1 className="mb-3 font-display text-2xl text-heading">🃏 Flashcards</h1>
      <OfflineCardReview />
      <a href="/app/openbook/flashcards" className="mt-6 block text-center text-xs underline">Back to Open Book (needs a connection)</a>
    </main>
  );
}
