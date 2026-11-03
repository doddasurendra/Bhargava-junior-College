import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { tx } from '../store/file';

/** One row per assistant turn (brief §5.2 analytics). No message text and no personal data. */
export interface AssistantTurnRow {
  conversationId: string;
  mode: 'ai' | 'fallback';
  tools: string[];
  outcome: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  /** unanswered question, personal data stripped */
  question?: string | null;
  createdAt: string;
}

export async function recordTurn(row: Omit<AssistantTurnRow, 'createdAt'>) {
  const createdAt = new Date().toISOString();
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await sb.from('assistant_turns').insert({
        conversation_id: row.conversationId,
        mode: row.mode,
        tools: row.tools,
        outcome: row.outcome,
        input_tokens: row.inputTokens,
        output_tokens: row.outputTokens,
        cache_read_tokens: row.cacheReadTokens,
        question: row.question ?? null,
      });
      if (error) throw new Error(error.message);
    } else {
      await tx((db) => {
        db.assistantTurns.push({ ...row, createdAt });
      });
    }
  } catch (e) {
    // Analytics must never break a chat turn.
    console.error('[assistant] analytics write failed', (e as Error).message);
  }
}

export async function listTurns(sinceIso: string): Promise<AssistantTurnRow[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.from('assistant_turns').select('*').gte('created_at', sinceIso).order('created_at').limit(10000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ conversationId: r.conversation_id, mode: r.mode, tools: r.tools, outcome: r.outcome, inputTokens: r.input_tokens, outputTokens: r.output_tokens, cacheReadTokens: r.cache_read_tokens, question: r.question, createdAt: r.created_at }));
  }
  return tx((db) => db.assistantTurns.filter((t) => t.createdAt >= sinceIso), false);
}
