import 'server-only';
import { reply as fallbackReply } from '../chat/faqBot';
import { getContent } from '../cms';
import { getConversationStore, handoffExisting, startBotConversation, visitorConversation } from '../chat/service';
import type { Conversation } from '../chat/types';
import type { Attribution } from '../validation';
import { AssistantUnavailable, runAssistant, type Turn } from './agent';
import { recordTurn } from './analytics';
import { detectLang, GREETING, groundedAnswer, isGreeting } from '../rag';
import { detectDistress } from '../studentLife/safety';
import { raiseSafetyAlert } from '../studentLife/wellbeing';

const MAX_TURNS_PER_CHAT = 40;
const HISTORY_TURNS = 24;

export interface TurnResponse {
  c: string;
  t: string;
  reply: string;
  links: { label: string; href: string }[];
  /** the AI was unavailable and the rule-based assistant answered */
  fallback: boolean;
  needsConsent: boolean;
  consent: boolean;
  /** the conversation is now with staff: switch the widget to live mode */
  live: boolean;
  /** the assistant wants a handoff but has no contact details: show the handoff form */
  handoffForm: { reason: string } | null;
}

async function history(convId: string): Promise<Turn[]> {
  const msgs = (await getConversationStore().messages(convId)).filter((m) => m.author === 'contact' || m.author === 'bot');
  const turns = msgs.slice(-HISTORY_TURNS).map((m): Turn => ({ role: m.author === 'contact' ? 'user' : 'assistant', text: m.text }));
  while (turns.length && turns[0].role !== 'user') turns.shift(); // the API requires a user turn first
  return turns;
}

export async function assistantTurn(p: { c?: string; t?: string; text: string; attribution?: Attribution }): Promise<TurnResponse | { error: string; status: number }> {
  let conv: Conversation | null = null;
  let token = p.t ?? '';
  if (p.c && p.t) {
    conv = await visitorConversation(p.c, p.t);
    if (!conv) return { error: 'Chat not found.', status: 404 };
  } else {
    const started = await startBotConversation();
    conv = started.conv;
    token = started.token;
  }
  if (conv.status !== 'bot') return { error: 'This chat is with a counsellor now.', status: 409 };

  const st = getConversationStore();
  const prior = (await st.messages(conv.id)).filter((m) => m.author === 'contact').length;
  if (prior >= MAX_TURNS_PER_CHAT) return { error: 'This chat is very long. Please talk to a counsellor or start a new chat.', status: 429 };

  await st.addMessage({ conversationId: conv.id, author: 'contact', staffId: null, text: p.text, waMessageId: null });
  const consent = Boolean(conv.consentAt);
  const base = { c: conv.id, t: token, consent };

  // Safety protocol: the AI never counsels. Possible distress → a calm message with the helpline, an alert to
  // the Student Counsellor and the Principal, and the chat goes to a person (chat and voice share this path).
  if (detectDistress(p.text)) {
    const safety = await raiseSafetyAlert({ source: 'chat', refId: conv.id, studentId: null, text: p.text });
    await st.addMessage({ conversationId: conv.id, author: 'bot', staffId: null, text: safety.message, waMessageId: null });
    await st.update(conv.id, { status: 'waiting', handoffReason: 'Wellbeing safety alert: please respond now', handoffAt: new Date().toISOString() });
    return { ...base, reply: safety.message, links: [{ label: 'Wellbeing support', href: '/student-life/wellbeing' }], fallback: false, needsConsent: false, live: true, handoffForm: null };
  }

  try {
    const r = await runAssistant(await history(conv.id), { conversationId: conv.id, consent, attribution: p.attribution });
    await st.addMessage({ conversationId: conv.id, author: 'bot', staffId: null, text: r.text, waMessageId: null });
    await recordTurn({
      conversationId: conv.id,
      mode: 'ai',
      tools: r.tools,
      outcome: r.refused ? 'refusal' : r.effects.outcome ?? (r.effects.unanswered ? 'unanswered' : null),
      inputTokens: r.usage.input,
      outputTokens: r.usage.output,
      cacheReadTokens: r.usage.cacheRead,
      question: r.effects.unanswered ?? null,
    });

    let live = false;
    let handoffForm: TurnResponse['handoffForm'] = null;
    if (r.effects.handoff) {
      const fresh = (await st.get(conv.id))!;
      if (fresh.contactName && fresh.contactPhone && fresh.consentAt) {
        await handoffExisting(fresh, { name: fresh.contactName, phone: fresh.contactPhone, reason: r.effects.handoff.reason, attribution: p.attribution });
        live = true;
      } else {
        handoffForm = { reason: r.effects.handoff.reason };
      }
    }
    return { ...base, reply: r.text, links: dedupe(r.effects.links ?? []), fallback: false, needsConsent: Boolean(r.effects.needsConsent) && !consent, live, handoffForm };
  } catch (e) {
    if (!(e instanceof AssistantUnavailable)) console.error('[assistant] turn failed', (e as Error).message);
    // Fallback: the rule-based assistant for its known intents, then the shared BJC knowledge base (RAG) for
    // everything else — answers only from verified site content, or says honestly that it couldn't find it.
    const content = await getContent();
    let fb = fallbackReply(p.text, content);
    if (isGreeting(p.text)) fb = { intent: 'greeting', text: GREETING[detectLang(p.text)], links: [] } as unknown as typeof fb;
    // Action intents (greeting, book a visit, track, counsellor, "guarantee" questions) keep their scripted
    // replies; every factual question is answered from the knowledge base with sources, or honestly not found.
    const ACTIONS = ['greeting', 'visit', 'track', 'handoff', 'rank'];
    if (!ACTIONS.includes(fb.intent)) {
      const g = groundedAnswer(content, p.text);
      if (g.found || fb.intent === 'unknown' || detectLang(p.text) !== 'en') fb = { intent: g.found ? 'kb' : 'unknown', text: g.found ? `${g.text}\n\n${g.footer}` : g.text, links: g.sources.map((s) => ({ label: s.title, href: s.url })), offerHandoff: !g.found } as typeof fb;
    }
    await st.addMessage({ conversationId: conv.id, author: 'bot', staffId: null, text: fb.text, waMessageId: null });
    await recordTurn({
      conversationId: conv.id,
      mode: 'fallback',
      tools: [],
      outcome: fb.intent === 'unknown' ? 'unanswered' : null,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      question: fb.intent === 'unknown' ? p.text.replace(/\+?\d[\d\s-]{4,}\d/g, '•••').slice(0, 300) : null,
    });
    return { ...base, reply: fb.text, links: fb.links ?? [], fallback: true, needsConsent: false, live: false, handoffForm: fb.intent === 'handoff' ? { reason: 'Asked for a counsellor' } : null };
  }
}

/** Explicit consent from a button tap in the widget (DPDP Act 2023). The model can never set this. */
export async function giveConsent(c: string, t: string) {
  const conv = await visitorConversation(c, t);
  if (!conv) return false;
  if (!conv.consentAt) await getConversationStore().update(conv.id, { consentAt: new Date().toISOString() });
  return true;
}

function dedupe(links: { label: string; href: string }[]) {
  return links.filter((l, i) => links.findIndex((x) => x.href === l.href) === i);
}
