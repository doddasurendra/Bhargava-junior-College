'use client';
import { useTransition } from 'react';
import { deleteSessionAction } from '../actions';

export function DeleteSession({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await deleteSessionAction(id); })} className="shrink-0 text-xs text-muted underline">{pending ? '…' : 'Delete'}</button>;
}
