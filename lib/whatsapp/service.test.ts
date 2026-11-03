import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;
type Svc = typeof import('./service');
let svc: Svc;
let store: import('../store/types').Store;

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-wa-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  svc = await import('./service');
  store = (await import('../store/file')).createFileStore();
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const lead = (phone: string) => store.captureLead({ name: 'Parent', phone, consent: true, source: 'callback' });

describe('whatsapp service (development mode, file store)', () => {
  it('sends once per dedupe key and records the outbox', async () => {
    await lead('+919555500001');
    const a = await svc.sendTemplate({ template: 'enquiry_ack', to: '+919555500001', params: ['Ravi', '+91 81432 37575'], dedupeKey: 'k1' });
    const b = await svc.sendTemplate({ template: 'enquiry_ack', to: '+919555500001', params: ['Ravi', '+91 81432 37575'], dedupeKey: 'k1' });
    expect(a.status).toBe('sent');
    expect(b).toEqual({ status: 'skipped', reason: 'Already sent.' });
    const st = svc.getMessageStore();
    const { leadId } = await lead('+919555500001');
    const { outbound } = await st.listForLead(leadId);
    expect(outbound).toHaveLength(1);
    expect(outbound[0]).toMatchObject({ template: 'bjc_enquiry_ack', status: 'sent', leadId, body: expect.stringContaining('Hello Ravi') });
  });

  it('requires consent when asked, and honours STOP from the webhook', async () => {
    const noLead = await svc.sendTemplate({ template: 'college_intro', to: '+919555500002', params: ['X', 'https://x'], requireConsent: true });
    expect(noLead.status).toBe('skipped');

    await lead('+919555500003');
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { messages: [{ id: 'wamid.stop1', from: '919555500003', type: 'text', timestamp: '1793600000', text: { body: 'STOP' } }] } }] }],
    });
    process.env.WHATSAPP_APP_SECRET = 'appsecret';
    expect(await svc.handleWebhook(body, 'sha256=bad')).toEqual({ ok: false, status: 401 });
    const sig = `sha256=${createHmac('sha256', 'appsecret').update(body).digest('hex')}`;
    expect(await svc.handleWebhook(body, sig)).toEqual({ ok: true, status: 200 });
    expect(await svc.handleWebhook(body, sig)).toEqual({ ok: true, status: 200 }); // retried delivery: idempotent
    expect(await svc.getMessageStore().isOptedOut('+919555500003')).toBe(true);
    const r = await svc.sendTemplate({ template: 'visit_reminder', to: '+919555500003', params: ['today', '10:00 AM', 'https://maps'] });
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/STOP/);
    delete process.env.WHATSAPP_APP_SECRET;
  });

  it('applies delivery statuses forward only and redacts OTPs', async () => {
    await lead('+919555500004');
    await svc.sendOtpCode('+919555500004', '482913');
    const st = svc.getMessageStore();
    const { leadId } = await lead('+919555500004');
    const [otp] = (await st.listForLead(leadId)).outbound;
    expect(otp.body).not.toContain('482913');
    const pid = otp.providerId!;
    await st.applyStatus(pid, 'read', null);
    await st.applyStatus(pid, 'delivered', null); // late, out of order
    expect((await st.listForLead(leadId)).outbound[0].status).toBe('read');
  });
});
