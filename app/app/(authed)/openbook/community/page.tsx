import Link from 'next/link';
import { BigFileInput } from '@/components/openbook/BigFileInput';
import { Field, ObForm } from '@/components/openbook/client';
import { badgesFor, listThreads } from '@/lib/openbook/community';
import { obStudent } from '@/lib/openbook/session';
import { postThreadAction } from '../actions';
import { SimilarCheck } from './SimilarCheck';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';
const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

export default async function CommunityPage({ searchParams }: { searchParams: { subject?: string; q?: string } }) {
  const me = await obStudent();
  const threads = await listThreads({ subject: searchParams.subject, q: searchParams.q });
  return (
    <div className="space-y-4">
      <H1 sub={`BJC students and teachers only. You appear as “${me.profile.nickname}”${badgesFor(me.profile.reputation).length ? ` · ${badgesFor(me.profile.reputation).join(', ')}` : ''} · ${me.profile.reputation} points.`}>Question Community</H1>
      <p className="rounded-lg bg-bg px-3 py-2 text-xs text-muted">Be kind. No phone numbers, emails, links or social handles (they are blocked). No private messages. Report anything wrong; 3 reports hide a post until a teacher checks it. Don’t upload pages from copyrighted books.</p>
      <form className="flex gap-2"><input name="q" defaultValue={searchParams.q} className="input flex-1" placeholder="Search questions" aria-label="Search" /><select name="subject" defaultValue={searchParams.subject ?? ''} className="input w-auto" aria-label="Subject"><option value="">All</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select><button className="btn-outline px-3">Go</button></form>
      <ul className="space-y-2">
        {threads.length === 0 && <li className="card p-3 text-sm text-muted">No questions yet. Ask the first one.</li>}
        {threads.map((t) => <li key={t.id}><Link href={`/app/openbook/community/${t.id}`} className="card block p-3 text-sm"><p className="font-semibold text-heading">{t.title}</p><p className="text-xs text-muted">{t.nickname} · {t.subject}{t.chapter ? ` › ${t.chapter}` : ''} · {t.answers} answers · ▲{t.votes.length}{t.acceptedId ? ' · ✔ answered' : ''}</p></Link></li>)}
      </ul>
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-heading">Ask a question</h2>
        <ObForm action={postThreadAction} submit="Post question">
          <Field label="Title"><input name="title" required maxLength={200} className="input w-full" /></Field>
          <Field label="Details (LaTeX like $x^2$ is fine)"><textarea name="body" required rows={4} className="input w-full" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Subject"><select name="subject" className="input w-full">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Chapter (optional)"><input name="chapter" className="input w-full" /></Field>
          </div>
          <Field label="Concept (optional)"><input name="concept" className="input w-full" /></Field>
          <BigFileInput name="image" accept="image/jpeg,image/png,image/webp" label="Photo or diagram (optional, up to 5 MB)" maxMb={5} />
          <SimilarCheck />
        </ObForm>
      </section>
    </div>
  );
}
