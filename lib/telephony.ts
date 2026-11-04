import 'server-only';
import { maskPhone } from './phone';
import type { Staff } from './crm/types';

/**
 * Cloud telephony click-to-call (brief §7.1 step 4, §10: Exotel / Knowlarity). Placeholder until configured:
 * set EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_CALLER_ID (the virtual number) and optionally
 * EXOTEL_SUBDOMAIN (default api.exotel.com). The telecaller's own phone must be on their staff profile.
 * Exotel rings the agent first, then connects the parent, and records the call (recording URL via webhook).
 */
export type CallResult = { kind: 'bridged'; callSid: string | null } | { kind: 'reveal' } | { kind: 'error'; message: string };

export const telephonyConfigured = () => Boolean(process.env.EXOTEL_SID && process.env.EXOTEL_API_KEY && process.env.EXOTEL_API_TOKEN && process.env.EXOTEL_CALLER_ID);

export async function placeCall({ agent, to, leadId }: { agent: Pick<Staff, 'id' | 'phone' | 'fullName'>; to: string; leadId: string }): Promise<CallResult> {
  if (!telephonyConfigured()) return { kind: 'reveal' };
  if (!agent.phone) return { kind: 'error', message: 'Add your mobile number to your staff profile so the call can ring you first.' };
  const sid = process.env.EXOTEL_SID!;
  const host = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
  const body = new URLSearchParams({ From: agent.phone, To: to, CallerId: process.env.EXOTEL_CALLER_ID!, Record: 'true', CustomField: leadId });
  try {
    const res = await fetch(`https://${host}/v1/Accounts/${sid}/Calls/connect.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.EXOTEL_API_KEY}:${process.env.EXOTEL_API_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      console.error(`[telephony] connect failed ${res.status} for ${maskPhone(to)}`);
      return { kind: 'error', message: 'The call could not be placed. Try again or dial from the office phone.' };
    }
    const json = (await res.json().catch(() => ({}))) as { Call?: { Sid?: string } };
    return { kind: 'bridged', callSid: json.Call?.Sid ?? null };
  } catch (e) {
    console.error('[telephony] connect error', (e as Error).message);
    return { kind: 'error', message: 'The call could not be placed. Try again or dial from the office phone.' };
  }
}
