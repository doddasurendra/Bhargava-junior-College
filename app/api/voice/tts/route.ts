import { z } from 'zod';
import { clientIp, fail, parseBody, rateLimit } from '@/lib/api';
import { azureConfigured, azureTts } from '@/lib/voice/speech';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({ text: z.string().trim().min(1).max(1500), lang: z.enum(['en', 'te', 'hi']) });

/**
 * Female neural voice for the voice agent. Keys stay on the server. Without an Azure Speech key it answers 204
 * with `x-tts: browser`, and the voice agent uses the browser's female voice instead.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`tts:${ip}`, 30, 60_000)) return fail('Too many requests.', 429);
  if (!azureConfigured()) return new Response(null, { status: 204, headers: { 'x-tts': 'browser' } });
  const parsed = await parseBody(req, schema);
  if ('spam' in parsed || 'error' in parsed) return fail('error' in parsed ? parsed.error : 'Bad request');
  try {
    const audio = await azureTts(parsed.data.text, parsed.data.lang, AbortSignal.timeout(15_000));
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'x-tts': 'azure' } });
  } catch (e) {
    console.error('[voice] tts failed', (e as Error).message);
    return new Response(null, { status: 204, headers: { 'x-tts': 'browser' } });
  }
}
