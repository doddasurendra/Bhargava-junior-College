'use client';
import { useState } from 'react';
import { waOptInAction, waSendAction } from '@/app/crm/wa-actions';
import { ActionForm, Submit } from './forms';

export interface WaOption {
  key: string;
  name: string;
  label: string;
  preview: string | null;
  unavailable: string | null;
}

export function WaSendForm({ leadId, options, disabled }: { leadId: string; options: WaOption[]; disabled: string | null }) {
  const [key, setKey] = useState(options.find((o) => !o.unavailable)?.key ?? options[0]?.key ?? '');
  const opt = options.find((o) => o.key === key);
  return (
    <ActionForm action={waSendAction} reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      <select name="template" value={key} onChange={(e) => setKey(e.target.value)} className="input py-2 text-sm">
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.name.replace(/^bjc_/, '').replace(/_/g, ' ')}
            {o.unavailable ? ' (unavailable)' : ''}
          </option>
        ))}
      </select>
      {opt && (
        <div className="rounded-xl bg-[#E7FFDB] p-3 text-sm text-[#111B21] [overflow-wrap:anywhere] dark:bg-[#005C4B] dark:text-white">
          {opt.preview ?? <span className="italic opacity-70">{opt.unavailable}</span>}
        </div>
      )}
      {disabled ? <p className="text-xs text-muted">{disabled}</p> : <Submit className="btn-primary w-full py-2">{opt?.unavailable ? 'Unavailable' : 'Send on WhatsApp'}</Submit>}
    </ActionForm>
  );
}

export function WaOptInForm({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-maroon underline dark:text-gold">
        Record opt-in
      </button>
    );
  return (
    <ActionForm action={waOptInAction} reset={false}>
      <input type="hidden" name="leadId" value={leadId} />
      <input name="note" required minLength={5} maxLength={200} placeholder="How and when they agreed, e.g. “Parent agreed on call”" className="input py-1.5 text-sm" />
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="attest" className="mt-0.5 h-4 w-4 accent-maroon" required />I confirm the family agreed to receive admission updates from {''}
        Bhargava Junior College on WhatsApp.
      </label>
      <Submit className="btn-outline py-1.5">Save consent</Submit>
    </ActionForm>
  );
}
