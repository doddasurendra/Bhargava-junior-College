import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildTemplatePayload, CloudApiError, sendTemplateMessage } from './cloudApi';
import { dueReminders } from './reminders';
import { getTemplate, renderBody, TEMPLATES, validateParams } from './templates';
import { keywordIntent, parseWebhook, verifySignature } from './webhook';

const t = (k: string) => getTemplate(k)!;

describe('templates', () => {
  it('every template has matching placeholders and params, and unique names', () => {
    for (const def of TEMPLATES) {
      const n = new Set(def.body.match(/\{\{\d+\}\}/g)).size;
      expect(n, def.key).toBe(def.params.length);
      expect(def.name).toMatch(/^[a-z0-9_]+$/);
    }
    expect(new Set(TEMPLATES.map((d) => d.name)).size).toBe(TEMPLATES.length);
  });
  it('renders and validates params', () => {
    expect(renderBody(t('location'), ['Saroornagar', 'https://maps', '7-5'])).toBe('Bhargava Junior College is at Saroornagar. Directions: https://maps. Office hours: 7-5.');
    expect(validateParams(t('location'), ['a', 'b'])).toMatch(/needs 3/);
    expect(validateParams(t('location'), ['a', 'line\nbreak', 'c'])).toMatch(/single line/);
    expect(validateParams(t('location'), ['a', ' ', 'c'])).toMatch(/empty/);
  });
});

describe('cloud api', () => {
  it('builds a body-only template payload', () => {
    const p = buildTemplatePayload({ to: '+919876543210', template: t('enquiry_ack'), params: ['Ravi', '+91 81432 37575'] });
    expect(p).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '919876543210',
      type: 'template',
      template: { name: 'bjc_enquiry_ack', language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Ravi' }, { type: 'text', text: '+91 81432 37575' }] }] },
    });
  });
  it('adds the document header and the OTP copy-code button', () => {
    const b = buildTemplatePayload({ to: '+919876543210', template: t('brochure'), params: ['R', 'NEET', 'x'], document: { link: 'https://x/neet.pdf', filename: 'NEET.pdf' } });
    expect(b.template.components[0]).toEqual({ type: 'header', parameters: [{ type: 'document', document: { link: 'https://x/neet.pdf', filename: 'NEET.pdf' } }] });
    expect(() => buildTemplatePayload({ to: '+919876543210', template: t('brochure'), params: ['R', 'NEET', 'x'] })).toThrow(/document/);
    const o = buildTemplatePayload({ to: '+919876543210', template: t('otp'), params: ['482913'] });
    expect(o.template.components[1]).toEqual({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }] });
  });
  it('sends and maps errors', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 }));
    await expect(sendTemplateMessage({ phoneNumberId: '123', accessToken: 'tok' }, { to: '+919876543210', template: t('enquiry_ack'), params: ['a', 'b'] }, ok as never)).resolves.toBe('wamid.1');
    expect((ok.mock.calls[0] as unknown[])[0]).toBe('https://graph.facebook.com/v21.0/123/messages');
    const limited = async () => new Response(JSON.stringify({ error: { message: 'rate', code: 130429 } }), { status: 400 });
    const err = await sendTemplateMessage({ phoneNumberId: '1', accessToken: 't' }, { to: '+919876543210', template: t('enquiry_ack'), params: ['a', 'b'] }, limited as never).catch((e) => e);
    expect(err).toBeInstanceOf(CloudApiError);
    expect(err.retryable).toBe(true);
  });
});

describe('webhook', () => {
  it('verifies the signature on the raw body', () => {
    const body = '{"a":1}';
    const sig = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    expect(verifySignature(body, sig, 'secret')).toBe(true);
    expect(verifySignature(body + ' ', sig, 'secret')).toBe(false);
    expect(verifySignature(body, sig, 'other')).toBe(false);
    expect(verifySignature(body, null, 'secret')).toBe(false);
  });
  it('parses statuses and inbound messages', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                statuses: [
                  { id: 'wamid.1', status: 'delivered', timestamp: '1793600000' },
                  { id: 'wamid.2', status: 'failed', timestamp: '1793600000', errors: [{ code: 131026, title: 'Message undeliverable' }] },
                ],
                messages: [{ id: 'wamid.in', from: '919876543210', type: 'text', timestamp: '1793600000', text: { body: 'STOP' } }],
              },
            },
          ],
        },
      ],
    };
    const r = parseWebhook(payload);
    expect(r.statuses).toEqual([
      { providerId: 'wamid.1', status: 'delivered', at: new Date(1793600000 * 1000).toISOString(), error: null },
      { providerId: 'wamid.2', status: 'failed', at: new Date(1793600000 * 1000).toISOString(), error: '131026: Message undeliverable' },
    ]);
    expect(r.messages[0]).toMatchObject({ from: '+919876543210', text: 'STOP', type: 'text' });
    expect(parseWebhook({ object: 'page' })).toEqual({ statuses: [], messages: [] });
  });
  it('recognises opt-out and opt-in keywords only as whole messages', () => {
    expect(keywordIntent('STOP')).toBe('opt_out');
    expect(keywordIntent(' unsubscribe! ')).toBe('opt_out');
    expect(keywordIntent('Start')).toBe('opt_in');
    expect(keywordIntent("please don't stop calling, we will visit")).toBeNull();
    expect(keywordIntent(null)).toBeNull();
  });
});

describe('visit reminders', () => {
  const visit = { id: 'v1', date: '2026-11-04', slot: '10:00', status: 'scheduled', createdAt: '2026-11-01T10:00:00Z' };
  const at = (iso: string) => new Date(iso);
  it('day-before window, then two-hour window, then nothing', () => {
    expect(dueReminders([visit], at('2026-11-03T03:00:00Z'))).toEqual([]); // 08:30 IST day before: >24h out
    expect(dueReminders([visit], at('2026-11-03T05:00:00Z'))).toEqual([{ visitId: 'v1', kind: 'day_before', dedupeKey: 'visit:v1:day_before' }]); // 10:30 IST day before
    expect(dueReminders([visit], at('2026-11-04T03:00:00Z'))).toEqual([{ visitId: 'v1', kind: 'two_hours', dedupeKey: 'visit:v1:two_hours' }]); // 08:30 IST
    expect(dueReminders([visit], at('2026-11-04T05:00:00Z'))).toEqual([]); // started
  });
  it('skips the day-before reminder for late bookings and ignores non-scheduled visits', () => {
    const late = { ...visit, createdAt: '2026-11-03T15:00:00Z' };
    expect(dueReminders([late], at('2026-11-03T16:00:00Z'))).toEqual([]);
    expect(dueReminders([{ ...visit, status: 'cancelled' }], at('2026-11-04T03:00:00Z'))).toEqual([]);
  });
});
