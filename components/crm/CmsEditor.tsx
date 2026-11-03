'use client';
import { useId, useState } from 'react';
import { saveCmsAction } from '@/app/crm/cms-actions';
import { blank, type Field } from '@/lib/cms/fields';
import { ActionForm, Submit } from './forms';

type V = Record<string, unknown>;
const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

function Scalar({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  const id = useId();
  switch (f.type) {
    case 'bool':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-maroon" />
          {f.label}
        </label>
      );
    case 'longtext':
      return (
        <label className="block" htmlFor={id}>
          <span className={lbl}>{f.label}</span>
          <textarea id={id} rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className="input text-sm" />
        </label>
      );
    case 'select':
      return (
        <label className="block" htmlFor={id}>
          <span className={lbl}>{f.label}</span>
          <select id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className="input py-2 text-sm">
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case 'strings':
      return (
        <label className="block" htmlFor={id}>
          <span className={lbl}>{f.label}</span>
          <textarea id={id} rows={4} value={((value as unknown[]) ?? []).join('\n')} onChange={(e) => onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} className="input font-mono text-sm" />
        </label>
      );
    default:
      return (
        <label className="block" htmlFor={id}>
          <span className={lbl}>{f.label}</span>
          <input
            id={id}
            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : f.type === 'url' ? 'url' : 'text'}
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => onChange(f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
            className="input py-2 text-sm"
          />
        </label>
      );
  }
}

function FieldEditor({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  if (f.type === 'group') {
    const v = (value as V) ?? {};
    return (
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold text-heading">{f.label}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {f.fields.map((x) => (
            <FieldEditor key={x.key} f={x} value={v[x.key]} onChange={(nv) => onChange({ ...v, [x.key]: nv })} />
          ))}
        </div>
      </fieldset>
    );
  }
  if (f.type === 'list') {
    const rows = (value as V[]) ?? [];
    const set = (i: number, row: V) => onChange(rows.map((r, j) => (j === i ? row : r)));
    const move = (i: number, d: number) => {
      const next = [...rows];
      const [r] = next.splice(i, 1);
      next.splice(i + d, 0, r);
      onChange(next);
    };
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-heading">
          {f.label} <span className="font-normal text-muted">({rows.length})</span>
        </legend>
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-line bg-bg p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
              <span>
                {f.itemLabel ?? 'Item'} {i + 1}
              </span>
              <span className="flex gap-3">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="underline disabled:opacity-40" aria-label={`Move ${f.itemLabel ?? 'item'} ${i + 1} up`}>
                  Up
                </button>
                <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="underline disabled:opacity-40" aria-label={`Move ${f.itemLabel ?? 'item'} ${i + 1} down`}>
                  Down
                </button>
                <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="font-semibold text-maroon underline dark:text-gold">
                  Remove
                </button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {f.of.map((x) => (
                <div key={x.key} className={x.type === 'longtext' || x.type === 'strings' || x.type === 'list' ? 'sm:col-span-2' : ''}>
                  <FieldEditor f={x} value={row[x.key]} onChange={(nv) => set(i, { ...row, [x.key]: nv })} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...rows, Object.fromEntries(f.of.map((x) => [x.key, blank(x)]))])} className="btn-outline py-1.5 text-sm">
          Add {f.itemLabel ?? 'item'}
        </button>
      </fieldset>
    );
  }
  return <Scalar f={f} value={value} onChange={onChange} />;
}

/** Edits one CMS block. The server validates against the block's schema; errors name the field. */
export function CmsEditor({ blockKey, fields, initial }: { blockKey: string; fields: Field[]; initial: V }) {
  const [value, setValue] = useState<V>(initial);
  return (
    <ActionForm action={saveCmsAction} reset={false}>
      <input type="hidden" name="key" value={blockKey} />
      <input type="hidden" name="value" value={JSON.stringify(value)} />
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <FieldEditor f={f} value={value[f.key]} onChange={(nv) => setValue({ ...value, [f.key]: nv })} />
            {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!value.sample} onChange={(e) => setValue({ ...value, sample: !e.target.checked })} className="h-4 w-4 accent-maroon" />
          This is the college’s real data (removes the “Sample data” badge)
        </label>
        <Submit className="btn-primary py-2">Save and publish</Submit>
      </div>
    </ActionForm>
  );
}
