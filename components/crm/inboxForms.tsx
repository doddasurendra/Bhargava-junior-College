'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { claimAction, closeAction, replyAction, transferAction } from '@/app/crm/inbox-actions';
import { ActionForm, Submit } from './forms';

/** Keeps the inbox fresh without a socket: re-renders the server page every few seconds while visible. */
export function AutoRefresh({ ms = 6000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}

export function ScrollToEnd({ dep }: { dep: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'end' });
  }, [dep]);
  return <span ref={ref} />;
}

export function ReplyForm({ id, disabledReason }: { id: string; disabledReason: string | null }) {
  const [text, setText] = useState('');
  const [state, action] = useFormState(replyAction, {});
  // Clear only once the server accepted the reply, so a failed send keeps the text.
  useEffect(() => {
    if (state.ok) setText('');
  }, [state]);
  if (disabledReason) return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-400/10 dark:text-amber-50">{disabledReason}</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        maxLength={1000}
        rows={3}
        required
        placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)"
        className="input text-sm"
      />
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-400/10 dark:text-red-200">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted">{text.length}/1000</span>
        <Submit className="btn-primary py-1.5">Send</Submit>
      </div>
    </form>
  );
}

export function ClaimButton({ id }: { id: string }) {
  return (
    <ActionForm action={claimAction} reset={false} quiet>
      <input type="hidden" name="id" value={id} />
      <Submit className="btn-primary py-1.5">Pick up</Submit>
    </ActionForm>
  );
}

export function TransferForm({ id, targets }: { id: string; targets: { id: string; name: string }[] }) {
  return (
    <ActionForm action={transferAction} className="flex flex-wrap gap-2" reset={false}>
      <input type="hidden" name="id" value={id} />
      <select name="to" required defaultValue="" className="input w-44 py-1.5 text-sm">
        <option value="" disabled>
          Transfer to…
        </option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input name="note" maxLength={200} placeholder="Note (optional)" className="input w-40 py-1.5 text-sm" />
      <Submit className="btn-outline py-1.5">Transfer</Submit>
    </ActionForm>
  );
}

export function CloseForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline py-1.5">
        Close…
      </button>
    );
  return (
    <ActionForm action={closeAction} className="flex flex-wrap gap-2" reset={false}>
      <input type="hidden" name="id" value={id} />
      <input name="note" required minLength={3} maxLength={300} placeholder="Outcome, e.g. “Fees explained, visit booked”" className="input w-64 py-1.5 text-sm" autoFocus />
      <Submit className="btn-outline py-1.5">Close conversation</Submit>
    </ActionForm>
  );
}
