import 'server-only';

/**
 * Google AI Studio (Gemini API) generateContent, used by the voice assistant. Key: GOOGLE_AI_STUDIO_API_KEY
 * (GEMINI_API_KEY also accepted); it stays on the server and is never logged. Model: GEMINI_MODEL, else
 * gemini-3.8-flash (stable Flash), falling back to gemini-3.5-flash-lite.
 */
const key = () => process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY || '';
export const geminiConfigured = () => !!key() && process.env.ASSISTANT_DISABLED !== '1';

export class GeminiError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

const MODELS = () => [...new Set([process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash-lite'].filter((m): m is string => !!m))];
let working: string | null = null;

export interface GeminiTurn { role: 'user' | 'model'; text: string }

export async function geminiGenerate(c: { system: string; turns: GeminiTurn[]; maxTokens?: number; json?: boolean; thinking?: 'MINIMAL' | 'LOW' | 'MEDIUM' }) {
  const body = {
    systemInstruction: { parts: [{ text: c.system }] },
    contents: c.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { maxOutputTokens: c.maxTokens ?? 1024, thinkingConfig: { thinkingLevel: c.thinking ?? 'MINIMAL' }, ...(c.json ? { responseMimeType: 'application/json' } : {}) },
  };
  const list = working ? [working, ...MODELS().filter((m) => m !== working)] : MODELS();
  let last: unknown = null;
  for (const model of list) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(c.json ? 100_000 : 25_000),
      });
      const j = (await r.json().catch(() => null)) as {
        error?: { message?: string; status?: string };
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      } | null;
      if (!r.ok) throw new GeminiError(`${r.status} ${j?.error?.status ?? ''} ${String(j?.error?.message ?? '').slice(0, 240)}`.trim(), r.status);
      if (j?.promptFeedback?.blockReason) throw new GeminiError(`blocked: ${j.promptFeedback.blockReason}`, 200);
      const cand = j?.candidates?.[0];
      const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim();
      if (!text) throw new GeminiError(`empty reply (${cand?.finishReason ?? 'no candidate'})`, 200);
      working = model;
      return { text, model, usage: { input: j?.usageMetadata?.promptTokenCount ?? 0, output: j?.usageMetadata?.candidatesTokenCount ?? 0 } };
    } catch (e) {
      last = e;
      const status = e instanceof GeminiError ? e.status : null;
      console.error('[gemini] request failed', model, (e as Error).message);
      // try the next model when this one is unknown or overloaded (404, 500, 503); quota / key errors stop here
      const timedOut = (e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError';
      const nextModel = timedOut || status === 404 || status === 500 || status === 503 || (status === 400 && /model/i.test((e as Error).message));
      if (!nextModel) throw e;
    }
  }
  throw last;
}
