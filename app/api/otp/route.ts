import { clientIp, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { MessagingNotConfigured, sendOtpCode } from '@/lib/whatsapp/service';
import { showCodesOnScreen } from '@/lib/localTesting';
import { issueOtp } from '@/lib/otp';
import { otpRequestSchema } from '@/lib/validation';

export async function POST(req: Request) {
  const parsed = await parseBody(req, otpRequestSchema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const { phone } = parsed.data;

  if (!rateLimit(`otp-ip:${clientIp(req)}`, 10, 60 * 60_000) || !rateLimit(`otp-phone:${phone}`, 3, 10 * 60_000)) {
    return fail('Too many codes requested. Please wait a few minutes and try again.', 429);
  }

  try {
    const code = await issueOtp(phone);
    await sendOtpCode(phone, code);
    // In local development (no WhatsApp provider) return the code so the flow can be tested.
    return ok(showCodesOnScreen() ? { devCode: code } : {});
  } catch (e) {
    if (e instanceof MessagingNotConfigured) return fail('OTP service is not available right now. Please call the admissions office.', 503);
    console.error('[otp] issue failed', (e as Error).message);
    return fail('Something went wrong. Please try again.', 500);
  }
}
