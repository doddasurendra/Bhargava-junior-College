'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Note } from '@/components/openbook/client';
import { createMockAction, startMockAction, type R } from '../actions';

export function PatternMock({ examId, subject }: { examId: string; subject: string }) {
  const router = useRouter();
  const [count, setCount] = useState(20);
  const [r, setR] = useState<R | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-2 p-4 text-sm">
      <h2 className="font-semibold text-heading">Generate a practice test with this pattern</h2>
      <label className="flex items-center gap-2">Questions <input type="number" min={5} max={100} value={count} onChange={(e) => setCount(Number(e.target.value) || 20)} className="input w-20" /></label>
      <Note r={r?.error ? r : null} />
      <button disabled={pending} onClick={() => start(async () => { const x = await createMockAction({ examId, subjects: [subject], chapters: [], concepts: [], count, difficulty: null, minutes: null, marks: null, negative: null, source: 'pattern' }); setR(x); if (x.ok) { const s = await startMockAction(String(x.data)); if (s.ok) router.push(`/app/openbook/mock/${s.data}`); } })} className="btn-primary w-full py-2">{pending ? 'Building…' : 'Create pattern test'}</button>
    </section>
  );
}
