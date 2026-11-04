'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { waBulkAction } from '@/app/crm/wa-actions';
import { assignAction, bulkCategoryAction, callAction, checkInAction, decisionAction, loginDevAction, loginPasswordAction, qualifyAction, seedDemoAction, visitOutcomeAction, type ActionState } from '@/app/crm/actions';
import { CALL_OUTCOMES, LEAD_CATEGORIES, LOST_REASONS, type LeadCategory } from '@/lib/crm/types';

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-400/10 dark:text-red-200">
        {state.error}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
        {state.message}
      </p>
    );
  return null;
}

export function Submit({ children, className = 'btn-primary', name, value, formAction }: { children: ReactNode; className?: string; name?: string; value?: string; formAction?: (fd: FormData) => void }) {
  const { pending, data } = useFormStatus();
  // Several submit buttons can share a form; only the one that was clicked shows progress.
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} formAction={formAction} disabled={pending} className={className}>
      {mine ? 'Saving…' : children}
    </button>
  );
}

export function ActionForm({ action, children, className = 'space-y-3', reset = true, quiet = false }: { action: Action; children: ReactNode; className?: string; reset?: boolean; quiet?: boolean }) {
  const [returned, formAction] = useFormState(action, {});
  // No state back means the request was refused before the action ran: read-only "view as" (middleware 403)
  // or an expired session. Say so instead of failing silently.
  const rawState: ActionState = returned ?? { error: 'Not saved. You may be viewing as another user (read-only), or your session has ended. Reload the page.' };
  // quiet: show errors only — for row-level controls where a success banner would shift the layout.
  const state = quiet && rawState.ok ? {} : rawState;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (rawState.ok && reset) ref.current?.reset();
  }, [rawState, reset]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <Feedback state={state} />
    </form>
  );
}

const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';
const seg = (active: boolean) => `rounded-lg border px-3 py-1.5 text-sm transition ${active ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line hover:border-gold'}`;

function LostFields() {
  const [reason, setReason] = useState('');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        <span className={lbl}>Loss reason</span>
        <select name="lostReason" className="input py-2" value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Choose…</option>
          {LOST_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      {reason === 'competitor' && (
        <label>
          <span className={lbl}>Which college?</span>
          <input name="competitor" className="input py-2" required maxLength={80} />
        </label>
      )}
    </div>
  );
}

function FollowUpField({ defaultValue, label = 'Next follow-up' }: { defaultValue: string; label?: string }) {
  return (
    <label className="block">
      <span className={lbl}>{label} (IST)</span>
      <input type="datetime-local" name="nextFollowUpAt" defaultValue={defaultValue} className="input py-2 font-mono" required />
    </label>
  );
}

