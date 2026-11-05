/**
 * Voice agent speech helpers (server side). Text for speaking, and Azure neural TTS with a consistent female
 * voice per language. Azure is used only when AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are set (server-side only);
 * otherwise the browser's female voice is used (lower quality, documented).
 */
export type VoiceLang = 'en' | 'te' | 'hi';

/** Female neural voices: Indian English, Telugu, Hindi. */
export const FEMALE_VOICES: Record<VoiceLang, { locale: string; voice: string }> = {
  en: { locale: 'en-IN', voice: 'en-IN-NeerjaNeural' },
  te: { locale: 'te-IN', voice: 'te-IN-ShrutiNeural' },
  hi: { locale: 'hi-IN', voice: 'hi-IN-SwaraNeural' },
};

/** Turns a written answer into something natural to hear: no markdown, links, bullets or emoji. */
export function toSpeech(text: string, max = 900) {
  const s = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links → label
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(^|\s)\/[a-z0-9/#?=-]+/gi, ' ') // site paths like /fees
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-•·]\s*/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/₹\s?/g, 'rupees ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('। '), cut.lastIndexOf('? '));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut).trim();
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** SSML with the female voice, a warm "friendly" style where supported, and natural pacing. */
export function ssmlFor(text: string, lang: VoiceLang) {
  const v = FEMALE_VOICES[lang];
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.locale}"><voice name="${v.voice}"><prosody rate="-4%">${esc(text)}</prosody></voice></speak>`;
}

export const azureConfigured = () => Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

/** Azure neural TTS → MP3 bytes. Throws on failure so the caller can fall back to the browser voice. */
export async function azureTts(text: string, lang: VoiceLang, signal?: AbortSignal): Promise<ArrayBuffer> {
  const region = process.env.AZURE_SPEECH_REGION!;
  const res = await fetch(`https://${encodeURIComponent(region)}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'bjc-voice-agent',
    },
    body: ssmlFor(text, lang),
    signal,
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}`);
  return res.arrayBuffer();
}
