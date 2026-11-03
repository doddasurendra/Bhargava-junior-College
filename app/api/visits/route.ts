import { clientIp, deviceFromUA, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { formatDate, isIsoDate } from '@/lib/dates';
import { visitConfirmation } from '@/lib/whatsapp/service';
import { getStore, StoreError } from '@/lib/store';
import { visitRequestSchema } from '@/lib/validation';
import { slotLabel, slotsFor, validateVisit } from '@/lib/visits';
import { getContent } from '@/lib/cms';

export const dynamic = 'force-dynamic';

/** GET /api/visits?date=YYYY-MM-DD → slot availability */
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date');
  if (!isIsoDate(date)) return fail('Invalid date');
  try {
    const [booked, { visitSlots }] = await Promise.all([getStore().slotBookings(date), getContent()]);
    return ok({
      slots: slotsFor(date, visitSlots).map((s) => ({ slot: s.slot, label: s.label, available: Math.max(0, s.capacity - (booked[s.slot] ?? 0)) })),
    });
  } catch (e) {
    console.error('[visits] availability failed', (e as Error).message);
    return fail('Could not load slots. Please try again.', 500);
  }
}

export async function POST(req: Request) {
  if (!rateLimit(`visit:${clientIp(req)}`, 5, 10 * 60_000)) return fail('Too many requests. Please try again later.', 429);

  const parsed = await parseBody(req, visitRequestSchema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const d = parsed.data;

  const { visitSlots } = await getContent();
  const invalid = validateVisit(d.date, d.slot, visitSlots);
  if (invalid) return fail(invalid);

  let visitId: string;
  try {
    ({ visitId } = await getStore().createVisit({ ...d, attribution: { ...d.attribution, device: d.attribution?.device ?? deviceFromUA(req) } }));
  } catch (e) {
    if (e instanceof StoreError && e.code === 'slot_full') return fail('That slot has just filled up. Please pick another time.', 409);
    if (e instanceof StoreError) return fail('That slot is not available. Please pick another time.', 409);
    console.error('[visits] booking failed', (e as Error).message);
    return fail('Something went wrong. Please call us or try again.', 500);
  }

  const when = `${formatDate(d.date)}, ${slotLabel(d.slot, visitSlots)}`;
  await visitConfirmation(visitId, d.name, d.phone, when).catch((e) => console.error('[visits] confirmation failed', (e as Error).message));
  return ok({ when });
}
