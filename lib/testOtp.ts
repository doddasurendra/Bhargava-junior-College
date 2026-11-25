/**
 * Developer test phone numbers (like Firebase / Supabase "test OTP" numbers): lets QA sign in to the Student &
 * Parent app before WhatsApp delivery is set up. Only for numbers listed in TEST_OTP_NUMBERS (server env,
 * comma-separated +91 numbers), only with TEST_OTP_CODE (a secret 6-digit code, never the default), and nothing
 * is sent to those numbers. Every other number is untouched. Remove both variables to switch it off.
 */
export function testOtpCode(phone: string, env: Record<string, string | undefined> = process.env): string | null {
  const code = (env.TEST_OTP_CODE ?? '').trim();
  if (!/^\d{6}$/.test(code) || /^(\d)\1{5}$/.test(code) || code === '123456') return null;
  const numbers = (env.TEST_OTP_NUMBERS ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => /^\+91[6-9]\d{9}$/.test(n));
  return numbers.includes(phone) ? code : null;
}
