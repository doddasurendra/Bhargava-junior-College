import { addBookAction, issueBookAction, returnBookAction } from '@/app/crm/backoffice-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { LOAN_DAYS, libraryOverview } from '@/lib/school/backoffice';

export const metadata = { title: 'Library' };
export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const user = await requireStaff();
  if (!can(user, 'library.manage') && !can(user, 'students.view')) return <Panel title="Library"><p className="text-sm text-muted">Your role doesn’t use the library module.</p></Panel>;
  const { books, out, students } = await libraryOverview(user);
  const manage = can(user, 'library.manage');
  const late = out.filter((l) => l.late > 0);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Library</h1>
          <p className="text-sm text-muted">{books.length} titles · {out.length} on loan · {late.length} overdue · loans are for {LOAN_DAYS} days</p>
        </div>
        <a href="/crm/exports/library" className="btn-outline py-1.5 text-sm">Export loans (Excel)</a>
      </div>

      {manage && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Add a book">
            <QuickForm action={addBookAction} submit="Add book" fields={[
              { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
              { name: 'author', label: 'Author', type: 'text' },
              { name: 'subject', label: 'Subject', type: 'text' },
              { name: 'isbn', label: 'ISBN', type: 'text' },
              { name: 'shelf', label: 'Shelf', type: 'text' },
              { name: 'copies', label: 'Copies', type: 'number', min: 1, max: 500, defaultValue: '1', required: true },
            ]} />
          </Panel>
          <Panel title="Issue a book">
            {books.length === 0 || students.length === 0 ? <Empty>Add a book first; students appear once admitted.</Empty> : (
              <QuickForm action={issueBookAction} submit="Issue" cols={1} fields={[
                { name: 'bookId', label: 'Book', type: 'select', required: true, options: books.filter((b) => b.available > 0).map((b) => ({ value: b.id, label: `${b.title} (${b.available} left)` })) },
                { name: 'studentId', label: 'Student', type: 'select', required: true, options: students.map((s) => ({ value: s.id, label: `${s.fullName} · ${s.collegeId ?? ''}` })) },
              ]} />
            )}
          </Panel>
        </div>
      )}

      <Panel title={`On loan (${out.length})`}>
        {out.length === 0 ? <Empty>No books are out.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {out.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span><span className="font-medium text-heading">{l.book}</span> · {l.student?.fullName ?? 'Unknown student'} <span className="font-mono text-xs text-muted">{l.student?.collegeId}</span></span>
                <span className="flex items-center gap-3">
                  <span className={l.late > 0 ? 'font-semibold text-maroon dark:text-red-300' : 'text-muted'}>{l.late > 0 ? `${l.late} days overdue` : `due ${formatDate(l.dueOn, { day: 'numeric', month: 'short' })}`}</span>
                  {manage && <QuickForm action={returnBookAction} submit="Mark returned" cols={1} fields={[{ name: 'loanId', type: 'hidden', value: l.id }]} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Catalogue (${books.length})`}>
        {books.length === 0 ? <Empty>No books yet.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Title</th><th>Author</th><th>Subject</th><th>Shelf</th><th className="text-right">Available</th></tr></thead>
            <tbody>{books.map((b) => <tr key={b.id} className="border-t border-line"><td className="py-1.5 text-heading">{b.title}</td><td>{b.author}</td><td>{b.subject}</td><td>{b.shelf}</td><td className="text-right font-mono">{b.available}/{b.copies}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
