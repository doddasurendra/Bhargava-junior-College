import { notFound } from 'next/navigation';
import { ReceiptDoc } from '@/components/ReceiptDoc';
import { requireStaff } from '@/lib/crm/auth';
import { CrmError } from '@/lib/crm/service';
import { receiptFor } from '@/lib/crm/verifyService';
import { PrintButton } from './PrintButton';

export const metadata = { title: 'Receipt' };
export const dynamic = 'force-dynamic';

/** Printable official receipt on the letterhead. Save as PDF from the browser's print dialog (phase 1). */
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const user = await requireStaff();
  let data;
  try {
    data = await receiptFor(user, params.id);
  } catch (e) {
    if (e instanceof CrmError) notFound();
    throw e;
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <PrintButton />
      </div>
      <ReceiptDoc payment={data.payment} student={data.student} lead={data.lead} />
    </main>
  );
}
