'use client';
import { useState } from 'react';
import { collegeIdAction, documentAction, paymentAction, paymentDecisionAction, receiptAction, reversalDecisionAction, reversalRequestAction, signOffAction, studentAction } from '@/app/crm/verify-actions';
import { programs } from '@/content/programs';
import { PAYMENT_MODES } from '@/content/sample';
import { ActionForm, Submit } from './forms';

const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

export function SignOffForm({ leadId, stage, label }: { leadId: string; stage: 'application' | 'documents' | 'fee'; label: string }) {
  return (
    <ActionForm action={signOffAction} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="stage" value={stage} />
      <input name="note" maxLength={300} placeholder="Note (optional)" className="input w-64 py-1.5 text-sm" />
      <Submit className="btn-primary py-1.5">{label}</Submit>
    </ActionForm>
  );
}

export function DocumentButtons({ leadId, docKey, required }: { leadId: string; docKey: string; required: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  return (
    <ActionForm action={documentAction} className="flex flex-wrap items-center gap-1.5" reset={false} quiet>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="docKey" value={docKey} />
      {rejecting ? (
        <>
          <input name="note" required maxLength={200} placeholder="Why rejected?" className="input w-44 py-1 text-xs" />
          <Submit name="status" value="rejected" className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Reject</Submit>
          <button type="button" className="text-xs underline" onClick={() => setRejecting(false)}>Cancel</button>
        </>
      ) : (
        <>
          <Submit name="status" value="received" className="rounded-lg border border-line px-2.5 py-1 text-xs hover:border-gold">Received</Submit>
          <Submit name="status" value="verified" className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">Verified</Submit>
          {!required && <Submit name="status" value="not_applicable" className="rounded-lg border border-line px-2.5 py-1 text-xs hover:border-gold">N/A</Submit>}
          <button type="button" className="rounded-lg border border-line px-2.5 py-1 text-xs text-red-700 hover:border-red-400 dark:text-red-300" onClick={() => setRejecting(true)}>
            Reject…
          </button>
        </>
      )}
    </ActionForm>
  );
}

export function PaymentForm({ leadId, today, approvesDirectly }: { leadId: string; today: string; approvesDirectly: boolean }) {
  const [mode, setMode] = useState('upi');
  return (
    <ActionForm action={paymentAction} className="grid gap-2 sm:grid-cols-5">
      <input type="hidden" name="leadId" value={leadId} />
      <label>
        <span className={lbl}>Amount (₹)</span>
        <input name="amount" inputMode="numeric" required className="input py-1.5 font-mono text-sm" placeholder="50000" />
      </label>
      <label>
        <span className={lbl}>Mode</span>
        <select name="mode" className="input py-1.5 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
          {PAYMENT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={lbl}>{mode === 'cheque' ? 'Cheque / DD no.' : 'UTR / reference'}</span>
        <input name="reference" required={mode !== 'cash'} maxLength={80} className="input py-1.5 font-mono text-sm" />
      </label>
      <label>
        <span className={lbl}>Paid on</span>
        <input name="paidOn" type="date" max={today} defaultValue={today} required className="input py-1.5 font-mono text-sm" />
      </label>
      <div className="flex items-end">
        <Submit className="btn-primary w-full py-1.5">{approvesDirectly ? 'Record & approve' : 'Record payment'}</Submit>
      </div>
    </ActionForm>
  );
}

export function PaymentDecision({ leadId, paymentId }: { leadId: string; paymentId: string }) {
  return (
    <ActionForm action={paymentDecisionAction} className="flex gap-1.5" reset={false} quiet>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <Submit name="decision" value="approve" className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">Approve</Submit>
      <Submit name="decision" value="reject" className="rounded-lg border border-line px-2.5 py-1 text-xs text-red-700 dark:text-red-300">Reject</Submit>
    </ActionForm>
  );
}

export function ReceiptButton({ leadId }: { leadId: string }) {
  return (
    <ActionForm action={receiptAction} reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      <Submit className="btn-primary py-1.5">Generate official receipt</Submit>
    </ActionForm>
  );
}

export interface StudentDefaults {
  fullName: string;
  program: string;
  guardianName: string;
  guardianPhone: string;
}

export function StudentForm({ leadId, defaults }: { leadId: string; defaults: StudentDefaults }) {
  return (
    <ActionForm action={studentAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      <label className="sm:col-span-2">
        <span className={lbl}>Full name (as on SSC memo)</span>
        <input name="fullName" defaultValue={defaults.fullName} required maxLength={100} className="input py-1.5 text-sm" />
      </label>
      <label>
        <span className={lbl}>Date of birth</span>
        <input name="dob" type="date" required className="input py-1.5 font-mono text-sm" />
      </label>
      <label>
        <span className={lbl}>Gender</span>
        <select name="gender" required defaultValue="" className="input py-1.5 text-sm">
          <option value="" disabled>Choose…</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        <span className={lbl}>Program</span>
        <select name="program" required defaultValue={defaults.program} className="input py-1.5 text-sm">
          <option value="" disabled>Choose…</option>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={lbl}>Stay</span>
        <select name="stay" required defaultValue="" className="input py-1.5 text-sm">
          <option value="" disabled>Choose…</option>
          <option value="day">Day scholar</option>
          <option value="hostel">Hostel</option>
        </select>
      </label>
      <label>
        <span className={lbl}>Guardian name</span>
        <input name="guardianName" defaultValue={defaults.guardianName} required maxLength={100} className="input py-1.5 text-sm" />
      </label>
      <label>
        <span className={lbl}>Guardian mobile</span>
        <input name="guardianPhone" defaultValue={defaults.guardianPhone} required className="input py-1.5 font-mono text-sm" />
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <Submit className="btn-primary py-1.5">Create student record</Submit>
      </div>
    </ActionForm>
  );
}

export function ReversalRequest({ leadId, stage }: { leadId: string; stage: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="text-xs text-muted underline hover:text-ink" onClick={() => setOpen(true)}>
        Request reversal
      </button>
    );
  return (
    <ActionForm action={reversalRequestAction} className="flex flex-wrap items-start gap-2" reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="stage" value={stage} />
      <input name="reason" required minLength={5} maxLength={300} placeholder="What was signed off wrongly?" className="input w-72 py-1.5 text-sm" autoFocus />
      <Submit className="btn-outline py-1.5">Send for approval</Submit>
      <button type="button" className="py-1.5 text-xs underline" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </ActionForm>
  );
}

export function ReversalDecision({ leadId, reversalId }: { leadId: string; reversalId: string }) {
  return (
    <ActionForm action={reversalDecisionAction} className="flex flex-wrap items-start gap-2" reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="reversalId" value={reversalId} />
      <input name="note" maxLength={300} placeholder="Note (optional)" className="input w-56 py-1.5 text-sm" />
      <Submit name="decision" value="approve" className="btn-primary py-1.5">Approve reversal</Submit>
      <Submit name="decision" value="reject" className="btn-outline py-1.5">Reject</Submit>
    </ActionForm>
  );
}

export function CollegeIdButton({ leadId, disabled }: { leadId: string; disabled: boolean }) {
  return (
    <ActionForm action={collegeIdAction} reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      {disabled ? (
        <button type="button" disabled className="btn cursor-not-allowed bg-line px-6 py-2.5 text-muted" aria-disabled="true">
          Generate College ID
        </button>
      ) : (
        <Submit className="btn-gold px-6 py-2.5">Generate College ID</Submit>
      )}
    </ActionForm>
  );
}
