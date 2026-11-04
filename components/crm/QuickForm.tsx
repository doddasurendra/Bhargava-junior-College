'use client';
import type { ActionState } from '@/app/crm/actions';
import { ActionForm, Submit } from './forms';

export type QField =
  | { name: string; label: string; type: 'text' | 'tel' | 'email' | 'url' | 'date' | 'time' | 'month' | 'datetime-local' | 'password'; required?: boolean; defaultValue?: string; placeholder?: string; maxLength?: number; wide?: boolean }
  | { name: string; label: string; type: 'number'; required?: boolean; defaultValue?: string; min?: number; max?: number; step?: number; wide?: boolean }
  | { name: string; label: string; type: 'textarea'; required?: boolean; defaultValue?: string; maxLength?: number; rows?: number; wide?: boolean }
  | { name: string; label: string; type: 'select'; required?: boolean; defaultValue?: string; options: { value: string; label: string }[]; wide?: boolean }
  | { name: string; label: string; type: 'checkbox'; defaultChecked?: boolean; wide?: boolean }
  | { name: string; type: 'hidden'; value: string };

const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

/** A small server-action form from a field list — used across the staff portals. */
export function QuickForm({ action, fields, submit, cols = 2, reset = true }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; fields: QField[]; submit: string; cols?: 1 | 2 | 3 | 4; reset?: boolean }) {
  const grid = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[cols];
  return (
    <ActionForm action={action} reset={reset} className="space-y-3">
      <div className={`grid gap-3 ${grid}`}>
        {fields.map((f) => {
          if (f.type === 'hidden') return <input key={f.name} type="hidden" name={f.name} value={f.value} />;
          const span = f.wide ? 'sm:col-span-full' : '';
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className={`flex items-center gap-2 self-end pb-2 text-sm ${span}`}>
                <input type="checkbox" name={f.name} defaultChecked={f.defaultChecked} className="h-4 w-4 accent-maroon" />
                {f.label}
              </label>
            );
          return (
            <label key={f.name} className={`block ${span}`}>
              <span className={lbl}>{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea name={f.name} required={f.required} defaultValue={f.defaultValue} maxLength={f.maxLength ?? 2000} rows={f.rows ?? 3} className="input text-sm" />
              ) : f.type === 'select' ? (
                <select name={f.name} required={f.required} defaultValue={f.defaultValue} className="input py-2 text-sm">
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'number' ? (
                <input name={f.name} type="number" required={f.required} defaultValue={f.defaultValue} min={f.min} max={f.max} step={f.step ?? 1} className="input py-2 text-sm" />
              ) : (
                <input name={f.name} type={f.type} required={f.required} defaultValue={f.defaultValue} placeholder={f.placeholder} maxLength={f.maxLength ?? 200} className="input py-2 text-sm" />
              )}
            </label>
          );
        })}
      </div>
      <Submit className="btn-primary py-2">{submit}</Submit>
    </ActionForm>
  );
}

/** One-button form (e.g. Approve / Publish) with an optional hidden payload. */
export function ActionButton({ action, label, hidden = {}, className = 'btn-outline py-1.5 text-sm' }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; label: string; hidden?: Record<string, string>; className?: string }) {
  return (
    <ActionForm action={action} reset={false} quiet className="inline">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Submit className={className}>{label}</Submit>
    </ActionForm>
  );
}
