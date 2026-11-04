import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CmsEditor } from '@/components/crm/CmsEditor';
import { RestoreVersionForm } from '@/components/crm/CmsRestore';
import { Panel } from '@/components/crm/ui';
import { getContent } from '@/lib/cms';
import { BLOCK_KEYS, BLOCKS, canEditBlock, type BlockKey } from '@/lib/cms/blocks';
import { blockHistory } from '@/lib/cms/store';
import { requireStaff } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';
import { formatDateTime } from '@/lib/dates';
import { getRecordStore } from '@/lib/records';

export const metadata = { title: 'Edit content' };

export default async function CmsBlockPage({ params }: { params: { key: string } }) {
  const user = await requireStaff();
  if (!BLOCK_KEYS.includes(params.key as BlockKey)) notFound();
  const key = params.key as BlockKey;
  if (!canEditBlock(user.roles, key)) {
    // A friendly refusal instead of a crash page when someone opens a block link their role can't edit.
    return (
      <div className="max-w-4xl space-y-4">
        <Link href="/crm/cms" className="text-sm text-muted underline">
          ← Website content
        </Link>
        <Panel title={BLOCKS[key].title}>
          <p className="text-sm text-muted">Your role can’t edit this content. Ask a Super Admin or the content team to make the change.</p>
        </Panel>
      </div>
    );
  }
  const [content, history, staff] = await Promise.all([getContent(), blockHistory(getRecordStore(), key), getCrmRepo().listAllStaff()]);
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const b = BLOCKS[key];

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/crm/cms" className="text-sm text-muted underline">
        ← Website content
      </Link>
      <div>
        <h1 className="font-display text-3xl text-heading">{b.title}</h1>
        <p className="text-sm text-muted">{b.description}</p>
      </div>
      <Panel>
        <CmsEditor blockKey={key} fields={b.fields} initial={content[key] as Record<string, unknown>} />
      </Panel>
      {history.length > 0 && (
        <Panel title="Earlier versions">
          <ul className="-my-2 divide-y divide-line text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  {formatDateTime(h.savedAt)} · {names.get(h.updatedBy) ?? 'staff'}
                </span>
                <RestoreVersionForm blockKey={key} historyId={h.id} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
