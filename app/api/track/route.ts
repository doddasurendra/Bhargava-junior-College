import { getProgram } from '@/content/programs';
import { visitSlots } from '@/content/sample';
import { buildTimeline } from '@/lib/admission';
import { clientIp, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { verifyOtp } from '@/lib/otp';
import { getStore } from '@/lib/store';
import { trackRequestSchema } from '@/lib/validation';

export async function POST(req: Request) {
  if (!rateLimit(`track:${clientIp(req)}`, 20, 10 * 60_000)) return fail('Too many attempts. Please try again later.', 429);

  const parsed = await parseBody(req, trackRequestSchema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const { phone, code } = parsed.data;

  const result = await verifyOtp(phone, code);
  if (result === 'invalid') return fail('That code is not correct. Please check and try again.', 401);
  if (result === 'locked') return fail('Too many wrong attempts. Please request a new code.', 401);
  if (result === 'expired') return fail('This code has expired. Please request a new code.', 401);

  try {
    const rec = await getStore().findAdmission(phone);
    if (!rec) return ok({ found: false });
    const slotLabel = rec.upcomingVisit ? visitSlots.slots.find((s) => s.slot === rec.upcomingVisit!.slot)?.label ?? rec.upcomingVisit.slot : null;
    return ok({
      found: true,
      studentName: rec.studentName ?? rec.contactName,
      program: rec.program ? getProgram(rec.program)?.name ?? null : null,
      owner: rec.owner,
      nextUpdate: rec.nextUpdate,
      upcomingVisit: rec.upcomingVisit ? `${formatDate(rec.upcomingVisit.date)}, ${slotLabel}` : null,
      timeline: buildTimeline(rec.completedStage, rec.events),
    });
  } catch (e) {
    console.error('[track] lookup failed', (e as Error).message);
    return fail('Something went wrong. Please try again.', 500);
  }
}
