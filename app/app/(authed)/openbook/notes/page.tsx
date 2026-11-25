import Link from 'next/link';
import { getBook, notesOf } from '@/lib/openbook/library';
import { obStudent } from '@/lib/openbook/session';
import { RemoveButton } from './Remove';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BG: Record<string, string> = { yellow: '#fde68a66', green: '#bbf7d066', blue: '#bfdbfe66', pink: '#fbcfe866' };

export default async function NotesPage({ searchParams }: { searchParams: { print?: string } }) {
  const me = await obStudent();
  const notes = await notesOf(me.studentId);
  const titles = new Map<string, string>();
  for (const id of new Set(notes.map((n) => n.bookId))) titles.set(id, (await getBook(id))?.title ?? 'Book');
  const print = searchParams.print === '1';
  return (
    <div className="space-y-4">
      <H1 sub="Private to you. Highlights, notes and your revision list from every book.">My Notes</H1>
      {!print && <div className="flex gap-2 print:hidden"><a href="/api/openbook/notes" className="btn-outline px-3 py-1.5 text-sm">Export Markdown</a><Link href="/app/openbook/notes?print=1" className="btn-outline px-3 py-1.5 text-sm">Export PDF (print view)</Link></div>}
      {print && <p className="text-xs text-muted print:hidden">Use your browser’s Print → Save as PDF.</p>}
      {notes.length === 0 && <p className="card p-4 text-sm text-muted">No notes yet. Select text in the reader to highlight it or add a note.</p>}
      {[...titles.entries()].map(([bookId, title]) => (
        <section key={bookId} className="card space-y-2 p-4">
          <h2 className="font-semibold text-heading"><Link href={`/app/openbook/book/${bookId}`} className="underline">{title}</Link></h2>
          <ul className="space-y-1.5 text-sm">
            {notes.filter((n) => n.bookId === bookId).map((n) => (
              <li key={n.id} className="rounded p-2" style={{ background: n.color ? BG[n.color] : undefined }}>
                <Link href={`/app/openbook/book/${bookId}?page=${n.page}`} className="text-[11px] font-semibold underline">p. {n.page}</Link>{n.revision && <span className="ml-2 rounded bg-navy/10 px-1 text-[10px]">revision</span>}
                {n.text && <p>“{n.text}”</p>}
                {n.note && <p className="text-xs">✎ {n.note}</p>}
                {!print && <RemoveButton id={n.id} kind="note" />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
