'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { startMockAction } from '../actions';

export function StartButton({ mockId, label }: { mockId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { const r = await startMockAction(mockId); if (r.ok) router.push(`/app/openbook/mock/${r.data}`); })} className="btn-primary shrink-0 px-3 py-1 text-xs">{pending ? '…' : label}</button>;
}
