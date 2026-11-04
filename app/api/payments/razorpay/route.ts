import { recordGatewayPayment } from '@/lib/app/flows';
import { verifyWebhookSignature } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * Razorpay webhook (payment.captured). Configure in the Razorpay dashboard with the secret in
 * RAZORPAY_WEBHOOK_SECRET. The order's notes carry the lead id; recording is idempotent per payment id,
 * so the checkout callback and this webhook can both arrive.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature') ?? '')) return new Response('invalid signature', { status: 401 });
  let body: { event?: string; payload?: { payment?: { entity?: { id: string; amount: number; method: string; notes?: Record<string, string> } } } };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const p = body.payload?.payment?.entity;
  if (body.event !== 'payment.captured' || !p?.notes?.leadId) return new Response('ignored', { status: 200 });
  await recordGatewayPayment(p.notes.leadId, p.amount / 100, p.id, p.method);
  return new Response('ok', { status: 200 });
}
