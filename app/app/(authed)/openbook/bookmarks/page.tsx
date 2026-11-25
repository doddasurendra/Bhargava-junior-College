import Link from 'next/link';
import { bookmarksOf, getBook, readingHistory } from '@/lib/openbook/library';
import { obStudent } from '@/lib/openbook/session';
import { RemoveButton } from '../notes/Remove';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function BookmarksPage() {
  const me = await obStudent();
  const [marks, history] = await Promise.all([bookmarksOf(me.studentId), readingHistory(me.studentId)]);
  const titles = new Map<string, string>();
  for (const id of new Set(marks.map((m) => m.bookId))) titles.set(id, (await getBook(id))?.title ?? 'Book');
  const favs = history.filter((h) => h.favourite);
  return (
    <div className="space-y-4">
      <H1 sub="Bookmarked pages, favourite books and your reading history.">My Bookmarks</H1>
      <section className="card p-4"><h2 className="mb-2 text-sm font-semibold text-heading">Bookmarked pages</h2>{marks.length ? <ul className="space-y-1 text-sm">{marks.map((m) => <li key={m.id} className="flex items-center justify-between gap-2"><Link className="underline" href={`/app/openbook/book/${m.bookId}?page=${m.page}`}>{titles.get(m.bookId)} · p. {m.page}{m.label ? ` · ${m.label}` : ''}</Link><RemoveButton id={m.id} kind="bookmark" /></li>)}</ul> : <p className="text-sm text-muted">Use 🔖 in the reader to bookmark a page.</p>}</section>
      <section className="card p-4"><h2 className="mb-2 text-sm font-semibold text-heading">Favourite books</h2>{favs.length ? <ul className="space-y-1 text-sm">{favs.map((h) => <li key={h.id}><Link className="underline" href={`/app/openbook/book/${h.bookId}`}>{h.book?.title}</Link></li>)}</ul> : <p className="text-sm text-muted">None yet.</p>}</section>
      <section className="card p-4"><h2 className="mb-2 text-sm font-semibold text-heading">Reading history</h2>{history.length ? <ul className="space-y-1 text-sm">{history.map((h) => <li key={h.id}><Link className="underline" href={`/app/openbook/book/${h.bookId}`}>{h.book?.title}</Link> <span className="text-xs text-muted">· last page {h.lastPage} · {h.pagesRead.length} pages · {Math.round(h.seconds / 60)} min · {h.lastOpened.slice(0, 10)}</span></li>)}</ul> : <p className="text-sm text-muted">Books you open appear here.</p>}</section>
    </div>
  );
}
