import 'server-only';

/**
 * OpenAI Chat Completions with strict structured outputs (used for AI question generation when OPENAI_API_KEY is
 * set). The key stays on the server and is never logged. Model: OPENAI_MODEL, else gpt-6.2-sol (falls back to
 * gpt-6.1-terra if the account cannot use the first).
 */
export const openaiConfigured = () => !!process.env.OPENAI_API_KEY && process.env.ASSISTANT_DISABLED !== '1';

export class OpenAiError extends Error {
  constructor(message: string, readonly status: number | null, readonly code: string | null) {
    super(message);
  }
}

const MODELS = () => [...new Set([process.env.OPENAI_MODEL, 'gpt-6.2-sol', 'gpt-6.1-terra'].filter((m): m is string => !!m))];
let working: string | null = null;

async function once(model: string, body: Record<string, unknown>) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, ...body }),
    signal: AbortSignal.timeout(170_000),
  });
  const j = (await r.json().catch(() => null)) as { error?: { message?: string; code?: string; type?: string }; model?: string; choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  if (!r.ok) throw new OpenAiError(String(j?.error?.message ?? `HTTP ${r.status}`).slice(0, 300), r.status, j?.error?.code ?? j?.error?.type ?? null);
  return j!;
}

export async function openaiJson(c: { system: string; user: string; schema: Record<string, unknown>; maxTokens: number }) {
  const body = {
    messages: [{ role: 'system', content: c.system }, { role: 'user', content: c.user }],
    response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: c.schema } },
    max_completion_tokens: c.maxTokens,
  };
  const list = working ? [working, ...MODELS().filter((m) => m !== working)] : MODELS();
  let last: unknown = null;
  for (const model of list) {
    try {
      const j = await once(model, body);
      working = model;
      const ch = j.choices?.[0];
      if (ch?.message?.refusal) throw new OpenAiError('The AI declined this request. Try rephrasing it.', 200, 'refusal');
      if (ch?.finish_reason === 'length') throw new OpenAiError('The answer was too long. Ask for fewer items.', 200, 'length');
      return { text: ch?.message?.content ?? '', model: j.model ?? model, usage: { input: j.usage?.prompt_tokens ?? 0, output: j.usage?.completion_tokens ?? 0 } };
    } catch (e) {
      last = e;
      const modelProblem = e instanceof OpenAiError && (e.status === 404 || e.code === 'model_not_found' || /model/i.test(e.message) && e.status === 400);
      console.error('[openai] request failed', model, e instanceof OpenAiError ? `${e.status} ${e.code ?? ''} ${e.message}` : (e as Error).message);
      if (!modelProblem) throw e;
    }
  }
  throw last;
}
