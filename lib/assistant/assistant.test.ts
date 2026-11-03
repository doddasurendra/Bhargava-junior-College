import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;
let agent: typeof import('./agent');
let session: typeof import('./session');
let tools: typeof import('./tools');
let knowledge: typeof import('./knowledge');
let chat: typeof import('../chat/service');
let repo: import('../crm/types').CrmRepo;

/** Fake Claude: returns scripted responses and records every request. */
function fakeClient(script: Partial<Anthropic.Beta.BetaMessage>[] | Error) {
  const requests: Record<string, unknown>[] = [];
  let i = 0;
  return {
    requests,
    beta: {
      messages: {
        create: async (req: Record<string, unknown>) => {
          requests.push(structuredClone(req));
          if (script instanceof Error) throw script;
          const r = script[Math.min(i++, script.length - 1)];
          return { usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3 }, ...r };
        },
      },
    },
  };
}

const text = (t: string): Partial<Anthropic.Beta.BetaMessage> => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t, citations: null }] as never });
const call = (name: string, input: unknown, id = `tu_${name}`): Partial<Anthropic.Beta.BetaMessage> => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] as never });

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-ai-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  agent = await import('./agent');
  session = await import('./session');
  tools = await import('./tools');
  knowledge = await import('./knowledge');
  chat = await import('../chat/service');
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
});

