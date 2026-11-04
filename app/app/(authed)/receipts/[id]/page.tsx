import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/crm/receipts/[id]/PrintButton';
import { ReceiptDoc } from '@/components/ReceiptDoc';
import { canSeePayment, leadOf, profileData, requireAppUser } from '@/lib/app/service';

export const metadata = { title: 'Receipt' };

export default async function AppReceipt({ params }: { params: { id: string } }) {
  const u = await requireAppUser();
  // Only receipts for this phone's own children / application.
  const payment = await canSeePayment(u, params.id);
  if (!payment) notFound();
  const profile = u.profiles.find((p) => leadOf(p) === payment.leadId)!;
  const d = await profileData(profile);
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 print:hidden">
        <a href={`/app/receipts/${params.id}/pdf`} className="btn-outline py-2">Download PDF</a>
        <PrintButton />
      </div>
      <ReceiptDoc payment={payment} student={d.student} lead={d.lead} />
    </div>
  );
}
