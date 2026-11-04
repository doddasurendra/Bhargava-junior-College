import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Online fee payment through Razorpay (brief §10). Placeholder until configured: set RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET. A captured payment is recorded as approved automatically
 * (§7.4 "gateway auto-confirms"); offline payments still need Accounts approval.
 */
export const paymentsConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const publicKeyId = () => process.env.RAZORPAY_KEY_ID ?? null;

export async function createOrder(amountRupees: number, receipt: string, notes: Record<string, string>) {
  if (!paymentsConfigured()) throw new Error('Online payment is not configured.');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: 'INR', receipt: receipt.slice(0, 40), notes }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status})`);
  return (await res.json()) as { id: string; amount: number; currency: string };
}

const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Checkout callback: HMAC-SHA256(order_id|payment_id, key secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = process.env.RAZORPAY_KEY_SECRET ?? '') {
  if (!secret) return false;
  return safeEq(createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex'), signature);
}

/** Webhook: HMAC-SHA256(raw body, webhook secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '') {
  if (!secret) return false;
  return safeEq(createHmac('sha256', secret).update(rawBody).digest('hex'), signature);
}
