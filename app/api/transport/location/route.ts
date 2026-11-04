import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { fail, ok } from '@/lib/api';
import { updateBusLocation } from '@/lib/school/operations';

export const dynamic = 'force-dynamic';

const body = z.object({ bus_no: z.string().trim().min(1).max(20), lat: z.number(), lng: z.number() });

/**
 * Live bus location (§9A row 14). The GPS device or driver app posts { bus_no, lat, lng } with header
 * x-device-key: $TRANSPORT_DEVICE_KEY. Without the key configured, everything is refused.
 */
export async function POST(req: Request) {
  const expected = process.env.TRANSPORT_DEVICE_KEY;
  const given = req.headers.get('x-device-key') ?? '';
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return fail('Unauthorized', 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Expected { bus_no, lat, lng }');
  try {
    const r = await updateBusLocation(parsed.data.bus_no, parsed.data.lat, parsed.data.lng);
    return r ? ok({ updated: true }) : fail('Unknown bus', 404);
  } catch (e) {
    return fail((e as Error).message);
  }
}
