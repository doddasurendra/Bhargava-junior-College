import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/openbook/Reader';
import { getBook, notesOf, openBook, readingHistory } from '@/lib/openbook/library';
import { obStudent } from '@/lib/openbook/session';
import { EXAM_BY_ID } from '@/lib/openbook/taxonomy';
import { FavouriteButton } from './Favourite';
import { KindBadge } from '../../ui';

export const dynamic = 'force-dynamic';

const LICENCE: Record<string, string> = { public_domain: 'Public domain', open_licence: 'Open licence', free_official: 'Free official resource', institution_owned: 'Owned by Bhargava Junior College', copyrighted: 'Copyrighted: details and the publisher’s links only' };

export default async function BookPage({ params, searchParams }: { params: { id: string }; searchParams: { page?: string } }) {
  const me = await obStudent();
  const b = await getBook(params.id);
  if (!b || b.status !== 'approved') notFound();
  const resume = b.fileKey ? await openBook(me.studentId, b.id) : 1;
  const [notes, history] = await Promise.all([notesOf(me.studentId, b.id), readingHistory(me.studentId)]);
  const fav = history.find((h) => h.bookId === b.id)?.favourite ?? false;
  const start = Number(searchParams.page ?? resume) || resume;
  return (
    <div className="space-y-4">
      <section className="card flex gap-3 p-3">
        {b.coverUrl && <img src={b.coverUrl} alt="" className="h-28 w-20 shrink-0 rounded object-cover" />}
        <div className="min-w-0 space-y-1 text-sm">
          <KindBadge kind={b.kind} />
          <h1 className="font-display text-lg text-heading">{b.title}</h1>
          <p className="text-muted">{b.authors.join(', ')}{b.publisher ? ` · ${b.publisher}` : ''}{b.edition ? ` · ${b.edition} edition` : ''}{b.year ? ` · ${b.year}` : ''}{b.isbn ? ` · ISBN ${b.isbn}` : ''}</p>
          <p className="text-xs text-muted">{b.examIds.map((e) => EXAM_BY_ID.get(e)?.name ?? e).join(', ')} · {b.subjects.join(', ')}{b.chapters.length ? ` · ${b.chapters.slice(0, 4).join(', ')}` : ''}</p>
          <p className="text-[11px] text-muted">Licence: {LICENCE[b.licence]}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <FavouriteButton bookId={b.id} initial={fav} />
            {b.previewUrl && <a href={b.previewUrl} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1 text-xs">Google preview</a>}
            {b.officialUrl && <a href={b.officialUrl} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1 text-xs">Official page</a>}
            {b.purchaseUrl && <a href={b.purchaseUrl} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1 text-xs">Buy / publisher</a>}
          </div>
        </div>
      </section>
      {b.description && <details className="card p-3 text-sm"><summary className="cursor-pointer font-semibold text-heading">About this book</summary><p className="mt-2 whitespace-pre-line text-muted">{b.description.replace(/<[^>]+>/g, '')}</p></details>}
      {b.fileKey ? (
        <Reader bookId={b.id} title={b.title} initialPage={start} examId={b.examIds[0] ?? me.defaultExam} notes={notes.map((n) => ({ id: n.id, page: n.page, text: n.text, color: n.color, note: n.note }))} canDownload={b.downloadAllowed} textReady={b.textStatus === 'extracted'} />
      ) : (
        <p className="card p-4 text-sm">This book can’t be stored in Open Book because of its licence. {b.previewUrl ? 'Use the Google preview above, ' : ''}{b.officialUrl ? 'open the official page, ' : ''}or borrow a physical copy from the college library.</p>
      )}
      <Link href="/app/openbook/library" className="block text-center text-xs underline">Back to the library</Link>
    </div>
  );
}
