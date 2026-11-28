import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const keep = { ...process.env };
afterEach(() => { process.env = { ...keep }; vi.unstubAllGlobals(); vi.resetModules(); });
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Gemini (Google AI Studio) client', () => {
  it('sends system instruction + turns with the key header, skips thought parts, falls back on 404', async () => {
    process.env.GOOGLE_AI_STUDIO_API_KEY = 'test-key'; delete process.env.GEMINI_MODEL;
    const seen: { url: string; key: string | null; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, key: new Headers(init.headers).get('x-goog-api-key'), body: JSON.parse(String(init.body)) });
      if (url.includes('gemini-3.8-flash')) return reply(503, { error: { status: 'UNAVAILABLE', message: 'high demand' } });
      return reply(200, { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'We offer four programs.' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 5 } });
    }));
    const { geminiGenerate, geminiConfigured } = await import('./gemini');
    expect(geminiConfigured()).toBe(true);
    const r = await geminiGenerate({ system: 'rules', turns: [{ role: 'user', text: 'programs?' }] });
    expect(r).toMatchObject({ text: 'We offer four programs.', model: 'gemini-3.5-flash-lite', usage: { input: 9, output: 5 } });
    expect(seen.map((s) => s.url.split('/models/')[1])).toEqual(['gemini-3.8-flash:generateContent', 'gemini-3.5-flash-lite:generateContent']);
    expect(seen[0].key).toBe('test-key');
    expect(seen[0].body).toMatchObject({ systemInstruction: { parts: [{ text: 'rules' }] }, contents: [{ role: 'user', parts: [{ text: 'programs?' }] }] });
  });

  it('a quota error is not retried on another model; no key means not configured', async () => {
    process.env.GOOGLE_AI_STUDIO_API_KEY = 'test-key';
    const f = vi.fn(async () => reply(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }));
    vi.stubGlobal('fetch', f);
    const { geminiGenerate } = await import('./gemini');
    await expect(geminiGenerate({ system: 's', turns: [{ role: 'user', text: 'x' }] })).rejects.toThrow(/429/);
    expect(f).toHaveBeenCalledTimes(1);
    delete process.env.GOOGLE_AI_STUDIO_API_KEY; delete process.env.GEMINI_API_KEY;
    vi.resetModules();
    expect((await import('./gemini')).geminiConfigured()).toBe(false);
  });
});
