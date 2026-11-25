'use client';
import { useState, useTransition } from 'react';
import { acceptAction, aiSuggestAction, reportAction, voteAction, type R } from '../../actions';

export function PostActions({ postId, threadId, votes, voted, mine, canAccept = false, canAi = false, isThread = false }: { postId: string; threadId: string; votes: number; voted: boolean; mine: boolean; canAccept?: boolean; canAi?: boolean; isThread?: boolean }) {
  const [r, setR] = useState<R | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <button disabled={pending || mine} onClick={() => start(async () => setR(await voteAction(postId, threadId)))} className={voted ? 'font-semibold text-navy dark:text-gold' : 'underline'}>▲ {votes}</button>
      {canAccept && <button disabled={pending} onClick={() => start(async () => setR(await acceptAction(threadId, postId)))} className="underline">Accept this answer</button>}
      {isThread && canAi && <button disabled={pending} onClick={() => start(async () => setR(await aiSuggestAction(threadId)))} className="underline">Ask AI to suggest an answer</button>}
      {!mine && (reporting ? <span className="flex gap-1"><input className="input w-40 py-0.5 text-xs" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is wrong?" aria-label="Reason" /><button disabled={pending} onClick={() => start(async () => { setR(await reportAction(postId, threadId, reason)); setReporting(false); })} className="btn-outline px-2 py-0.5">Report</button></span> : <button onClick={() => setReporting(true)} className="text-muted underline">Report</button>)}
      {r && <span className="text-muted">{r.error ?? r.message}</span>}
    </div>
  );
}
