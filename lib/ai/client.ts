import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * One place that decides how the app reaches Claude.
 * - OPENROUTER_API_KEY set: Claude through OpenRouter's Anthropic-compatible endpoint (https://openrouter.ai/api,
 *   Bearer auth), model ids in OpenRouter form (anthropic/claude-opus-5.5), Anthropic-only request extras left out.
 * - else ANTHROPIC_API_KEY: Claude directly.
 * Keys stay on the server and are never logged.
 */
export type AiProvider = 'openrouter' | 'anthropic';

export const aiProvider = (): AiProvider | null =>
  process.env.ASSISTANT_DISABLED === '1' ? null : process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;

export const aiAvailable = () => aiProvider() !== null;

/** Anthropic model id → the id for the active provider. OPENROUTER_MODEL overrides on OpenRouter. */
export function aiModel(anthropicId: string) {
  if (aiProvider() !== 'openrouter') return anthropicId;
  if (process.env.OPENROUTER_MODEL) return process.env.OPENROUTER_MODEL;
  if (anthropicId.includes('/')) return anthropicId;
  // claude-opus-5-5 → anthropic/claude-opus-5.5
  return `anthropic/${anthropicId.replace(/-(\d+)-(\d+)$/, '-$1.$2')}`;
}

/** Whether Anthropic-only request options (output_config, betas, fallbacks, mid-conversation system) may be sent. */
export const anthropicExtras = () => aiProvider() !== 'openrouter';

export function aiClient(opts: { maxRetries?: number; timeout?: number } = {}): Anthropic {
  if (aiProvider() === 'openrouter') {
    return new Anthropic({
      ...opts,
      baseURL: 'https://openrouter.ai/api',
      apiKey: null,
      authToken: process.env.OPENROUTER_API_KEY,
      defaultHeaders: { 'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://bhargava-junior-college.vercel.app', 'X-Title': 'Bhargava Junior College' },
    });
  }
  return new Anthropic(opts);
}

/** Pull a JSON object out of a text reply (used when the provider cannot enforce a JSON schema). */
export function jsonFromText(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('no JSON in reply');
  }
}