afterAll(() => {
  agent.__setClientForTests(null);
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => agent.__setClientForTests(null));

describe('knowledge base and tool schemas', () => {
  it('is deterministic (prompt-cache safe) and labels unconfirmed data', () => {
    expect(knowledge.buildKnowledge()).toBe(knowledge.buildKnowledge());
    expect(knowledge.buildKnowledge()).toContain('SAMPLE DATA');
    expect(knowledge.buildKnowledge()).toContain('₹1,35,000');
  });
  it('every tool is strict with all properties required and no extra properties', () => {
    for (const t of tools.TOOLS) {
      const s = t.input_schema as unknown as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(t.strict, t.name).toBe(true);
      expect(s.additionalProperties, t.name).toBe(false);
      expect([...s.required].sort(), t.name).toEqual(Object.keys(s.properties).sort());
    }
  });
});

describe('assistant turns', () => {
  it('runs the tool loop and sends the expected request shape', async () => {
    const fake = fakeClient([call('calculate_fee', { program: 'neet', stay: 'hostel-ac', bsat_score: 82, ssc_10_gpa: false, instalments: 3 }), text('Year 1 comes to ₹2,44,250, payable in 3 instalments.')]);
    agent.__setClientForTests(fake);
    const r = await session.assistantTurn({ text: 'NEET with AC hostel, BSAT 82%, 3 instalments, fee entha?' });
    if ('error' in r) throw new Error(r.error);
    expect(r).toMatchObject({ reply: 'Year 1 comes to ₹2,44,250, payable in 3 instalments.', fallback: false, live: false, links: [{ label: 'Fee calculator', href: '/fees#calculator' }] });

    const [first, second] = fake.requests as Record<string, any>[];
    expect(first).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'low' }, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    expect(first.thinking).toBeUndefined();
    expect(first.tool_choice).toBeUndefined();
    expect(first.system[0].cache_control).toEqual({ type: 'ephemeral' });
    // Per-turn facts arrive as a mid-conversation system message right after the user's message.
    expect(first.messages.at(-1)).toMatchObject({ role: 'system', content: expect.stringContaining('India time') });
    expect(first.messages.at(-2)).toMatchObject({ role: 'user' });
    // The tool result comes back in one user message, after the full assistant content.
    const last = second.messages.at(-1);
    expect(last.role).toBe('user');
    expect(last.content).toHaveLength(1);
    expect(JSON.parse(last.content[0].content)).toMatchObject({ year_1_total: '₹2,44,250', scholarship_percent: 45 });
    // The cached prefix is identical across the two requests.
    expect(second.system).toEqual(first.system);
  });

  it('will not save personal details before the visitor taps "I agree"; then saves, links and scores the lead', async () => {
    const save = call('save_enquiry', { name: 'Srinivas', phone: '98765 22222', program: 'iit-jee', note: 'Wants hostel details' });
    agent.__setClientForTests(fakeClient([save, text('Please tap "I agree" so I can save your details.')]));
    const r1 = await session.assistantTurn({ text: 'I am Srinivas, 9876522222, call me about IIT' });
    if ('error' in r1) throw new Error(r1.error);
    expect(r1.needsConsent).toBe(true);
    expect(await repo.listLeads({ q: '9876522222' })).toHaveLength(0);

    const fake = fakeClient([save, text('Saved! Our admissions team will call you.')]);
    agent.__setClientForTests(fake);
    expect(await session.giveConsent(r1.c, r1.t)).toBe(true);
    const r2 = await session.assistantTurn({ c: r1.c, t: r1.t, text: 'I agree' });
    if ('error' in r2) throw new Error(r2.error);
    expect(r2).toMatchObject({ needsConsent: false, consent: true });
    const [lead] = await repo.listLeads({ q: '9876522222' });
    expect(lead).toMatchObject({ firstSource: 'chat', category: 'warm', program: 'iit-jee' });
    expect((await chat.getConversationStore().get(r1.c))?.leadId).toBe(lead.id);
    // History sent to the model alternates user/assistant text from the stored transcript.
    const msgs = (fake.requests[0] as any).messages.filter((m: any) => m.role !== 'system');
    expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('books a visit (lead becomes hot) and hands off with known details', async () => {
    const r0 = await session.assistantTurn({ text: 'hi' }); // fallback (no client): starts a session
    if ('error' in r0) throw new Error(r0.error);
    await session.giveConsent(r0.c, r0.t);
    const date = '2026-12-01';
    agent.__setClientForTests(
      fakeClient([
        call('book_visit', { name: 'Padma', phone: '9876533333', date, slot: '10:00', program: 'neet', family_size: 2 }),
        call('handoff_to_counsellor', { reason: 'Wants to discuss hostel for girls' }),
        text('Booked, and a counsellor will join shortly.'),
      ]),
    );
    const r = await session.assistantTurn({ c: r0.c, t: r0.t, text: 'Book 1 Dec 10 am for me, Padma, 9876533333, and I want to talk to someone' });
    if ('error' in r) throw new Error(r.error);
    expect(r.live).toBe(true);
    const [lead] = await repo.listLeads({ q: '9876533333' });
    expect(lead.category).toBe('hot');
    expect((await repo.getLeadHistory(lead.id)).visits[0]).toMatchObject({ date, slot: '10:00' });
    const conv = await chat.getConversationStore().get(r0.c);
    expect(conv).toMatchObject({ status: 'waiting', handoffReason: 'Wants to discuss hostel for girls', leadId: lead.id });
    // The assistant cannot be used once the chat is with staff.
    expect(await session.assistantTurn({ c: r0.c, t: r0.t, text: 'hello?' })).toMatchObject({ status: 409 });
  });

  it('records unanswered questions for the knowledge-base backlog, without phone numbers', async () => {
    agent.__setClientForTests(fakeClient([call('note_unanswered', { question: 'Is there a swimming pool? call 9876544444' }), text("I don't know that one. Shall I connect you to a counsellor?")]));
    const r = await session.assistantTurn({ text: 'Is there a swimming pool?' });
    if ('error' in r) throw new Error(r.error);
    const { listTurns } = await import('./analytics');
    const rows = (await listTurns('2000-01-01T00:00:00Z')).filter((t) => t.conversationId === r.c);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mode: 'ai', outcome: 'unanswered', tools: ['note_unanswered'], inputTokens: 20, cacheReadTokens: 6 });
    expect(rows[0].question).toBe('Is there a swimming pool? call •••');
  });

  it('check_application never reveals admission data', async () => {
    const out = await tools.runTool('check_application', {}, { conversationId: 'x', consent: true });
    expect(JSON.parse(out.content)).toMatchObject({ private: true, page: '/track' });
  });

  it('answers a refusal politely and falls back to the rule-based assistant when the API fails', async () => {
    agent.__setClientForTests(fakeClient([{ stop_reason: 'refusal', content: [] as never }]));
    const r1 = await session.assistantTurn({ text: 'something declined' });
    if ('error' in r1) throw new Error(r1.error);
    expect(r1.reply).toMatch(/counsellor/);
    expect(r1.fallback).toBe(false);

    agent.__setClientForTests(fakeClient(new Anthropic.APIConnectionError({ message: 'network down' })));
    const r2 = await session.assistantTurn({ c: r1.c, t: r1.t, text: 'What are the hostel fees?' });
    if ('error' in r2) throw new Error(r2.error);
    expect(r2.fallback).toBe(true);
    expect(r2.reply).toContain('₹1,20,000');
  });

  it('rejects a forged session token', async () => {
    const r = await session.assistantTurn({ text: 'hi' });
    if ('error' in r) throw new Error(r.error);
    expect(await session.assistantTurn({ c: r.c, t: 'x'.repeat(32), text: 'hi' })).toMatchObject({ status: 404 });
  });
});
