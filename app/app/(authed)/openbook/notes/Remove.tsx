'use client';
import { useTransition } from 'react';
import { removeBookmarkAction, removeNoteAction } from '../actions';

export function RemoveButton({ id, kind }: { id: string; kind: 'note' | 'bookmark' }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await (kind === 'note' ? removeNoteAction(id) : removeBookmarkAction(id)); })} className="text-[11px] text-muted underline">{pending ? 'Removing…' : 'Remove'}</button>;
}
