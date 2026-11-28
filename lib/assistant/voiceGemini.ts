import 'server-only';
import { college } from '@/content/college';
import { geminiGenerate } from '../ai/gemini';
import { isOfficeOpen, nextOpening, formatOpening } from '../chat/hours';
import { formatDate, todayIST } from '../dates';
import { botContent } from '../kb/publicFeed';
import { AssistantUnavailable, type AssistantResult, type Turn } from './agent';
import { buildKnowledge } from './knowledge';

/**
 * Voice assistant answers with Google Gemini, from the same college knowledge base the chat assistant uses.
 * Voice has no tools: it answers questions and points to a counsellor or the website for actions.
 */
const RULES = `You are the Bhargava voice assistant for ${college.name}, Saroornagar, Hyderabad, speaking with parents and students.
- Use only the knowledge base below. If it does not cover the question, say you don't have that information and suggest talking to a counsellor (the "Talk to a counsellor" button or the college phone number). Never invent fees, dates, results, facilities or policies.
- Items marked SAMPLE DATA are not yet confirmed by the college: say they are "currently listed" and that a counsellor can confirm.
- Never promise or predict ranks, seats or results.
- Reply in the same language and script as the visitor: English, Telugu or Hindi.
- Your reply is spoken aloud: 1 to 3 short sentences, natural speech, no lists, no markdown, no URLs, no emojis.
- To book a visit or apply, tell them to use the website's Book a visit / Apply pages or ask for a counsellor; you cannot save details by voice.
- If someone sounds distressed or unsafe, gently tell them to talk to the college counsellor or call Tele-MANAS 14416.`;

let cache: { content: unknown; text: string } | null = null;

export async function geminiVoiceTurn(history: Turn[], now = new Date()): Promise<AssistantResult> {
  const content = await botContent();
  if (cache?.content !== content) cache = { content, text: buildKnowledge(content) };
  const open = isOfficeOpen(now);
  const situation = `Today is ${formatDate(todayIST(now), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (India time). The admissions office is ${open ? 'open now' : `closed now; it next opens ${formatOpening(nextOpening(now))}`}.`;
  try {
    const r = await geminiGenerate({
      system: `${RULES}\n\n${situation}\n\n<knowledge_base>\n${cache.text}\n</knowledge_base>`,
      turns: history.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', text: t.text })),
      maxTokens: 600,
    });
    return { text: r.text, effects: {}, tools: [`gemini:${r.model}`], refused: false, usage: { input: r.usage.input, output: r.usage.output, cacheRead: 0 } };
  } catch (e) {
    throw new AssistantUnavailable(`gemini: ${(e as Error).message}`);
  }
}
