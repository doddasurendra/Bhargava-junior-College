import Link from 'next/link';
import { Panel } from '@/components/crm/ui';
import { getContent } from '@/lib/cms';
import { BLOCK_KEYS, BLOCKS, canEditBlock } from '@/lib/cms/blocks';
import { blockMeta } from '@/lib/cms/store';
import { requireStaff } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';
import { ROLE_LABELS } from '@/lib/crm/types';
import { formatDateTime } from '@/lib/dates';
import { getRecordStore } from '@/lib/records';

export const metadata = { title: 'Website content' };

export default async function CmsPage() {
  const user = await requireStaff();
  const [content, meta, staff] = await Promise.all([getContent(), blockMeta(getRecordStore()), getCrmRepo().listAllStaff()]);
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const mine = BLOCK_KEYS.filter((k) => canEditBlock(user.roles, k));
  const stillSample = BLOCK_KEYS.filter((k) => (content[k] as { sample: boolean }).sample);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Website content</h1>
        <p className="text-sm text-muted">
          Everything parents see that the college must confirm before launch. {stillSample.length} of {BLOCK_KEYS.length} blocks still show the “Sample data” badge.
        </p>
      </div>
      {mine.length === 0 ? (
        <p className="text-sm text-muted">Your role doesn’t edit website content.</p>
      ) : (
        <Panel title="Blocks you can edit">
          <ul className="-my-2 divide-y divide-line">
            {mine.map((k) => {
              const m = meta.get(k);
              const sample = (content[k] as { sample: boolean }).sample;
              return (
                <li key={k} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/crm/cms/${k}`} className="font-semibold text-heading hover:underline">
                      {BLOCKS[k].title}
                    </Link>
                    <p className="text-xs text-muted">{BLOCKS[k].description}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {m ? `Saved ${formatDateTime(m.updatedAt)} by ${names.get(m.updatedBy) ?? 'staff'}` : 'Never saved: showing the sample default'} · editors: {BLOCKS[k].editors.map((r) => ROLE_LABELS[r]).join(', ')}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sample ? 'bg-gold-100 text-ink dark:bg-gold/15 dark:text-gold-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>{sample ? 'Sample data' : 'Real data'}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
