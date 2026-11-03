'use client';
import Link from 'next/link';
import { useState } from 'react';
import { addSiblingAction } from '@/app/crm/actions';
import { programs } from '@/content/programs';
import { CLASS_OPTIONS } from '@/lib/validation';
import { ActionForm, Submit } from './forms';

export interface FamilyMember {
  id: string;
  name: string;
  program: string | null;
  status: string;
  isPrimary: boolean;
  isCurrent: boolean;
  visible: boolean;
  owner: string | null;
}

export function FamilyPanel({ leadId, members, canAdd }: { leadId: string; members: FamilyMember[]; canAdd: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-sans text-sm font-semibold text-heading">Family ({members.length} {members.length === 1 ? 'child' : 'children'})</h2>
        {canAdd && !open && (
          <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-maroon underline dark:text-gold">
            Add another child
          </button>
        )}
      </header>
      <div className="p-4">
        <ul className="space-y-2 text-sm">
          {members.map((m) => (
            <li key={m.id} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${m.isCurrent ? 'bg-gold-100/60 dark:bg-gold/10' : ''}`}>
              <span className="min-w-0">
                {m.visible && !m.isCurrent ? (
                  <Link href={`/crm/leads/${m.id}`} className="font-medium text-heading hover:underline">
                    {m.name}
                  </Link>
                ) : (
                  <span className="font-medium text-heading">{m.name}</span>
                )}
                {m.isPrimary && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted">first enquiry</span>}
                <span className="block text-xs text-muted">
                  {m.program ?? 'Program not set'} · {m.status}
                  {m.owner && ` · ${m.owner}`}
                </span>
              </span>
              {m.isCurrent && <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">this lead</span>}
            </li>
          ))}
        </ul>
        {open && (
          <ActionForm action={addSiblingAction} className="mt-3 space-y-2 border-t border-line pt-3" reset={false}>
            <input type="hidden" name="leadId" value={leadId} />
            <p className="text-xs text-muted">Each child gets their own lead (visit, decision, documents, fees and College ID) under the same parent number and owner.</p>
            <input name="studentName" required minLength={2} maxLength={80} placeholder="Child’s name" className="input py-1.5 text-sm" autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <select name="classLevel" defaultValue="" className="input py-1.5 text-sm">
                <option value="">Class…</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select name="program" defaultValue="" className="input py-1.5 text-sm">
                <option value="">Program…</option>
                {programs.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.short}
                  </option>
                ))}
              </select>
            </div>
            <input name="school" maxLength={120} placeholder="School (optional)" className="input py-1.5 text-sm" />
            <div className="flex gap-2">
              <Submit className="btn-primary flex-1 py-1.5">Add child</Submit>
              <button type="button" className="btn-outline py-1.5" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </ActionForm>
        )}
      </div>
    </section>
  );
}
