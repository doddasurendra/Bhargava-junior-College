import Link from 'next/link';
import type { ReactNode } from 'react';

type B = { id: string; title: string; authors: string[]; kind: string; coverUrl: string | null; fileKey: string | null; previewUrl: string | null; year: string | null; edition?: string | null; licence?: string };

export const KindBadge = ({ kind }: { kind: string }) => (
  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${kind === 'official' ? 'bg-emerald-100 text-emerald-900' : kind === 'institution' ? 'bg-navy/10 text-navy dark:bg-gold/20 dark:text-gold' : 'bg-bg text-muted'}`}>{kind === 'official' ? 'Official' : kind === 'institution' ? 'BJC' : 'Reference'}</span>
);

export function BookTile({ b, reason }: { b: B; reason?: string }) {
  return (
    <Link href={`/app/openbook/book/${b.id}`} className="card flex gap-2 p-2">
      {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover" /> : <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-navy text-[10px] font-semibold text-white dark:bg-gold dark:text-navy-950">BJC</div>}
      <div className="min-w-0">
        <KindBadge kind={b.kind} />
        <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-heading">{b.title}</p>
        <p className="truncate text-[11px] text-muted">{b.authors.join(', ') || '—'}{b.year ? ` · ${b.year}` : ''}</p>
        <p className="text-[10px] text-muted">{b.fileKey ? 'Read in app' : b.previewUrl ? 'Preview' : 'Details & link'}</p>
        {reason && <p className="text-[10px] italic text-muted">{reason}</p>}
      </div>
    </Link>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-2 text-sm">
      {page > 1 && <Link className="btn-outline px-3 py-1" href={href(page - 1)}>Previous</Link>}
      <span className="text-muted">Page {page} of {pages}</span>
      {page < pages && <Link className="btn-outline px-3 py-1" href={href(page + 1)}>Next</Link>}
    </nav>
  );
}

export const ComingSoon = ({ what }: { what: string }) => (
  <div className="card space-y-1 p-4 text-sm"><span className="inline-block rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900">Coming soon</span><p>{what} is being prepared. It appears here once the college has added the content; nothing is shown before it is ready.</p></div>
);

export const H1 = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (<header><h1 className="font-display text-2xl text-heading">{children}</h1>{sub && <p className="text-sm text-muted">{sub}</p>}</header>);
