import { clientIp, deviceFromUA, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { getStore } from '@/lib/store';
import { leadRequestSchema } from '@/lib/validation';
import { enquiryAck } from '@/lib/whatsapp/service';

export async function POST(req: Request) {
  if (!rateLimit(`lead:${clientIp(req)}`, 10, 60_000)) return fail('Too many requests. Please try again in a minute.', 429);

  const parsed = await parseBody(req, leadRequestSchema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);

  const d = parsed.data;
  try {
    await getStore().captureLead({ ...d, attribution: { ...d.attribution, device: d.attribution?.device ?? deviceFromUA(req) } });
    await enquiryAck(d.name, d.phone, d.source, d.program).catch((e) => console.error('[leads] WhatsApp ack failed', (e as Error).message));
    // Do not reveal whether this number already existed.
    return ok();
  } catch (e) {
    console.error('[leads] capture failed', (e as Error).message);
    return fail('Something went wrong. Please call us or try again.', 500);
  }
}
