import { bsat } from '@/content/sample';
import { clientIp, deviceFromUA, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { formatDate, todayIST } from '@/lib/dates';
import { sendWhatsAppTemplate } from '@/lib/messaging';
import { getStore, StoreError } from '@/lib/store';
import { bsatRequestSchema } from '@/lib/validation';

export async function POST(req: Request) {
  if (!rateLimit(`bsat:${clientIp(req)}`, 5, 10 * 60_000)) return fail('Too many requests. Please try again later.', 429);

  const parsed = await parseBody(req, bsatRequestSchema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const d = parsed.data;

  const session = bsat.sessions.find((s) => s.id === d.sessionId);
  if (!session || session.date < todayIST()) return fail('Please choose an upcoming test date.');

  try {
    // The BSAT form asks for the student's name, so record it as the student on the lead too.
    const { hallTicket, alreadyRegistered } = await getStore().registerBsat({ ...d, studentName: d.name, attribution: { ...d.attribution, device: d.attribution?.device ?? deviceFromUA(req) } });
    if (!alreadyRegistered) {
      await sendWhatsAppTemplate(d.phone, 'bsat_registration', { name: d.name, hallTicket, date: formatDate(session.date), mode: session.mode });
    }
    return ok({ hallTicket, alreadyRegistered, date: formatDate(session.date), mode: session.mode });
  } catch (e) {
    if (e instanceof StoreError && e.code === 'session_full') return fail('This test date is full. Please choose another date.', 409);
    if (e instanceof StoreError) return fail('Please choose an upcoming test date.', 409);
    console.error('[bsat] registration failed', (e as Error).message);
    return fail('Something went wrong. Please call us or try again.', 500);
  }
}
