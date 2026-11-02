import { maskPhone } from './phone';

/**
 * WhatsApp / SMS gateway. Phase 1 has no provider wired: in development messages are logged
 * (with masked numbers); in production, sending an OTP without a provider is an error.
 * Phase 2: plug in WhatsApp Business (Cloud API / Gupshup / Interakt) + DLT-registered SMS.
 */
const configured = () => Boolean(process.env.MESSAGING_PROVIDER);

export class MessagingNotConfigured extends Error {}

export async function sendOtp(phone: string, code: string): Promise<void> {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') throw new MessagingNotConfigured('OTP provider not configured');
    console.info(`[dev otp] ${maskPhone(phone)} → ${code}`);
    return;
  }
  throw new MessagingNotConfigured(`Provider "${process.env.MESSAGING_PROVIDER}" is not implemented yet`);
}

export type Template = 'visit_confirmation' | 'bsat_registration' | 'enquiry_ack';

export async function sendWhatsAppTemplate(phone: string, template: Template, vars: Record<string, string>): Promise<{ sent: boolean }> {
  if (!configured()) {
    console.info(`[dev whatsapp] ${template} → ${maskPhone(phone)}`, vars);
    return { sent: false };
  }
  // Provider integration lands in phase 2; never fail the user's booking because a message failed.
  console.warn(`[whatsapp] provider "${process.env.MESSAGING_PROVIDER}" not implemented; ${template} not sent`);
  return { sent: false };
}
