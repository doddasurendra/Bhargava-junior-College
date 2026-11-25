import { notFound } from 'next/navigation';
import { Field, ObForm } from '@/components/openbook/client';
import { thread } from '@/lib/openbook/community';
import { aiConfigured } from '@/lib/openbook/llm';
import { obStudent } from '@/lib/openbook/session';
import { answerAction } from '../../actions';
import { PostActions } from './PostActions';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const me = await obStudent();
  const t = await thread(params.id);
  if (!t) notFound();
  const q = t.thread;
  const asker = q.author.kind === 'student' && q.author.id === me.studentId;
  return (
    <div className="space-y-4">
      <article className="card space-y-2 p-4 text-sm">
        <p className="text-xs text-muted">{q.nickname} · {q.subject}{q.chapter ? ` › ${q.chapter}` : ''}{q.concept ? ` › ${q.concept}` : ''} · {q.createdAt.slice(0, 10)}</p>
        <h1 className="font-display text-lg text-heading">{q.title}</h1>
        <p className="whitespace-pre-line">{q.body}</p>
        {q.imageKey && <img src={`/api/openbook/file?k=post&id=${q.id}`} alt="Attached" className="max-h-80 rounded-lg" />}
        {q.duplicateOf && <p className="text-xs text-muted">Marked as the same as <a className="underline" href={`/app/openbook/community/${q.duplicateOf}`}>an earlier question</a>.</p>}
        <PostActions postId={q.id} threadId={q.id} votes={q.votes.length} voted={q.votes.includes(me.studentId)} mine={asker} canAi={aiConfigured()} isThread />
      </article>
      <h2 className="text-sm font-semibold text-heading">{t.answers.length} answer{t.answers.length === 1 ? '' : 's'}</h2>
      {t.answers.map((a) => (
        <article key={a.id} className={`card space-y-1 p-3 text-sm ${a.id === q.acceptedId ? 'border-emerald-600' : ''}`}>
          <p className="text-xs text-muted">{a.nickname}{a.ai && <span className="ml-1 rounded bg-navy/10 px-1 font-semibold">AI</span>}{a.id === q.acceptedId && <span className="ml-1 font-semibold text-emerald-700">✔ accepted</span>}{a.verifiedBy && <span className="ml-1 font-semibold text-navy dark:text-gold">✓ teacher verified ({a.verifiedBy})</span>}</p>
          <p className="whitespace-pre-line">{a.body}</p>
          <PostActions postId={a.id} threadId={q.id} votes={a.votes.length} voted={a.votes.includes(me.studentId)} mine={a.author.id === me.studentId} canAccept={asker && a.id !== q.acceptedId} />
        </article>
      ))}
      <section className="card p-4">
        <ObForm action={answerAction} submit="Post answer">
          <input type="hidden" name="threadId" value={q.id} />
          <Field label="Your answer"><textarea name="body" required rows={4} className="input w-full" /></Field>
        </ObForm>
      </section>
    </div>
  );
}
