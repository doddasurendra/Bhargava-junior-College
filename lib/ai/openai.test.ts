import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const keep = { ...process.env };
afterEach(() => { process.env = { ...keep }; vi.unstubAllGlobals(); vi.resetModules(); });

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('OpenAI structured outputs', () => {
  it('sends a strict json_schema request with max_completion_tokens and falls back to the next model on 404', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; delete process.env.OPENAI_MODEL;
    const calls: { model: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ model: body.model, body });
      if (body.model === 'gpt-6.2-sol') return reply(404, { error: { message: 'The model does not exist', code: 'model_not_found' } });
      return reply(200, { model: body.model, choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }));
    const { openaiJson } = await import('./openai');
    const r = await openaiJson({ system: 's', user: 'u', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }, maxTokens: 500 });
    expect(r).toMatchObject({ text: '{"ok":true}', model: 'gpt-6.1-terra', usage: { input: 10, output: 5 } });
    expect(calls.map((c) => c.model)).toEqual(['gpt-6.2-sol', 'gpt-6.1-terra']);
    expect(calls[0].body).toMatchObject({ max_completion_tokens: 500, response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true } } });
    expect(calls[0].body).not.toHaveProperty('max_tokens');
  });

  it('billing errors are not retried on another model', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const f = vi.fn(async () => reply(429, { error: { message: 'You exceeded your current quota', code: 'credit_balance_exhausted', type: 'insufficient_quota' } }));
    vi.stubGlobal('fetch', f);
    const { openaiJson, OpenAiError } = await import('./openai');
    await expect(openaiJson({ system: 's', user: 'u', schema: {}, maxTokens: 10 })).rejects.toBeInstanceOf(OpenAiError);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
