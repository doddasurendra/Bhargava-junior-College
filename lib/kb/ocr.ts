import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { ASSISTANT_MODEL } from '../assistant/agent';

/**
 * OCR for scanned PDFs and images (§2), in English, Telugu and Hindi script. Uses Claude vision when
 * ANTHROPIC_API_KEY is set; otherwise the file stays "OCR needed" (shown honestly on the file screen, with a
 * retry button once a key is configured) — no text is ever made up.
 */
export const ocrAvailable = () => !!process.env.ANTHROPIC_API_KEY && process.env.ASSISTANT_DISABLED !== '1';

const PROMPT = 'Transcribe ALL text in this document exactly as written, in its original script (English, Telugu or Hindi). Keep headings, lists and table rows on their own lines. Do not translate, summarise or add anything. Separate pages with a line containing only "=== PAGE ===".';

export async function ocr(bytes: Uint8Array, mime: string): Promise<{ pages: string[] } | { error: string }> {
  if (!ocrAvailable()) return { error: 'OCR needs ANTHROPIC_API_KEY (Claude vision). Not configured.' };
  if (bytes.length > 30 * 1024 * 1024) return { error: 'File too large for OCR (30 MB max).' };
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 120_000 });
    const data = Buffer.from(bytes).toString('base64');
    const part: Anthropic.ContentBlockParam =
      mime === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : { type: 'image', source: { type: 'base64', media_type: mime as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data } };
    const r = await client.messages.create({ model: ASSISTANT_MODEL, max_tokens: 16000, messages: [{ role: 'user', content: [part, { type: 'text', text: PROMPT }] }] });
    const text = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    return { pages: text.split(/^=== PAGE ===$/m).map((p) => p.trim()).filter((p, i, a) => p || a.length === 1) };
  } catch (e) {
    return { error: `OCR failed: ${(e as Error).message.slice(0, 200)}` };
  }
}
