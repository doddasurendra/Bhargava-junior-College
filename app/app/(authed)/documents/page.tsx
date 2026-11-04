import { uploadDocAction } from '@/app/app/portal-actions';
import { UploadForm } from './UploadForm';
import { documentsFor } from '@/lib/app/flows';
import { requireApplicant } from '@/lib/app/portal';
import { getContent } from '@/lib/cms';
import { getCrmRepo } from '@/lib/crm/repo';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Documents' };

export default async function DocumentsPage() {
  const { p } = await requireApplicant();
  const [{ documentChecklist }, uploaded, v] = await Promise.all([getContent(), documentsFor(p.leadId), getCrmRepo().getVerification(p.leadId)]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Documents</h1>
      <p className="text-sm text-muted">Upload a clear photo or PDF of each (up to 5 MB). Bring the originals when the admission office asks. DigiLocker fetch is offered at the office once it is connected.</p>
      <ul className="space-y-2">
        {documentChecklist.default.map((d) => {
          const up = uploaded.find((u) => u.key === d.key);
          const verified = v.documents.find((x) => x.key === d.key);
          return (
            <li key={d.key} className="card p-3 text-sm">
              <p className="font-medium text-heading">{d.label}{d.required ? '' : ' (if applicable)'}</p>
              <p className="text-[11px] text-muted">
                {verified?.status === 'verified' ? 'Verified by the admission office' : verified?.status === 'rejected' ? `Needs a new copy: ${verified.note ?? ''}` : up ? `Uploaded ${formatDateTime(up.uploadedAt)}: waiting for verification` : 'Not uploaded'}
              </p>
              {verified?.status !== 'verified' && <UploadForm action={uploadDocAction} docKey={d.key} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
