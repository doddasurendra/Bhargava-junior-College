import { publishNoticeAction } from '@/app/crm/school-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { notices } from '@/lib/records/collections';
import { allBatches, store } from '@/lib/school/common';

export const metadata = { title: 'Notices' };

export default async function NoticesPage() {
  const user = await requireStaff();
  const [list, batchList] = await Promise.all([notices.list(store()), allBatches()]);
  const label = (a: string) => (a.startsWith('batch:') ? batchList.find((b) => b.id === a.slice(6))?.data.name ?? 'batch' : a);
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="font-display text-3xl text-heading">Notices & circulars</h1>
      {can(user, 'notices.publish') && (
        <Panel title="Publish">
          <QuickForm action={publishNoticeAction} submit="Publish" fields={[
            { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
            { name: 'audience', label: 'For', type: 'select', options: [{ value: 'all', label: 'Everyone' }, { value: 'parents', label: 'Parents' }, { value: 'students', label: 'Students' }, { value: 'staff', label: 'Staff' }, ...batchList.map((b) => ({ value: `batch:${b.id}`, label: `Batch ${b.data.name}` }))] },
            { name: 'notify', label: 'Also send on WhatsApp to parents', type: 'checkbox' },
            { name: 'body', label: 'Text', type: 'textarea', required: true, wide: true, rows: 5 },
            { name: 'attachmentUrl', label: 'Attachment link (PDF)', type: 'url', wide: true },
          ]} />
        </Panel>
      )}
      <Panel title="Published">
        {list.length === 0 ? <Empty>Nothing published yet.</Empty> : (
          <ul className="-my-2 divide-y divide-line">
            {list.map((n) => (
              <li key={n.id} className="py-3 text-sm">
                <p className="font-semibold text-heading">{n.data.title}</p>
                <p className="text-xs text-muted">{formatDate(n.data.date)} · for {label(n.data.audience)}</p>
                <p className="mt-1 whitespace-pre-line">{n.data.body}</p>
                {n.data.attachmentUrl && <a href={n.data.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Attachment</a>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
