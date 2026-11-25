import Link from 'next/link';
import * as A from '@/app/crm/openbook-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { BigFileInput } from '@/components/openbook/BigFileInput';
import { Field, ObForm } from '@/components/openbook/client';
import { requireStaff } from '@/lib/crm/auth';
import { batchPerformance, monitoring } from '@/lib/openbook/analytics';
import { listThreads, moderationQueue, thread } from '@/lib/openbook/community';
import { canManage, canTeach, settings } from '@/lib/openbook/core';
import { pendingDecks } from '@/lib/openbook/flashcards';
import { listBooks } from '@/lib/openbook/library';
import { aiConfigured } from '@/lib/openbook/llm';
import { listPapers, paperQuestions } from '@/lib/openbook/papers';
import { pathOf } from '@/lib/openbook/path';
import { pendingBank } from '@/lib/openbook/questions';
import { listSources } from '@/lib/openbook/sources';
import { assignmentsFor, myBatches } from '@/lib/openbook/teacher';
import { CATEGORIES, EXAMS, QTYPES } from '@/lib/openbook/taxonomy';
import { vectorsConfigured } from '@/lib/openbook/vectors';
import { studentsById } from '@/lib/school/common';

export const metadata = { title: 'Open Book' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TABS = [['overview', 'Overview'], ['books', 'Books'], ['papers', 'Papers'], ['bank', 'Question bank'], ['sources', 'Official sources'], ['teach', 'Teaching'], ['community', 'Community'], ['settings', 'AI settings']] as const;
const exOpts = EXAMS.map((e) => ({ value: e.id, label: e.name }));
const ExamChecks = () => <fieldset className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded border border-line p-2 text-xs">{EXAMS.map((e) => <label key={e.id} className="flex gap-1"><input type="checkbox" name="examIds" value={e.id} />{e.name}</label>)}</fieldset>;

export default async function OpenBookAdmin({ searchParams }: { searchParams: { tab?: string; batch?: string; student?: string; paper?: string } }) {
  const u = await requireStaff();
  if (!canTeach(u)) return <Panel title="Open Book"><p className="text-sm text-muted">Your role doesn’t manage Open Book. Students use it from the Student & Parent app.</p></Panel>;
  const tab = searchParams.tab ?? 'overview';
  const manager = canManage(u);
  return (
    <div className="max-w-6xl space-y-5">
      <div><h1 className="font-display text-3xl text-heading">Open Book</h1><p className="text-sm text-muted">AI digital library and exam preparation · content, approvals, teaching tools, moderation and AI settings.</p></div>
      <nav className="flex flex-wrap gap-1.5">{TABS.map(([k, l]) => <Link key={k} href={`/crm/openbook?tab=${k}`} className={k === tab ? 'chip chip-active' : 'chip'}>{l}</Link>)}</nav>
      {tab === 'overview' && <Overview />}
      {tab === 'books' && <Books manager={manager} />}
      {tab === 'papers' && <Papers paperId={searchParams.paper} />}
      {tab === 'bank' && <Bank manager={manager} />}
      {tab === 'sources' && <Sources manager={manager} />}
      {tab === 'teach' && <Teach batchId={searchParams.batch} studentId={searchParams.student} />}
      {tab === 'community' && <Community />}
      {tab === 'settings' && <Settings manager={manager} />}
    </div>
  );

  async function Overview() {
    const m = await monitoring(u);
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Questions in Open Book" value={m.questions.total} />
          <Stat label="AI-generated (students)" value={m.questions.generated} />
          <Stat label="From past papers" value={m.questions.extracted} />
          <Stat label="Waiting for approval" value={m.questions.pendingBank} tone={m.questions.pendingBank ? 'warn' : 'default'} href="/crm/openbook?tab=bank" />
          <Stat label="Duplicates rejected" value={m.rejections.total} />
          <Stat label="Students using AI (7 days)" value={m.activeUsers} />
          <Stat label="AI service" value={aiConfigured() ? 'On' : 'Not configured'} tone={aiConfigured() ? 'good' : 'alert'} />
          <Stat label="Semantic duplicate check" value={vectorsConfigured() ? 'pgvector on' : 'Lexical only'} tone={vectorsConfigured() ? 'good' : 'warn'} />
        </div>
        <Panel title="AI usage, last 7 days">{Object.keys(m.usage).length ? <p className="text-sm">{Object.entries(m.usage).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p> : <Empty>No AI usage yet.</Empty>}</Panel>
        <Panel title="Duplicate detection review (latest rejections)">{m.rejections.recent.length ? <ul className="space-y-1 text-sm">{m.rejections.recent.map((r) => <li key={r.id}><span className="font-mono text-xs">{r.reason} · {Math.round(r.score * 100)}% · {r.method}</span> · {r.stem.slice(0, 160)}</li>)}</ul> : <Empty>No rejected questions yet.</Empty>}</Panel>
        <Panel title="Activity log">{m.audit.length ? <ul className="space-y-0.5 text-xs">{m.audit.map((a, i) => <li key={i}><span className="text-muted">{a.at.slice(0, 16).replace('T', ' ')}</span> · {a.actor.name || a.actor.kind} · {a.action} · {a.note ?? a.target}</li>)}</ul> : <Empty>Nothing yet.</Empty>}</Panel>
      </>
    );
  }

  async function Books({ manager }: { manager: boolean }) {
    const [pending, all] = await Promise.all([listBooks({ status: 'pending', size: 60 }), listBooks({ status: 'all', size: 60 })]);
    return (
      <>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Upload a book (institution-owned or open licence)">
            <ObForm action={A.uploadBookAction as never} submit="Upload and extract text">
              <BigFileInput name="file" accept=".pdf,.docx" label="PDF or Word file" required />
              <Field label="Title"><input name="title" required className="input w-full" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Authors (comma separated)"><input name="authors" className="input w-full" /></Field>
                <Field label="Publisher"><input name="publisher" className="input w-full" /></Field>
                <Field label="Edition"><input name="edition" className="input w-full" /></Field>
                <Field label="Year"><input name="year" className="input w-full" /></Field>
                <Field label="ISBN"><input name="isbn" className="input w-full" /></Field>
                <Field label="Category"><select name="category" className="input w-full">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.short}</option>)}</select></Field>
                <Field label="Subjects (comma)"><input name="subjects" className="input w-full" placeholder="Physics" /></Field>
                <Field label="Year (Inter)"><select name="cls" className="input w-full"><option value="na">—</option><option value="11">1st year</option><option value="12">2nd year</option><option value="both">Both</option></select></Field>
                <Field label="Type"><select name="kind" className="input w-full"><option value="institution">BJC material</option><option value="official">Official (NCERT, board…)</option><option value="reference">Reference</option></select></Field>
                <Field label="Licence"><select name="licence" className="input w-full"><option value="institution_owned">Owned by the college</option><option value="open_licence">Open licence (CC etc.)</option><option value="free_official">Free official resource (terms allow)</option><option value="public_domain">Public domain</option></select></Field>
              </div>
              <Field label="Chapters (comma, optional)"><input name="chapters" className="input w-full" /></Field>
              <Field label="Official page (optional)"><input name="officialUrl" type="url" className="input w-full" /></Field>
              <ExamChecks />
              <label className="flex gap-2 text-sm"><input type="checkbox" name="downloadAllowed" /> Students may download it (licence allows)</label>
            </ObForm>
            {!manager && <p className="mt-2 text-xs text-muted">Teacher uploads wait for an administrator’s approval.</p>}
          </Panel>
          {manager && <Panel title="Import from Google Books (metadata, cover, preview, purchase link)">
            <ObForm action={A.googleImportAction as never} submit="Search Google Books and import">
              <Field label="Search"><input name="query" required className="input w-full" placeholder="NCERT Physics Class 11" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Category"><select name="category" className="input w-full">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.short}</option>)}</select></Field>
                <Field label="Subjects (comma)"><input name="subjects" className="input w-full" /></Field>
                <Field label="Year (Inter)"><select name="cls" className="input w-full"><option value="na">—</option><option value="11">1st year</option><option value="12">2nd year</option><option value="both">Both</option></select></Field>
              </div>
              <ExamChecks />
              <p className="text-xs text-muted">Copyrighted books are stored as metadata with Google’s preview and the purchase link only; a book is downloadable only if Google marks it public domain with a free PDF/EPUB.</p>
            </ObForm>
          </Panel>}
        </div>
        <Panel title={`Waiting for approval (${pending.total})`}>{pending.items.length ? <ul className="divide-y divide-line text-sm">{pending.items.map((b) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{b.title} <span className="text-xs text-muted">· {b.licence} · by {b.uploadedBy.name}</span></span>{manager && <span className="flex gap-1"><ActionButton action={A.reviewBookAction} label="Approve" hidden={{ id: b.id, decision: 'approve' }} /><ActionButton action={A.reviewBookAction} label="Reject" hidden={{ id: b.id, decision: 'reject' }} /></span>}</li>)}</ul> : <Empty>Nothing waiting.</Empty>}</Panel>
        <Panel title={`All books (${all.total})`}>{all.items.length ? <ul className="divide-y divide-line text-sm">{all.items.map((b) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{b.title}</b> <span className="text-xs text-muted">· {b.kind} · {b.licence} · {b.source} · {b.status}{b.fileKey ? ` · ${b.pages} pages, text ${b.textStatus}` : ''}</span></span>{manager && b.status !== 'rejected' && <ActionButton action={A.removeBookAction} label="Remove" hidden={{ id: b.id, reason: 'Removed by an administrator' }} />}</li>)}</ul> : <Empty>No books yet.</Empty>}</Panel>
      </>
    );
  }

  async function Papers({ paperId }: { paperId?: string }) {
    const [pending, approved] = await Promise.all([listPapers({ status: 'pending' }), listPapers({})]);
    const open = paperId ? [...pending, ...approved].find((p) => p.id === paperId) : null;
    const qs = open ? await paperQuestions(open.id) : [];
    return (
      <>
        <Panel title="Upload a previous-year paper">
          <ObForm action={A.staffUploadPaperAction as never} submit="Upload and extract questions">
            <BigFileInput name="file" accept=".pdf,.docx,image/jpeg,image/png" label="Paper (PDF, Word, JPG/PNG, scans, handwritten)" required maxMb={25} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Title"><input name="title" required className="input w-full" /></Field>
              <Field label="Examination"><select name="examId" className="input w-full">{exOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
              <Field label="Subject"><input name="subject" required className="input w-full" defaultValue="Physics" /></Field>
              <Field label="Year"><input name="year" type="number" required className="input w-full" /></Field>
              <Field label="Session"><input name="session" className="input w-full" /></Field>
              <Field label="Board / body"><input name="board" className="input w-full" /></Field>
              <Field label="Type"><select name="paperType" className="input w-full"><option value="official">Official</option><option value="board">Board</option><option value="model">Model</option><option value="mock">Mock</option><option value="handwritten">Handwritten</option></select></Field>
              <Field label="Licence"><select name="licence" className="input w-full"><option value="official_public">Official, publicly released</option><option value="institution_owned">College-owned</option></select></Field>
              <Field label="Topics (comma)"><input name="topics" className="input w-full" /></Field>
            </div>
            <Field label="Answer key (1-B, 2-C, 3-4.5 …)"><textarea name="answerKey" rows={2} className="input w-full" /></Field>
            <BigFileInput name="solution" accept=".pdf,image/jpeg,image/png" label="Solutions (optional)" maxMb={25} />
          </ObForm>
        </Panel>
        <Panel title={`Student uploads waiting for review (${pending.length})`}>{pending.length ? <ul className="divide-y divide-line text-sm">{pending.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link className="underline" href={`/crm/openbook?tab=papers&paper=${p.id}`}>{p.title} · {p.year}</Link><span className="text-xs text-muted">{p.extraction.status} · {p.extraction.count} questions · {p.uploadedBy.name}</span><span className="flex gap-1"><ActionButton action={A.reviewPaperAction} label="Approve" hidden={{ id: p.id, decision: 'approve' }} /><ActionButton action={A.reviewPaperAction} label="Reject" hidden={{ id: p.id, decision: 'reject' }} /></span></li>)}</ul> : <Empty>Nothing waiting.</Empty>}</Panel>
        <Panel title={`Approved papers (${approved.length})`}>{approved.length ? <ul className="divide-y divide-line text-sm">{approved.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link className="underline" href={`/crm/openbook?tab=papers&paper=${p.id}`}>{p.title} · {p.subject} · {p.year}</Link><span className="text-xs text-muted">{p.extraction.status}{p.extraction.method ? ` (${p.extraction.method})` : ''} · {p.extraction.count} questions</span><span className="flex gap-1"><ActionButton action={A.reextractAction} label="Re-run extraction" hidden={{ id: p.id }} /><ActionButton action={A.reviewPaperAction} label="Remove" hidden={{ id: p.id, decision: 'reject', note: 'Removed by staff' }} /></span></li>)}</ul> : <Empty>No papers yet.</Empty>}</Panel>
        {open && <Panel title={`Extracted questions · ${open.title}`}>
          <p className="mb-2 text-xs text-muted"><a className="underline" href={`/api/openbook/file?k=paper&id=${open.id}`} target="_blank" rel="noopener noreferrer">Open the original</a> · fix OCR or tagging mistakes below.</p>
          {qs.length ? <ul className="space-y-3">{qs.map((q) => <li key={q.id} className="rounded-lg border border-line p-3"><QuickForm action={A.editExtractedAction} submit="Save" cols={2} reset={false} fields={[{ name: 'id', type: 'hidden', value: q.id }, { name: 'stem', label: `Q${q.qno ?? ''} text`, type: 'textarea', defaultValue: q.stem, rows: 3, wide: true }, { name: 'options', label: 'Options (one per line)', type: 'textarea', defaultValue: q.options.join('\n'), rows: 4 }, { name: 'answer', label: 'Answer (option index 0–3 or value)', type: 'text', defaultValue: q.answer[0] ?? '' }, { name: 'chapter', label: 'Chapter', type: 'text', defaultValue: q.chapter }, { name: 'concept', label: 'Concept', type: 'text', defaultValue: q.concept }]} /></li>)}</ul> : <Empty>No questions extracted{open.extraction.error ? `: ${open.extraction.error}` : ''}.</Empty>}
        </Panel>}
      </>
    );
  }

  async function Bank({ manager }: { manager: boolean }) {
    const pending = await pendingBank();
    return (
      <>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Add a question to the shared bank">
            <QuickForm action={A.teacherQuestionAction} submit="Add question" fields={[
              { name: 'examId', label: 'Exam', type: 'select', options: exOpts }, { name: 'subject', label: 'Subject', type: 'text', defaultValue: 'Physics' }, { name: 'chapter', label: 'Chapter', type: 'text', required: true }, { name: 'concept', label: 'Concept', type: 'text', required: true },
              { name: 'type', label: 'Type', type: 'select', options: QTYPES.map((q) => ({ value: q.id, label: q.label })) }, { name: 'difficulty', label: 'Difficulty', type: 'select', defaultValue: 'medium', options: ['beginner', 'easy', 'medium', 'hard', 'very_hard', 'advanced'].map((d) => ({ value: d, label: d })) },
              { name: 'stem', label: 'Question', type: 'textarea', required: true, wide: true }, { name: 'options', label: 'Options (one per line; blank for non-MCQ)', type: 'textarea' }, { name: 'answer', label: 'Answer (option index 0–3, value or model answer)', type: 'text', required: true }, { name: 'explanation', label: 'Explanation (optional)', type: 'textarea', wide: true },
            ]} />
          </Panel>
          <Panel title="Generate questions for the bank with AI (reviewed before use)">
            {aiConfigured() ? <QuickForm action={A.bankGenerateAction} submit="Generate for review" fields={[{ name: 'examId', label: 'Exam', type: 'select', options: exOpts }, { name: 'subject', label: 'Subject', type: 'text', defaultValue: 'Physics' }, { name: 'chapter', label: 'Chapter', type: 'text', required: true }, { name: 'concept', label: 'Concept', type: 'text', required: true }, { name: 'type', label: 'Type', type: 'select', options: QTYPES.map((q) => ({ value: q.id, label: q.label })) }, { name: 'difficulty', label: 'Difficulty', type: 'select', defaultValue: 'medium', options: ['easy', 'medium', 'hard', 'very_hard'].map((d) => ({ value: d, label: d })) }, { name: 'count', label: 'How many', type: 'number', defaultValue: '10', min: 1, max: 30 }]} /> : <Empty>AI is not configured (ANTHROPIC_API_KEY missing).</Empty>}
            {manager && <div className="mt-4 border-t border-line pt-3"><p className="mb-2 text-xs text-muted">Bring the 310 formula-generated Practice questions (answers correct by construction) into the Open Book bank so diagnostics, daily challenges and pool mocks have questions. Safe to run again.</p><ActionButton action={A.importBankAction} label="Import the practice bank" className="btn-outline py-1.5 text-sm" /></div>}
          </Panel>
        </div>
        <Panel title={`Waiting for approval (${pending.length}): AI and extracted questions enter the shared bank only after a teacher approves`}>{pending.length ? <ul className="divide-y divide-line text-sm">{pending.slice(0, 100).map((q) => <li key={q.id} className="py-2"><p className="whitespace-pre-line">{q.stem}</p>{q.options.length > 0 && <p className="text-xs text-muted">{q.options.map((o, i) => `(${'abcd'[i]}) ${o}`).join('  ')}</p>}<p className="text-xs text-muted">Answer: {q.answer.join(', ')} · {q.subject} › {q.chapter} › {q.concept} · {q.origin}{q.ai ? ' · AI' : ''}</p><span className="mt-1 flex gap-1"><ActionButton action={A.reviewQuestionAction} label="Approve" hidden={{ id: q.id, decision: 'approve' }} /><ActionButton action={A.reviewQuestionAction} label="Reject" hidden={{ id: q.id, decision: 'reject' }} /></span></li>)}</ul> : <Empty>Nothing waiting.</Empty>}</Panel>
        <Panel title="Add chapters and concepts">
          <ObForm action={A.taxonomyAction as never} submit="Save chapter">
            <div className="grid grid-cols-3 gap-2"><Field label="Subject"><input name="subject" required className="input w-full" /></Field><Field label="Class"><select name="cls" className="input w-full"><option value="11">11 (1st year)</option><option value="12">12 (2nd year)</option></select></Field><Field label="Chapter"><input name="chapter" required className="input w-full" /></Field></div>
            <Field label="Concepts (one per line or separated by ;)"><textarea name="concepts" rows={3} className="input w-full" /></Field>
          </ObForm>
        </Panel>
      </>
    );
  }

  async function Sources({ manager }: { manager: boolean }) {
    const src = await listSources();
    const bad = src.filter((x) => x.status === 'broken' || x.status === 'moved');
    return (
      <>
        {manager && <div className="flex flex-wrap gap-2"><ActionButton action={A.seedSourcesAction} label="Add the official source list" className="btn-outline py-1.5 text-sm" /><ActionButton action={A.checkSourcesAction} label="Check every link now" className="btn-primary py-1.5 text-sm" /></div>}
        <p className="text-sm text-muted">{src.length} sources · {bad.length} need attention · links are checked weekly automatically.</p>
        <Panel title="Official sources">{src.length ? <ul className="divide-y divide-line text-sm">{src.map((x) => <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><a className="underline" href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a> <span className="text-xs text-muted">· {x.category}{x.examId ? ` · ${x.examId}` : ''} · {x.resourceType} · {x.licence.replace('_', ' ')}</span></span><span className={`text-xs ${x.status === 'ok' ? 'text-emerald-700' : x.status === 'unchecked' ? 'text-muted' : 'font-semibold text-red-700'}`}>{x.status}{x.httpStatus ? ` (${x.httpStatus})` : ''}{x.lastChecked ? ` · checked ${x.lastChecked.slice(0, 10)}` : ''}{x.note ? ` · ${x.note}` : ''}{x.status === 'moved' && x.finalUrl ? ` → ${x.finalUrl}` : ''}</span>{manager && <ActionButton action={A.removeSourceAction} label="Remove" hidden={{ id: x.id }} />}</li>)}</ul> : <Empty>No sources yet.</Empty>}</Panel>
        {manager && <Panel title="Add or correct a source">
          <QuickForm action={A.saveSourceAction} submit="Save source" fields={[{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'url', label: 'URL', type: 'url', required: true }, { name: 'category', label: 'Category', type: 'select', options: CATEGORIES.map((c) => ({ value: c.id, label: c.short })) }, { name: 'examId', label: 'Exam', type: 'select', options: [{ value: '', label: '—' }, ...exOpts] }, { name: 'resourceType', label: 'Resource', type: 'select', options: ['syllabus', 'textbook', 'previous_papers', 'answer_keys', 'info_bulletin', 'mock_test', 'portal', 'course'].map((v) => ({ value: v, label: v.replace('_', ' ') })) }, { name: 'licence', label: 'Licence', type: 'select', options: [{ value: 'link_only', label: 'Link only' }, { value: 'free_official', label: 'Free official' }, { value: 'open_licence', label: 'Open licence' }, { value: 'public_domain', label: 'Public domain' }] }, { name: 'note', label: 'Note', type: 'text', wide: true }]} />
        </Panel>}
      </>
    );
  }

  async function Teach({ batchId, studentId }: { batchId?: string; studentId?: string }) {
    const batches = await myBatches(u);
    const b = batches.find((x) => x.id === batchId) ?? batches[0];
    const [perf, assigns, decks, byId, path] = await Promise.all([b ? batchPerformance(u, b.id) : null, b ? assignmentsFor(b.id) : [], pendingDecks(), studentsById(), studentId ? pathOf(studentId) : null]);
    const books = (await listBooks({ size: 60 })).items;
    const batchOpts = batches.map((x) => ({ value: x.id, label: x.data.name }));
    if (!b) return <Panel title="Teaching"><Empty>You have no batches yet.</Empty></Panel>;
    return (
      <>
        <nav className="flex flex-wrap gap-1.5">{batches.map((x) => <Link key={x.id} href={`/crm/openbook?tab=teach&batch=${x.id}`} className={x.id === b.id ? 'chip chip-active' : 'chip'}>{x.data.name}</Link>)}</nav>
        <Panel title={`Student performance · ${perf?.batch}`}>{perf?.students.length ? <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th>Student</th><th>Questions</th><th>Accuracy</th><th>Mastered</th><th>Weak</th><th>Path</th></tr></thead><tbody>{perf.students.map((s) => <tr key={s.studentId} className="border-t border-line"><td className="py-1"><Link className="underline" href={`/crm/openbook?tab=teach&batch=${b.id}&student=${s.studentId}`}>{s.name}</Link></td><td>{s.attempts}</td><td>{s.accuracy === null ? '—' : `${s.accuracy}%`}</td><td>{s.mastered}</td><td className="text-xs">{s.weak.join(', ')}</td><td>{s.path === null ? '—' : `${s.path}%`}</td></tr>)}</tbody></table> : <Empty>No students in this batch.</Empty>}
          {perf && perf.weakConcepts.length > 0 && <p className="mt-2 text-xs">Weakest concepts in the batch: {perf.weakConcepts.map((c) => `${c.label} (${c.avg}%, ${c.students} students)`).join(' · ')}</p>}</Panel>
        {studentId && <Panel title={`Learning path · ${byId.get(studentId)?.fullName ?? 'Student'}`}>{path ? <>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto text-xs">{path.items.filter((i) => i.status !== 'done').slice(0, 40).map((i) => <li key={i.conceptKey}>{i.status === 'in_progress' ? '▶️' : '🔒'} {i.subject} › {i.chapter} › {i.concept} · by {i.target} · {i.reason}</li>)}</ul>
          <div className="mt-3"><QuickForm action={A.adjustPathAction} submit="Adjust" fields={[{ name: 'studentId', type: 'hidden', value: studentId }, { name: 'conceptKey', label: 'Concept', type: 'select', options: path.items.map((i) => ({ value: i.conceptKey, label: `${i.subject} › ${i.concept}` })) }, { name: 'status', label: 'Status', type: 'select', options: [{ value: '', label: 'no change' }, { value: 'in_progress', label: 'Work on it now' }, { value: 'locked', label: 'Later' }, { value: 'done', label: 'Done' }] }, { name: 'target', label: 'Target date', type: 'date' }, { name: 'reason', label: 'Note for the student', type: 'text' }]} /></div>
        </> : <Empty>This student hasn’t created a learning path yet.</Empty>}</Panel>}
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Assign a concept exercise or recommend a book"><QuickForm action={A.assignAction} submit="Assign" fields={[{ name: 'batchId', label: 'Batch', type: 'select', defaultValue: b.id, options: batchOpts }, { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'concept', label: 'Concept exercise' }, { value: 'book', label: 'Book recommendation' }] }, { name: 'examId', label: 'Exam', type: 'select', options: exOpts }, { name: 'subject', label: 'Subject', type: 'text' }, { name: 'chapter', label: 'Chapter', type: 'text' }, { name: 'concept', label: 'Concept', type: 'text' }, { name: 'count', label: 'Questions', type: 'number', defaultValue: '10', min: 1, max: 100 }, { name: 'bookId', label: 'Book (for recommendations)', type: 'select', options: [{ value: '', label: '—' }, ...books.map((x) => ({ value: x.id, label: x.title.slice(0, 60) }))] }, { name: 'due', label: 'Due', type: 'date' }, { name: 'note', label: 'Note', type: 'text', wide: true }]} /></Panel>
          <Panel title="Share a practice test with the batch"><QuickForm action={A.shareMockAction} submit="Create and share" fields={[{ name: 'batchId', label: 'Batch', type: 'select', defaultValue: b.id, options: batchOpts }, { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'examId', label: 'Exam', type: 'select', options: exOpts }, { name: 'subjects', label: 'Subjects (comma)', type: 'text', defaultValue: 'Physics' }, { name: 'chapters', label: 'Chapters (comma, optional)', type: 'text' }, { name: 'count', label: 'Questions', type: 'number', defaultValue: '20', min: 1, max: 200 }, { name: 'minutes', label: 'Minutes (optional)', type: 'number' }, { name: 'source', label: 'From', type: 'select', options: [{ value: 'pool', label: 'Approved bank & papers' }, { value: 'pattern', label: 'Past-paper pattern' }] }, { name: 'due', label: 'Due', type: 'date' }]} /></Panel>
        </div>
        <Panel title={`Assigned to ${b.data.name}`}>{assigns.length ? <ul className="text-sm">{assigns.map((a) => <li key={a.id}>{a.kind} · {a.concept ?? a.note ?? books.find((x) => x.id === a.bookId)?.title ?? ''} · {a.teacherName}{a.due ? ` · due ${a.due}` : ''}</li>)}</ul> : <Empty>Nothing assigned yet.</Empty>}</Panel>
        <Panel title={`Shared flashcard decks waiting for approval (${decks.length})`}>{decks.length ? <ul className="text-sm">{decks.map((d) => <li key={d.id} className="flex items-center justify-between gap-2 py-1">{d.name}<span className="flex gap-1"><ActionButton action={A.approveDeckAction} label="Approve" hidden={{ id: d.id, decision: 'approve' }} /><ActionButton action={A.approveDeckAction} label="Reject" hidden={{ id: d.id, decision: 'reject' }} /></span></li>)}</ul> : <Empty>None.</Empty>}</Panel>
      </>
    );
  }

  async function Community() {
    const [q, list] = await Promise.all([moderationQueue(), listThreads({})]);
    const threads = (await Promise.all(list.slice(0, 15).map((t) => thread(t.id)))).filter((x): x is NonNullable<typeof x> => !!x);
    return (
      <>
        <p className="text-sm text-muted">Posts reported by students or hidden automatically after 3 reports. Every action is logged.</p>
        <Panel title={`Moderation queue (${q.length})`}>{q.length ? <ul className="divide-y divide-line text-sm">{q.map((p) => <li key={p.id} className="space-y-1 py-2"><p><b>{p.title || '(answer)'}</b> {p.hidden ? <span className="text-xs font-semibold text-red-700">hidden</span> : null} <span className="text-xs text-muted">· {p.nickname} ({p.author.kind}) · {p.reports.length} reports: {p.reports.map((r) => r.reason).join('; ')}</span></p><p className="whitespace-pre-line text-xs">{p.body.slice(0, 600)}</p><span className="flex flex-wrap gap-1"><ActionButton action={A.moderateAction} label="Hide" hidden={{ id: p.id, action: 'hide' }} /><ActionButton action={A.moderateAction} label="Restore" hidden={{ id: p.id, action: 'restore' }} />{p.threadId && <ActionButton action={A.verifyAction} label="Teacher verified" hidden={{ id: p.id, on: 'on' }} />}{p.author.kind === 'student' && <><ActionButton action={A.suspendAction} label="Suspend 7 days" hidden={{ studentId: p.author.id, days: '7' }} /><ActionButton action={A.suspendAction} label="Lift suspension" hidden={{ studentId: p.author.id, days: '0' }} /></>}</span></li>)}</ul> : <Empty>Nothing reported.</Empty>}</Panel>
        <Panel title="Recent questions: answer, verify answers">{threads.length ? <ul className="divide-y divide-line text-sm">{threads.slice(0, 15).map(({ thread: t, answers }) => <li key={t.id} className="space-y-1 py-3"><p><b>{t.title}</b> <span className="text-xs text-muted">· {t.nickname} · {t.subject}{t.chapter ? ` › ${t.chapter}` : ''} · {t.createdAt.slice(0, 10)}</span> <ActionButton action={A.moderateAction} label="Hide question" hidden={{ id: t.id, action: 'hide', note: 'Hidden by a moderator' }} className="btn-outline px-2 py-0.5 text-xs" /></p><p className="whitespace-pre-line text-xs">{t.body.slice(0, 500)}</p><ul className="ml-4 space-y-1 border-l border-line pl-3 text-xs">{answers.map((a) => <li key={a.id}>{a.nickname}{a.ai ? ' (AI)' : ''}: {a.body.slice(0, 300)} {a.verifiedBy ? <b className="text-emerald-700">✓ verified by {a.verifiedBy}</b> : <ActionButton action={A.verifyAction} label="Mark teacher verified" hidden={{ id: a.id, on: 'on' }} className="btn-outline px-2 py-0.5 text-xs" />}</li>)}</ul><QuickForm action={A.staffAnswerAction} submit="Answer as staff" cols={1} fields={[{ name: 'threadId', type: 'hidden', value: t.id }, { name: 'body', label: 'Your answer', type: 'textarea', required: true, rows: 2 }]} /></li>)}</ul> : <Empty>No questions yet.</Empty>}</Panel>
      </>
    );
  }

  async function Settings({ manager }: { manager: boolean }) {
    const st = await settings();
    return (
      <>
        <Panel title="Status">
          <ul className="space-y-1 text-sm">
            <li>AI (question generation, explanations, OCR, assistant, tutor): <b>{aiConfigured() ? 'configured' : 'NOT configured: add ANTHROPIC_API_KEY in Vercel'}</b></li>
            <li>Semantic duplicate check (pgvector embeddings): <b>{vectorsConfigured() ? 'configured' : 'not configured: add VOYAGE_API_KEY to enable; lexical + fingerprint checks run meanwhile'}</b></li>
            <li>Google Books: <b>{process.env.GOOGLE_BOOKS_API_KEY ? 'API key set' : 'public API without a key (lower rate limit); add GOOGLE_BOOKS_API_KEY for production volume'}</b></li>
            <li>Voice: <b>{process.env.AZURE_SPEECH_KEY ? 'Azure neural voices' : 'browser speech (add AZURE_SPEECH_KEY + AZURE_SPEECH_REGION for neural Telugu/Hindi voices)'}</b></li>
          </ul>
        </Panel>
        {manager ? <Panel title="AI agent configuration and cost limits">
          <QuickForm action={A.settingsAction} submit="Save settings" reset={false} fields={[{ name: 'model', label: 'Claude model', type: 'text', defaultValue: st.model }, { name: 'dailyQuestions', label: 'Questions per student per day', type: 'number', defaultValue: String(st.dailyQuestions), min: 0, max: 1000 }, { name: 'dailyAiCalls', label: 'Other AI requests per student per day', type: 'number', defaultValue: String(st.dailyAiCalls), min: 0, max: 2000 }, { name: 'dailyVoiceTurns', label: 'Voice tutor turns per student per day', type: 'number', defaultValue: String(st.dailyVoiceTurns), min: 0, max: 1000 }, { name: 'duplicateThreshold', label: 'Duplicate similarity threshold (0.5–0.99)', type: 'number', defaultValue: String(st.duplicateThreshold), min: 0.5, max: 0.99, step: 0.01 }, { name: 'aiEnabled', label: 'AI features on', type: 'checkbox', defaultChecked: st.aiEnabled }, { name: 'communityEnabled', label: 'Community on', type: 'checkbox', defaultChecked: st.communityEnabled }]} />
        </Panel> : <Panel title="Settings"><p className="text-sm text-muted">Only Open Book managers change these.</p></Panel>}
      </>
    );
  }
}
