import { canSeePayment, getAppUser, leadOf, profileData } from '@/lib/app/service';
import { receiptPdf } from '@/lib/crm/receiptPdf';

export const dynamic = 'force-dynamic';

/** A parent's / student's own receipt as a PDF file; only payments for this phone's children. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await getAppUser();
  if (!u) return new Response('Not found', { status: 404 });
  const payment = await canSeePayment(u, params.id);
  if (!payment?.receiptNo) return new Response('Not found', { status: 404 });
  const profile = u.profiles.find((p) => leadOf(p) === payment.leadId);
  if (!profile) return new Response('Not found', { status: 404 });
  const d = await profileData(profile);
  const pdf = await receiptPdf(payment, d.student, d.lead);
  return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="receipt-${payment.receiptNo.replace(/[^\w-]+/g, '-')}.pdf"`, 'Cache-Control': 'private, no-store' } });
}
