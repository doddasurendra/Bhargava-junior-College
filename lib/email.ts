import 'server-only';
import { getRecordStore } from './records';

/**
 * Outbound email (7 PM report, receipts). Any SMTP server works, including Amazon SES SMTP (brief §10).
 * Placeholder until configured: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM.
 * Without them, messages are logged (development) and recorded as "logged", never silently dropped.
 */
export interface EmailInput {
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Uint8Array | Buffer; contentType: string }[];
  /** at most one send per key (re-running a job doesn't email twice) */
  dedupeKey?: string;
}

export type EmailResult = { status: 'sent' | 'logged' | 'skipped' | 'failed'; reason?: string };

const LOG = 'email_log';

export const emailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);

export async function sendEmail(e: EmailInput): Promise<EmailResult> {
  const store = getRecordStore();
  if (e.dedupeKey) {
    const prev = await store.get<{ status: string }>(LOG, e.dedupeKey);
    if (prev && (prev.data.status === 'sent' || prev.data.status === 'logged')) return { status: 'skipped', reason: 'Already sent.' };
  }
  const to = [...new Set(e.to.map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))];
  if (to.length === 0) return { status: 'skipped', reason: 'No valid recipients.' };

  let result: EmailResult;
  if (!emailConfigured()) {
    console.info(`[dev email] "${e.subject}" → ${to.length} recipient(s)${e.attachments?.length ? `, ${e.attachments.length} attachment(s)` : ''}`);
    result = { status: 'logged', reason: 'SMTP not configured' };
  } else {
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transport.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: e.subject,
        html: e.html,
        attachments: e.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })),
      });
      result = { status: 'sent' };
    } catch (err) {
      console.error('[email] send failed', (err as Error).message);
      result = { status: 'failed', reason: (err as Error).message.slice(0, 200) };
    }
  }
  // recipients are kept as a count only (no addresses in logs)
  await store.put(LOG, { id: e.dedupeKey, k1: result.status, k2: new Date().toISOString(), data: { subject: e.subject, recipients: to.length, status: result.status, reason: result.reason ?? null } });
  return result;
}
