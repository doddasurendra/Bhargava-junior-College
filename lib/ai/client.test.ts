import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const keep = { ...process.env };
afterEach(() => { process.env = { ...keep }; });

describe('AI provider selection', () => {
  it('prefers OpenRouter, maps model ids, and reports no provider without keys', async () => {
    const A = await import('./client');
    delete process.env.OPENROUTER_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENROUTER_MODEL; delete process.env.ASSISTANT_DISABLED;
    expect(A.aiProvider()).toBeNull();
    expect(A.aiAvailable()).toBe(false);
    process.env.ANTHROPIC_API_KEY = 'x';
    expect(A.aiProvider()).toBe('anthropic');
    expect(A.aiModel('claude-opus-5-5')).toBe('claude-opus-5-5');
    expect(A.anthropicExtras()).toBe(true);
    process.env.OPENROUTER_API_KEY = 'y';
    expect(A.aiProvider()).toBe('openrouter');
    expect(A.aiModel('claude-opus-5-5')).toBe('anthropic/claude-opus-5.5');
    expect(A.aiModel('claude-haiku-5-5')).toBe('anthropic/claude-haiku-5.5');
    expect(A.anthropicExtras()).toBe(false);
    process.env.OPENROUTER_MODEL = 'anthropic/claude-sonnet-5.5';
    expect(A.aiModel('claude-opus-5-5')).toBe('anthropic/claude-sonnet-5.5');
    const c = A.aiClient();
    expect(c.baseURL).toBe('https://openrouter.ai/api');
    process.env.ASSISTANT_DISABLED = '1';
    expect(A.aiAvailable()).toBe(false);
  });
  it('reads JSON from plain or fenced replies', async () => {
    const { jsonFromText } = await import('./client');
    expect(jsonFromText('{"a":1}')).toEqual({ a: 1 });
    expect(jsonFromText('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(jsonFromText('Here you go: {"a":3} thanks')).toEqual({ a: 3 });
    expect(() => jsonFromText('no json')).toThrow();
  });
});
