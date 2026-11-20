/**
 * May a one-time code be shown on screen? Only on a developer's machine with nothing to deliver it:
 * `next dev`, or the production build started with `npm run start:local` (LOCAL_FILE_STORE=1), using the local
 * JSON store (no Supabase) and with no WhatsApp provider configured. Never on Vercel, never with real data.
 */
export function showCodesOnScreen(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  if (process.env.MESSAGING_PROVIDER === 'whatsapp_cloud' && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) return false;
  return process.env.NODE_ENV === 'development' || process.env.LOCAL_FILE_STORE === '1';
}
