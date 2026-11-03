import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { fail, ok } from '@/lib/api';
import { recordHostelMovement } from '@/lib/app/service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  college_id: z.string().min(3).max(40),
  direction: z.enum(['in', 'out']),
  at: z.string().datetime({ offset: true }),
  device: z.string().min(1).max(60),
  event_id: z.string().min(1).max(120),
});

function authorised(req: Request) {
  const key = process.env.HOSTEL_DEVICE_KEY;
  if (!key) return false;
  const given = Buffer.from(req.headers.get('x-device-key') ?? '');
  const expected = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Biometric hostel gate → POST one event per scan (brief §3.4). Header `x-device-key: $HOSTEL_DEVICE_KEY`.
 * Body: { college_id, direction: "in"|"out", at: ISO timestamp, device, event_id }. Idempotent on (device, event_id).
 * Each new event sends a WhatsApp alert to every guardian with app access.
 */
export async function POST(req: Request) {
  if (!authorised(req)) return fail('Unauthorised', 401);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON');
  }
  const p = schema.safeParse(body);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid event');
  const d = p.data;
  const at = new Date(d.at);
  if (Math.abs(Date.now() - at.getTime()) > 7 * 86_400_000) return fail('Event time is more than 7 days from now');
  const r = await recordHostelMovement({ collegeId: d.college_id, direction: d.direction, at: at.toISOString(), device: d.device, eventId: d.event_id });
  if (!r.ok) return fail(r.error, 404);
  return ok({ duplicate: r.duplicate, alerted: r.alerted });
}
