import Link from 'next/link';
import type { ReactNode } from 'react';
import { getProgram } from '@/content/programs';
import type { FollowUpInfo } from '@/lib/crm/rules';
import { STATUS_LABELS, type LeadCategory, type LeadStatus } from '@/lib/crm/types';
import { formatDateTime } from '@/lib/dates';

const CAT_STYLE: Record<LeadCategory, string> = {
  hot: 'bg-maroon text-white',
  warm: 'bg-gold text-navy-950',
  cold: 'bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-100',
  invalid: 'bg-line text-muted line-through',
};

export function CategoryBadge({ category }: { category: LeadCategory | null }) {
  if (!category) return <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Unqualified</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${CAT_STYLE[category]}`}>{category}</span>;
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const closed = status === 'lost' || status === 'invalid';
  const good = status === 'confirmed' || status === 'admitted';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${good ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100' : closed ? 'bg-line text-muted' : 'bg-navy/10 text-navy dark:bg-white/10 dark:text-white'}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const ESC_LABEL = ['', 'Overdue', 'Overdue 24h+ · supervisor', 'Overdue 48h+ · management'];

export function FollowUpBadge({ f }: { f: FollowUpInfo }) {
  if (f.state === 'closed') return <span className="text-xs text-muted">Closed</span>;
  if (f.state === 'overdue') {
    return (
      <span className="flex flex-col">
        <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.escalation >= 2 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 dark:bg-red-400/20 dark:text-red-100'}`}>{ESC_LABEL[f.escalation]}</span>
        <span className="mt-0.5 text-[11px] text-muted">{f.overdueHours < 48 ? `${f.overdueHours}h late` : `${Math.floor(f.overdueHours / 24)}d late`}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col">
      <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.state === 'today' ? 'bg-gold-100 text-navy' : 'bg-bg text-muted'}`}>{f.state === 'today' ? 'Due today' : 'Upcoming'}</span>
      {f.dueAt && <span className="mt-0.5 text-[11px] text-muted">{formatDateTime(f.dueAt)}</span>}
    </span>
  );
}

export function programShort(slug: string | null) {
  return slug ? getProgram(slug)?.short ?? slug : '—';
}

export function sourceLabel(s: string) {
  return s.replace(/_/g, ' ');
}

export function Panel({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="font-sans text-sm font-semibold text-heading">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone = 'default', href }: { label: string; value: number | string; tone?: 'default' | 'alert' | 'warn' | 'good'; href?: string }) {
  const toneCls = {
    default: 'text-heading',
    alert: 'text-red-600 dark:text-red-300',
    warn: 'text-maroon dark:text-gold',
    good: 'text-emerald-700 dark:text-emerald-300',
  }[tone];
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-semibold ${toneCls}`}>{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl border border-line bg-surface p-4 transition hover:border-gold">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-line bg-surface p-4">{body}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
