'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { similarAction } from '../actions';

/** Before posting: similar existing questions, so duplicates go to the existing thread. */
export function SimilarCheck() {
  const [items, setItems] = useState<{ id: string; title: string; score: number }[] | null>(null);
  const [pending, start] = useTransition();
  const check = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form!;
    const text = `${(form.elements.namedItem('title') as HTMLInputElement).value} ${(form.elements.namedItem('body') as HTMLTextAreaElement).value}`;
    start(async () => { const r = await similarAction(text, (form.elements.namedItem('subject') as HTMLSelectElement).value); setItems((r.data as never) ?? []); });
  };
  return (
    <div className="text-sm">
      <button type="button" onClick={check} disabled={pending} className="text-xs underline">{pending ? 'Checking…' : 'Check for similar questions first'}</button>
      {items && (items.length ? <ul className="mt-1 space-y-1">{items.map((x) => <li key={x.id}><Link className="underline" href={`/app/openbook/community/${x.id}`}>{x.title}</Link> <span className="text-xs text-muted">{x.score}% similar</span><label className="ml-2 text-xs"><input type="radio" name="duplicateOf" value={x.id} /> mine is the same</label></li>)}</ul> : <p className="mt-1 text-xs text-muted">No similar questions found.</p>)}
    </div>
  );
}
