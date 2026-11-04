import { getStaffSession } from '@/lib/crm/auth';
import { receiptPdf } from '@/lib/crm/receiptPdf';
import { CrmError } from '@/lib/crm/service';
import { receiptFor } from '@/lib/crm/verifyService';

export const dynamic = 'force-dynamic';

/** Official receipt as a PDF file (same access rules as the receipt page). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStaffSession();
  if (!user) return new Response('Not found', { status: 404 });
  try {
    const d = await receiptFor(user, params.id);
    const pdf = await receiptPdf(d.payment, d.student, d.lead);
    return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="receipt-${(d.payment.receiptNo ?? params.id).replace(/[^\w-]+/g, '-')}.pdf"`, 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    if (e instanceof CrmError || (e instanceof Error && /No receipt/.test(e.message))) return new Response('Not found', { status: 404 });
    throw e;
  }
}
