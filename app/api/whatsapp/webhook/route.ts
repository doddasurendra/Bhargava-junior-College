import { NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/whatsapp/service';

export const dynamic = 'force-dynamic';

/** Meta's one-time verification handshake when the webhook URL is registered. */
export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === token) {
    return new NextResponse(p.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/** Delivery statuses and inbound messages. The signature is checked against the raw body. */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const r = await handleWebhook(raw, req.headers.get('x-hub-signature-256'));
    return new NextResponse(r.ok ? 'ok' : 'rejected', { status: r.status });
  } catch (e) {
    console.error('[whatsapp] webhook failed', (e as Error).message);
    // 500 makes Meta retry later; storage is idempotent on provider message ids.
    return new NextResponse('error', { status: 500 });
  }
}
