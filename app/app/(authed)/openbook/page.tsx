import Link from 'next/link';
import { getAppUser } from '@/lib/app/service';
import { challengeStreak } from '@/lib/openbook/challenge';
import { CATEGORIES, EXAM_BY_ID } from '@/lib/openbook/taxonomy';
import { dueCount } from '@/lib/openbook/flashcards';
import { t } from '@/lib/openbook/i18n';
import { listBooks, readingHistory, recommendations } from '@/lib/openbook/library';
import { readiness } from '@/lib/openbook/core';
import { pathSummary, todayPlan } from '@/lib/openbook/path';
import { obStudent } from '@/lib/openbook/session';
import { assignmentsFor } from '@/lib/openbook/teacher';
import { ObForm, Field } from '@/components/openbook/client';
import { profileAction } from './actions';
import { BookTile } from './ui';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function OpenBookHome() {
  const u = await getAppUser();
  const p = u?.active;
  // parents: progress % only (§16); applicants/alumni: not available (college students only)
  if (p?.kind === 'parent') {
    const s = await pathSummary(p.studentId);
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl text-heading">Open Book</h1>
        <section className="card p-4 text-sm">
          {s ? <><p className="text-[11px] uppercase tracking-wider text-muted">{p.name.split(' ')[0]}’s learning path · {s.exam}</p><p className="font-mono text-3xl font-semibold text-heading">{s.progress}%</p><p className="text-muted">{s.done} of {s.total} concepts mastered · exam {s.examDate}</p></> : <p>{p.name.split(' ')[0]} hasn’t started a learning path in Open Book yet.</p>}
        </section>
        <p className="text-xs text-muted">Parents see progress only. Your child’s notes, answers and AI conversations are private to them.</p>
      </div>
    );
  }
  if (p?.kind !== 'student') {
    return <div className="card space-y-2 p-4 text-sm"><h1 className="font-display text-2xl text-heading">Open Book</h1><p>Open Book is for Bhargava Junior College students. Sign in with the student’s own login to use the library, AI question generator and mock tests.</p></div>;
  }
  const me = await obStudent();
  const lang = me.profile.lang;
  const [history, recs, recent, cards, plan, streak, ready, assigned] = await Promise.all([readingHistory(me.studentId), recommendations(me.studentId, me.examIds, 6), listBooks({ size: 6 }), dueCount(me.studentId), todayPlan(me.studentId), challengeStreak(me.studentId), readiness(), me.batchId ? assignmentsFor(me.batchId) : Promise.resolve([])]);
  const last = history[0];
  const catReady = (id: string) => [...ready.entries()].some(([examId, r]) => r.ready && EXAM_BY_ID.get(examId)?.category === id);
  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-2xl text-heading">{t(lang, 'home')}</h1><p className="text-sm text-muted">AI digital library and exam preparation · {me.name.split(' ')[0]}</p></header>
      <section className="grid grid-cols-3 gap-2 text-center">
        <Link href="/app/openbook/flashcards" className="card p-3"><p className="font-mono text-2xl font-semibold text-heading">{cards}</p><p className="text-[11px] text-muted">{t(lang, 'dueCards')}</p></Link>
        <Link href="/app/openbook/challenge" className="card p-3"><p className="font-mono text-2xl font-semibold text-heading">🔥{streak}</p><p className="text-[11px] text-muted">challenge streak</p></Link>
        <Link href="/app/openbook/path" className="card p-3"><p className="font-mono text-2xl font-semibold text-heading">{plan ? `${plan.progress}%` : '—'}</p><p className="text-[11px] text-muted">{plan ? 'path done' : 'start your path'}</p></Link>
      </section>
      {plan && plan.tasks.length > 0 && (
        <section className="card space-y-1 p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted">{t(lang, 'today')}: {plan.minutes} min</p>
          {plan.tasks.map((x) => <p key={x.conceptKey}><b>{x.concept}</b> ({x.chapter}){x.read ? ` · read pp. ${x.read.pages[0]}–${x.read.pages[x.read.pages.length - 1]}` : ''} · {x.questions} questions{x.cards ? ` · ${x.cards} flashcards` : ''}</p>)}
          <Link href="/app/openbook/path" className="text-xs underline">Open today’s plan</Link>
        </section>
      )}
      {assigned.length > 0 && (
        <section className="card space-y-1 p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted">From your teachers</p>
          {assigned.slice(0, 6).map((a) => <p key={a.id}>{a.kind === 'book' ? <Link className="underline" href={`/app/openbook/book/${a.bookId}`}>📖 Read the recommended book</Link> : a.kind === 'mock' ? <Link className="underline" href="/app/openbook/mock">📝 Practice test: {a.note}</Link> : <Link className="underline" href="/app/openbook/generate">✍️ {a.count} questions on {a.concept ?? a.chapter} ({a.subject})</Link>} <span className="text-xs text-muted">· {a.teacherName}{a.due ? ` · due ${a.due}` : ''}{a.kind !== 'mock' && a.note ? ` · ${a.note}` : ''}</span></p>)}
        </section>
      )}
      {last && <Link href={`/app/openbook/book/${last.bookId}`} className="card block p-4"><p className="text-[11px] uppercase tracking-wider text-muted">{t(lang, 'continue')}</p><p className="font-semibold text-heading">{last.book?.title}</p><p className="text-xs text-muted">Page {last.lastPage} · {last.pagesRead.length} pages read</p></Link>}
      <section className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={`/app/openbook/library?category=${c.id}`} className="card p-3">
            <p className="text-sm font-semibold text-heading">{c.short}</p><p className="text-[11px] text-muted">{c.blurb}</p>
            {!catReady(c.id) && <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900">{t(lang, 'comingSoon')}</span>}
          </Link>
        ))}
      </section>
      {recs.length > 0 && <section><h2 className="mb-2 text-sm font-semibold text-heading">{t(lang, 'recommended')}</h2><div className="grid grid-cols-2 gap-2">{recs.map((r) => <BookTile key={r.book.id} b={r.book} reason={r.reason} />)}</div></section>}
      <section><h2 className="mb-2 text-sm font-semibold text-heading">{t(lang, 'recent')}</h2>{recent.items.length ? <div className="grid grid-cols-2 gap-2">{recent.items.map((b) => <BookTile key={b.id} b={b} />)}</div> : <p className="card p-3 text-sm text-muted">No books in the library yet. Your teachers are adding them.</p>}</section>
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-heading">My Open Book settings</h2>
        <ObForm action={profileAction} submit="Save">
          <Field label="Nickname (shown in the community and leaderboards; never your real name)"><input name="nickname" defaultValue={me.profile.nickname} className="input w-full" maxLength={24} /></Field>
          <Field label="Language"><select name="lang" defaultValue={lang} className="input w-full"><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिंदी</option></select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="optOut" defaultChecked={me.profile.optOut} /> Hide my name on public leaderboards</label>
        </ObForm>
      </section>
    </div>
  );
}
