import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { OpenBookError, settings } from './core';

/**
 * Server-side Claude calls for Open Book (keys never reach the browser). Every call returns JSON constrained
 * by a JSON schema (structured outputs) and validated again with zod. Without ANTHROPIC_API_KEY the features
 * say "AI is not configured" — nothing is ever faked.
 */
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY && process.env.ASSISTANT_DISABLED !== '1';

export class AiNotConfigured extends OpenBookError {
  constructor() {
    super('AI is not configured on this server yet (ANTHROPIC_API_KEY is missing). The college needs to add it before AI features work.');
  }
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ maxRetries: 2, timeout: 180_000 }));

export type Part = { kind: 'text'; text: string } | { kind: 'image'; mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: Uint8Array } | { kind: 'pdf'; data: Uint8Array };

export interface JsonCall<T> {
  system: string;
  parts: Part[];
  /** JSON schema for output_config.format (all objects: additionalProperties false, every property required) */
  jsonSchema: Record<string, unknown>;
  validate: z.ZodType<T>;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}

export async function callJson<T>(c: JsonCall<T>): Promise<{ data: T; model: string; usage: { input: number; output: number } }> {
  const s = await settings();
  if (!aiConfigured() || !s.aiEnabled) throw new AiNotConfigured();
  const content: Anthropic.ContentBlockParam[] = c.parts.map((p) =>
    p.kind === 'text'
      ? { type: 'text', text: p.text }
      : p.kind === 'pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(p.data).toString('base64') } }
        : { type: 'image', source: { type: 'base64', media_type: p.mime, data: Buffer.from(p.data).toString('base64') } },
  );
  let r: Anthropic.Message;
  try {
    r = await getClient().messages.create({
      model: s.model,
      max_tokens: c.maxTokens ?? 16000,
      system: [{ type: 'text', text: c.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
      output_config: { effort: c.effort ?? 'medium', format: { type: 'json_schema', schema: c.jsonSchema } },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new OpenBookError('The AI service is busy. Please try again in a minute.');
    if (e instanceof Anthropic.AuthenticationError) throw new OpenBookError('The AI key on the server was rejected. Ask the administrator to check ANTHROPIC_API_KEY.');
    if (e instanceof Anthropic.APIError) throw new OpenBookError(`The AI service returned an error (${e.status ?? 'network'}). Please try again.`);
    throw e;
  }
  if (r.stop_reason === 'refusal') throw new OpenBookError('The AI declined this request. Try rephrasing it.');
  if (r.stop_reason === 'max_tokens') throw new OpenBookError('The answer was too long. Ask for fewer items.');
  const text = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OpenBookError('The AI returned an unreadable answer. Please try again.');
  }
  const v = c.validate.safeParse(parsed);
  if (!v.success) throw new OpenBookError('The AI answer did not match the expected format. Please try again.');
  return { data: v.data, model: r.model, usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } };
}

/** JSON-schema helpers (structured outputs need additionalProperties:false and all properties required). */
export const S = {
  str: (description?: string) => ({ type: 'string', ...(description ? { description } : {}) }),
  num: () => ({ type: 'number' }),
  int: () => ({ type: 'integer' }),
  bool: () => ({ type: 'boolean' }),
  arr: (items: Record<string, unknown>) => ({ type: 'array', items }),
  enum: (values: string[]) => ({ type: 'string', enum: values }),
  obj: (props: Record<string, Record<string, unknown>>) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false }),
};
