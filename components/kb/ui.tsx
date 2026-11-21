import type { QField } from '@/components/crm/QuickForm';
import type { Lang } from '@/lib/i18n';
import { LEVELS, SENSITIVITY, type Viewer, allowedLevels } from '@/lib/kb/access';
import { CENTRES, DEPARTMENTS, centreById } from '@/lib/kb/centres';
import { CHANNELS, TYPES, type Article } from '@/lib/kb/collections';
import { LEVEL_LABEL, SENSITIVITY_LABEL, STATUS_LABEL } from '@/lib/kb/i18n';

const PILL: Record<string, string> = {
  draft: 'bg-line text-muted',
  review: 'bg-gold-100 text-navy',
  approved: 'bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-100',
  published: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100',
  archived: 'bg-line text-muted line-through',
};
export function StatusPill({ status, lang }: { status: string; lang: Lang }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[status] ?? ''}`}>{STATUS_LABEL[status]?.[lang] ?? status}</span>;
}
export function AccessPill({ access, sensitivity, lang }: { access: string; sensitivity: string; lang: Lang }) {
  const tone = sensitivity === 'restricted' ? 'border-maroon text-maroon dark:border-red-300 dark:text-red-300' : sensitivity === 'confidential' ? 'border-gold text-navy dark:text-gold' : 'border-line text-muted';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
      {LEVEL_LABEL[access]?.[lang] ?? access} · {SENSITIVITY_LABEL[sensitivity]?.[lang] ?? sensitivity}
    </span>
  );
}
export function SamplePill({ show, label }: { show: boolean; label: string }) {
  return show ? <span className="rounded-full border border-dashed border-maroon px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-maroon dark:border-gold dark:text-gold">{label}</span> : null;
}

/** Field list for the article editor (QuickForm). Only levels the editor can read are offered. */
export function articleFields(v: Viewer, lang: Lang, a: Partial<Article> | null, centreId: string, opts: { categories: { id: string; name: string }[]; staff: { id: string; name: string }[] }): QField[] {
  const centre = centreById(centreId) ?? centreById('student')!;
  const levels = allowedLevels(v);
  return [
    { name: 'titleEn', label: 'Title (English)', type: 'text', required: true, maxLength: 200, defaultValue: a?.title?.en ?? '', wide: true },
    { name: 'titleTe', label: 'శీర్షిక (తెలుగు)', type: 'text', maxLength: 200, defaultValue: a?.title?.te ?? '' },
    { name: 'titleHi', label: 'शीर्षक (हिंदी)', type: 'text', maxLength: 200, defaultValue: a?.title?.hi ?? '' },
    { name: 'centre', label: 'Centre', type: 'select', required: true, defaultValue: centre.id, options: CENTRES.filter((c) => c.kind === 'content' || c.id === 'core').map((c) => ({ value: c.id, label: `${c.icon} ${c.name[lang]}` })) },
    { name: 'topic', label: 'Topic', type: 'select', defaultValue: a?.topic ?? '', options: [{ value: '', label: '—' }, ...centre.topics.map((t) => ({ value: t.key, label: `${t.t[lang]}${t.note ? ` (${t.note})` : ''}` }))] },
    { name: 'type', label: 'Type', type: 'select', defaultValue: a?.type ?? 'article', options: TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })) },
    { name: 'access', label: 'Who can read it (access level)', type: 'select', required: true, defaultValue: a?.access ?? centre.defaultAccess, options: LEVELS.filter((l) => levels.includes(l)).map((l) => ({ value: l, label: LEVEL_LABEL[l][lang] })) },
    { name: 'sensitivity', label: 'Sensitivity label', type: 'select', required: true, defaultValue: a?.sensitivity ?? (centre.defaultAccess === 'public' ? 'public' : 'internal'), options: SENSITIVITY.map((s) => ({ value: s, label: SENSITIVITY_LABEL[s][lang] })) },
    { name: 'reviewBy', label: 'Review by', type: 'date', defaultValue: a?.reviewBy ?? '' },
    { name: 'categoryId', label: 'Category', type: 'select', defaultValue: a?.categoryId ?? '', options: [{ value: '', label: '—' }, ...opts.categories.map((c) => ({ value: c.id, label: c.name }))] },
    { name: 'department', label: 'Subject department', type: 'select', defaultValue: a?.department ?? '', options: [{ value: '', label: '—' }, ...DEPARTMENTS.map((d) => ({ value: d.id, label: d.name[lang] }))] },
    { name: 'campus', label: 'Campus', type: 'select', defaultValue: a?.campus ?? '', options: [{ value: '', label: 'All campuses' }, { value: 'girls_bairamalguda', label: 'Girls · Bairamalguda' }, { value: 'boys_kuntloor', label: 'Boys · Kuntloor' }, { value: 'day_lb_nagar', label: 'Day scholar · LB Nagar' }] },
    { name: 'tags', label: 'Tags (comma separated)', type: 'text', defaultValue: (a?.tags ?? []).join(', '), maxLength: 300 },
    ...CHANNELS.map((c): QField => ({ name: `ch_${c}`, label: { website: 'Website & public chatbot', app: 'Student/parent app', bot: 'Chatbot & voice agent', staff: 'Staff (CRM)' }[c], type: 'checkbox', defaultChecked: a?.channels ? a.channels.includes(c) : c === 'staff' || (centre.defaultAccess !== 'faculty' && c === 'app') })),
    { name: 'bodyEn', label: 'Text (English) — use ## headings for sections', type: 'textarea', required: true, rows: 12, maxLength: 20000, defaultValue: a?.body?.en ?? '', wide: true },
    { name: 'bodyTe', label: 'వివరణ (తెలుగు)', type: 'textarea', rows: 6, maxLength: 20000, defaultValue: a?.body?.te ?? '', wide: true },
    { name: 'bodyHi', label: 'विवरण (हिंदी)', type: 'textarea', rows: 6, maxLength: 20000, defaultValue: a?.body?.hi ?? '', wide: true },
  ].filter((f) => !(f.name === 'categoryId' && !opts.categories.length)) as QField[];
}

export const fmtBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Renders article text: ## headings become headings; paragraphs keep their line breaks. */
export function Body({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-6 text-ink">
      {blocks.map((b, i) => {
        const h = b.match(/^(#{2,4})\s+(.*)$/m);
        if (h && b.trim().startsWith('#')) {
          const rest = b.replace(/^#{2,4}\s+.*$/m, '').trim();
          return (
            <div key={i}>
              <h3 className="font-semibold text-heading">{h[2]}</h3>
              {rest && <p className="mt-1 whitespace-pre-line">{rest}</p>}
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {b.replace(/^_(.*)_$/s, '$1')}
          </p>
        );
      })}
    </div>
  );
}
