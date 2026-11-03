'use client';
import { addSpendAction } from '@/app/crm/report-actions';
import { ActionForm, Submit } from './forms';

const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

export function SpendForm({ sources }: { sources: { value: string; label: string }[] }) {
  return (
    <ActionForm action={addSpendAction} className="grid gap-3 sm:grid-cols-4">
      <label className="block">
        <span className={lbl}>Month</span>
        <input name="month" type="month" required className="input py-2 text-sm" />
      </label>
      <label className="block">
        <span className={lbl}>Source</span>
        <select name="source" required className="input py-2 text-sm capitalize">
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={lbl}>Amount (₹)</span>
        <input name="amount" type="number" min={0} step={1} required className="input py-2 text-sm" />
      </label>
      <label className="block">
        <span className={lbl}>Note</span>
        <input name="note" maxLength={200} className="input py-2 text-sm" />
      </label>
      <div className="sm:col-span-4">
        <Submit className="btn-primary py-2">Record spend</Submit>
      </div>
    </ActionForm>
  );
}