/** Mandatory outcome after every call (§7.1 step 4). */
export function CallForm({ leadId, defaultFollowUp }: { leadId: string; defaultFollowUp: string }) {
  const [outcome, setOutcome] = useState('');
  const [interest, setInterest] = useState('');
  const [close, setClose] = useState(false);
  const closing = outcome === 'wrong_number' || close;
  return (
    <ActionForm action={callAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <fieldset>
        <legend className={lbl}>Call outcome</legend>
        <div className="flex flex-wrap gap-1.5">
          {CALL_OUTCOMES.map((o) => (
            <label key={o.value} className={`${seg(outcome === o.value)} cursor-pointer`}>
              <input type="radio" name="outcome" value={o.value} className="sr-only" checked={outcome === o.value} onChange={() => { setOutcome(o.value); if (o.value !== 'connected') setClose(false); }} required />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {outcome === 'connected' && (
        <>
          <fieldset>
            <legend className={lbl}>Interest</legend>
            <div className="flex flex-wrap gap-1.5">
              {(['hot', 'warm', 'cold'] as const).map((c) => (
                <label key={c} className={`${seg(interest === c && !close)} cursor-pointer capitalize`}>
                  <input type="radio" name="interest" value={c} className="sr-only" checked={interest === c && !close} onChange={() => { setInterest(c); setClose(false); }} />
                  {c}
                </label>
              ))}
              <label className={`${seg(close)} cursor-pointer`}>
                <input type="checkbox" name="close" value="lost" className="sr-only" checked={close} onChange={(e) => setClose(e.target.checked)} />
                Not interested · close as lost
              </label>
            </div>
          </fieldset>
          {close && <LostFields />}
        </>
      )}
      <label className="block">
        <span className={lbl}>Notes</span>
        <textarea name="notes" className="input min-h-[70px] py-2" maxLength={1000} placeholder="What was discussed, objections, who to speak to next time…" />
      </label>
      {!closing && outcome && <FollowUpField defaultValue={defaultFollowUp} />}
      {outcome === 'wrong_number' && <p className="text-xs text-muted">The lead will be marked Invalid and closed.</p>}
      <Submit>Log call</Submit>
    </ActionForm>
  );
}

export function DecisionForm({ leadId, defaultFollowUp }: { leadId: string; defaultFollowUp: string }) {
  const [decision, setDecision] = useState('');
  return (
    <ActionForm action={decisionAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap gap-1.5">
        {[
          ['confirmed', 'Confirmed'],
          ['pending', 'Pending'],
          ['lost', 'Lost'],
        ].map(([v, l]) => (
          <label key={v} className={`${seg(decision === v)} cursor-pointer`}>
            <input type="radio" name="decision" value={v} className="sr-only" checked={decision === v} onChange={() => setDecision(v)} required />
            {l}
          </label>
        ))}
      </div>
      {decision === 'lost' && <LostFields />}
      {(decision === 'pending' || decision === 'confirmed') && <FollowUpField defaultValue={defaultFollowUp} label={decision === 'pending' ? 'Follow-up' : 'Document collection follow-up'} />}
      {decision && <Submit>Record decision</Submit>}
    </ActionForm>
  );
}

export function QualifyForm({ leadId, current }: { leadId: string; current: LeadCategory | null }) {
  return (
    <ActionForm action={qualifyAction} className="space-y-2" reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap gap-1.5">
        {LEAD_CATEGORIES.map((c) => (
          <Submit key={c} name="category" value={c} className={`${seg(current === c)} capitalize`}>
            {c}
          </Submit>
        ))}
      </div>
    </ActionForm>
  );
}

export interface StaffOption {
  id: string;
  label: string;
}

export function AssignForm({ leadId, currentOwner, staff }: { leadId: string; currentOwner: string | null; staff: StaffOption[] }) {
  return (
    <ActionForm action={assignAction} reset={false}>
      <input type="hidden" name="ids" value={leadId} />
      <select name="ownerId" className="input py-2" defaultValue={currentOwner ?? ''} required>
        <option value="">Choose owner…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {currentOwner && <input name="reason" className="input py-2" placeholder="Reason for reassignment (required)" maxLength={200} />}
      <Submit className="btn-outline">{currentOwner ? 'Reassign' : 'Assign'}</Submit>
    </ActionForm>
  );
}

/** Bulk actions over the lead table (§7.6). The table's checkboxes are named `ids`. */
export function BulkForm({
  staff,
  canAssign,
  waTemplates = [],
  children,
}: {
  staff: StaffOption[];
  canAssign: boolean;
  /** bulk-capable WhatsApp templates; empty = no bulk WhatsApp for this user */
  waTemplates?: { key: string; label: string }[];
  children: ReactNode;
}) {
  const [assignState, assign] = useFormState(assignAction, {});
  const [catState, setCat] = useFormState(bulkCategoryAction, {});
  const [waState, sendWa] = useFormState(waBulkAction, {});
  const ref = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState<ActionState>({});

  const sync = () => setCount(ref.current?.querySelectorAll<HTMLInputElement>('input[name=ids]:checked').length ?? 0);
  const clear = () => {
    ref.current?.querySelectorAll<HTMLInputElement>('input[name=ids]').forEach((i) => (i.checked = false));
    sync();
  };
  useEffect(() => { setLatest(assignState); if (assignState.ok) clear(); }, [assignState]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLatest(catState); if (catState.ok) clear(); }, [catState]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLatest(waState); if (waState.ok) clear(); }, [waState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form ref={ref} onChange={sync}>
      {(canAssign || waTemplates.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2">
          <label className="flex items-center gap-2 px-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-maroon"
              onChange={(e) => {
                ref.current?.querySelectorAll<HTMLInputElement>('input[name=ids]').forEach((i) => (i.checked = e.target.checked));
                sync();
              }}
            />
            <span className="font-mono">{count}</span> selected
          </label>
          {canAssign && (
            <>
              <select name="ownerId" className="input w-auto py-1.5 text-sm" defaultValue="">
                <option value="">Assign to…</option>
                <option value="round_robin">Round-robin (telecallers)</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input name="reason" className="input w-48 py-1.5 text-sm" placeholder="Reason (if reassigning)" maxLength={200} />
              <Submit formAction={assign} className="btn-primary py-1.5">Assign</Submit>
              <span className="mx-1 h-6 w-px bg-line" />
              <select name="category" className="input w-auto py-1.5 text-sm" defaultValue="">
                <option value="">Set category…</option>
                {LEAD_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
              <Submit formAction={setCat} className="btn-outline py-1.5">Apply</Submit>
            </>
          )}
          {waTemplates.length > 0 && (
            <>
              <span className="mx-1 h-6 w-px bg-line" />
              <select name="waTemplate" className="input w-auto py-1.5 text-sm" defaultValue="">
                <option value="">WhatsApp…</option>
                {waTemplates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <Submit formAction={sendWa} className="btn-outline py-1.5">Send to opted-in</Submit>
            </>
          )}
        </div>
      )}
      <Feedback state={latest} />
      {children}
    </form>
  );
}

export function CheckInButtons({ visitId }: { visitId: string }) {
  return (
    <ActionForm action={checkInAction} className="flex flex-wrap gap-2" reset={false}>
      <input type="hidden" name="visitId" value={visitId} />
      <Submit name="status" value="arrived" className="btn-primary py-1.5">Arrived</Submit>
      <Submit name="status" value="no_show" className="btn-outline py-1.5">No-show</Submit>
    </ActionForm>
  );
}

export function VisitOutcomeForm({ visitId }: { visitId: string }) {
  return (
    <ActionForm action={visitOutcomeAction} className="space-y-2">
      <input type="hidden" name="visitId" value={visitId} />
      <textarea name="outcome" required minLength={5} maxLength={1000} className="input min-h-[60px] py-2 text-sm" placeholder="Tour done, program discussed, fees and scholarship explained, concerns raised…" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="counselled" className="h-4 w-4 accent-maroon" defaultChecked />
        Admission counselling completed
      </label>
      <Submit className="btn-primary py-1.5">Save outcome</Submit>
    </ActionForm>
  );
}

export function DevLoginForm({ staff }: { staff: { id: string; name: string; role: string }[] }) {
  return (
    <ActionForm action={loginDevAction} className="grid gap-2 sm:grid-cols-2" reset={false}>
      {staff.map((s) => (
        <Submit key={s.id} name="staffId" value={s.id} className="flex flex-col items-start rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-gold">
          <span className="font-semibold text-heading">{s.name}</span>
          <span className="text-xs text-muted">{s.role}</span>
        </Submit>
      ))}
    </ActionForm>
  );
}

export function PasswordLoginForm() {
  return (
    <ActionForm action={loginPasswordAction} reset={false}>
      <label className="block">
        <span className={lbl}>Email</span>
        <input name="email" type="email" autoComplete="username" className="input" required />
      </label>
      <label className="block">
        <span className={lbl}>Password</span>
        <input name="password" type="password" autoComplete="current-password" className="input" required />
      </label>
      <Submit className="btn-primary w-full py-3">Sign in</Submit>
    </ActionForm>
  );
}

export function SeedDemoButton() {
  return (
    <ActionForm action={seedDemoAction} reset={false}>
      <Submit className="btn-outline">Load demo leads</Submit>
    </ActionForm>
  );
}
