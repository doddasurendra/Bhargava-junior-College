import { listBooks } from '@/lib/openbook/library';
import { pickerOptions } from '@/lib/openbook/options';
import { obStudent } from '@/lib/openbook/session';
import { CATEGORIES } from '@/lib/openbook/taxonomy';
import { BookTile, ComingSoon, H1, Pager } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function LibraryPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'library');
  const sp = searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const [res, opts] = await Promise.all([listBooks({ q: sp.q, category: sp.category, examId: sp.exam, subject: sp.subject, cls: sp.cls, kind: sp.kind, page }), pickerOptions()]);
  const cat = CATEGORIES.find((c) => c.id === sp.category);
  const exams = opts.exams.filter((e) => !sp.category || e.category === sp.category);
  const subjects = [...new Set(exams.flatMap((e) => e.subjects))];
  const qs = (patch: Record<string, string | number | undefined>) => '?' + new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
  const catReady = !cat || exams.some((e) => e.ready);
  return (
    <div className="space-y-4">
      <H1 sub={cat?.blurb ?? pg.sub}>{cat?.name ?? pg.title}</H1>
      <form className="card grid gap-2 p-3 sm:grid-cols-2" action="/app/openbook/library">
        {sp.category && <input type="hidden" name="category" value={sp.category} />}
        <input name="q" defaultValue={sp.q} className="input sm:col-span-2" placeholder="Title, author, subject, publisher, ISBN" aria-label="Search books" />
        <select name="exam" defaultValue={sp.exam ?? ''} className="input" aria-label="Examination"><option value="">All examinations</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}{e.ready ? '' : ' (coming soon)'}</option>)}</select>
        <select name="subject" defaultValue={sp.subject ?? ''} className="input" aria-label="Subject"><option value="">All subjects</option>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="cls" defaultValue={sp.cls ?? ''} className="input" aria-label="Year"><option value="">Inter 1st & 2nd year</option><option value="11">Inter 1st year (Class 11)</option><option value="12">Inter 2nd year (Class 12)</option></select>
        <select name="kind" defaultValue={sp.kind ?? ''} className="input" aria-label="Type"><option value="">Official, BJC and reference</option><option value="official">Official only</option><option value="institution">BJC material</option><option value="reference">Reference books</option></select>
        <button className="btn-primary py-2 sm:col-span-2">Search</button>
      </form>
      {!catReady ? <ComingSoon what={cat!.name} /> : res.total === 0 ? <p className="card p-4 text-sm text-muted">No books match. Try fewer filters{sp.q ? ' or different words' : ''}.</p> : (
        <>
          <p className="text-xs text-muted">{res.total} book{res.total === 1 ? '' : 's'}. Official books first. Copyrighted reference books show details and the publisher’s preview or purchase link only.</p>
          <div className="grid grid-cols-2 gap-2">{res.items.map((b) => <BookTile key={b.id} b={b} />)}</div>
          <Pager page={res.page} pages={res.pages} href={(p) => `/app/openbook/library${qs({ page: p })}`} />
        </>
      )}
    </div>
  );
}
