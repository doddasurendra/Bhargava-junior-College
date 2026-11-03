import { describe, expect, it } from 'vitest';
import { answer, detectIntent, reply } from './faqBot';
import { isOfficeOpen, nextOpening } from './hours';
import { canFreeText, routeConversation } from './rules';

const ist = (s: string) => new Date(`${s}+05:30`);

describe('office hours (IST)', () => {
  it('knows when the office is open', () => {
    expect(isOfficeOpen(ist('2026-11-02T07:00:00'))).toBe(true); // Mon 7:00
    expect(isOfficeOpen(ist('2026-11-02T16:59:00'))).toBe(true);
    expect(isOfficeOpen(ist('2026-11-02T17:00:00'))).toBe(false);
    expect(isOfficeOpen(ist('2026-11-07T10:00:00'))).toBe(true); // Sat
    expect(isOfficeOpen(ist('2026-11-07T15:30:00'))).toBe(false);
    expect(isOfficeOpen(ist('2026-11-08T11:00:00'))).toBe(false); // Sun
  });
  it('finds the next opening', () => {
    expect(nextOpening(ist('2026-11-02T22:00:00')).toISOString()).toBe(ist('2026-11-03T07:00:00').toISOString()); // Mon night → Tue 7
    expect(nextOpening(ist('2026-11-03T05:30:00')).toISOString()).toBe(ist('2026-11-03T07:00:00').toISOString()); // early morning → same day
    expect(nextOpening(ist('2026-11-07T16:00:00')).toISOString()).toBe(ist('2026-11-09T07:00:00').toISOString()); // Sat evening → Mon 7
    expect(nextOpening(ist('2026-11-08T12:00:00')).toISOString()).toBe(ist('2026-11-09T07:00:00').toISOString()); // Sunday
    const open = ist('2026-11-04T11:00:00');
    expect(nextOpening(open)).toBe(open);
  });
});

describe('rule-based assistant', () => {
  it('detects intents, including romanised Telugu/Hindi', () => {
    expect(detectIntent('What are the fees?')).toBe('fees');
    expect(detectIntent('fee entha?')).toBe('fees');
    expect(detectIntent('hostel lo AC room unda')).toBe('hostel');
    expect(detectIntent('BSAT date')).toBe('scholarship');
    expect(detectIntent('Do you have NEET coaching')).toBe('courses');
    expect(detectIntent('I want to talk to a counsellor')).toBe('handoff');
    expect(detectIntent('Will my son get IIT seat guaranteed?')).toBe('rank');
    expect(detectIntent('Is there a swimming pool?')).toBe('unknown');
  });
  it('never promises ranks and hands off when unsure', () => {
    expect(answer('rank').text).toMatch(/never promise/);
    expect(reply('swimming pool?')).toMatchObject({ intent: 'unknown', offerHandoff: true });
  });
  it('answers fees from the configured fee table', () => {
    expect(answer('fees').text).toContain('₹1,35,000');
  });
});

describe('inbox rules', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  it('WhatsApp free text only within 24h of the family’s last message', () => {
    expect(canFreeText({ channel: 'whatsapp', lastInboundAt: new Date(now.getTime() - 23 * 3_600_000).toISOString() }, now)).toBe(true);
    expect(canFreeText({ channel: 'whatsapp', lastInboundAt: new Date(now.getTime() - 25 * 3_600_000).toISOString() }, now)).toBe(false);
    expect(canFreeText({ channel: 'whatsapp', lastInboundAt: null }, now)).toBe(false);
    expect(canFreeText({ channel: 'web', lastInboundAt: null }, now)).toBe(true);
  });
  it('routes to the lead owner when there is one', () => {
    expect(routeConversation({ ownerId: 'priya', ownerCanReply: true })).toEqual({ status: 'assigned', assigneeId: 'priya' });
    expect(routeConversation({ ownerId: 'x', ownerCanReply: false })).toEqual({ status: 'waiting', assigneeId: null });
    expect(routeConversation({ ownerId: null, ownerCanReply: false })).toEqual({ status: 'waiting', assigneeId: null });
  });
});
