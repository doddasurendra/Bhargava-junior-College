import { Empty, Stat } from '@/components/crm/ui';
import { ASSISTANT_MODEL } from '@/lib/assistant/agent';
import { listTurns } from '@/lib/assistant/analytics';
import { requireStaff } from '@/lib/crm/auth';

export const metadata = { title: 'AI assistant' };
export const dynamic = 'force-dynamic';

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

export default async function AssistantAnalyticsPage({ searchParams }: { searchParams: { days?: string } }) {
  await requireStaff('whatsapp.setup'); // managers
  const days = RANGES.find((r) => String(r.days) === searchParams.days)?.days ?? 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const turns = await listTurns(since);

  const chats = new Set(turns.map((t) => t.conversationId));
  const count = (o: string) => new Set(turns.filter((t) => t.outcome === o).map((t) => t.conversationId)).size;
  const handoffs = count('handoff');
  const ai = turns.filter((t) => t.mode === 'ai');
  const fallbackPct = turns.length ? Math.round(((turns.length - ai.length) / turns.length) * 100) : 0;
  const unanswered = turns.filter((t) => t.outcome === 'unanswered' && t.question);
  const resolved = chats.size ? Math.round(((chats.size - handoffs) / chats.size) * 100) : 0;
  const inTok = ai.reduce((n, t) => n + (t.inputTokens ?? 0), 0);
  const cacheTok = ai.reduce((n, t) => n + (t.cacheReadTokens ?? 0), 0);
  const toolCounts = new Map<string, number>();
  for (const t of ai) for (const name of t.tools) toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">AI admission assistant</h1>
          <p className="mt-1 text-sm text-muted">
            Website chat · model <span className="font-mono">{ASSISTANT_MODEL}</span> · {process.env.ASSISTANT_DISABLED === '1' ? 'disabled (rule-based assistant only)' : 'enabled'}
          </p>
        </div>
        <nav className="flex gap-1.5">
          {RANGES.map((r) => (
            <a key={r.days} href={`/crm/assistant?days=${r.days}`} className={`chip px-3.5 py-1.5 text-sm ${r.days === days ? 'chip-active' : ''}`}>
              {r.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Chats" value={chats.size} />
        <Stat label="Messages" value={turns.length} />
        <Stat label="Resolved by assistant" value={`${resolved}%`} tone="good" />
        <Stat label="Handed to staff" value={handoffs} />
        <Stat label="Leads saved" value={count('lead_saved')} tone="good" />
        <Stat label="Visits booked" value={count('visit_booked')} tone="good" />
        <Stat label="BSAT registrations" value={count('bsat_registered')} tone="good" />
        <Stat label="Fallback answers" value={`${fallbackPct}%`} tone={fallbackPct > 10 ? 'warn' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-heading">Unanswered questions ({unanswered.length})</h2>
          <p className="mb-3 text-xs text-muted">Questions the knowledge base could not answer. Add the answers to the site content (and later the CMS) so the assistant can use them.</p>
          {unanswered.length === 0 ? (
            <Empty>None in this period.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {unanswered.slice(-50).reverse().map((t, i) => (
                <li key={i} className="flex justify-between gap-4 py-2">
                  <span>{t.question}</span>
                  <span className="shrink-0 text-xs text-muted">{t.mode === 'fallback' ? 'fallback' : 'AI'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-heading">Tools used</h2>
            {toolCounts.size === 0 ? (
              <p className="mt-2 text-sm text-muted">No tool calls yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {Array.from(toolCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([n, c]) => (
                    <li key={n} className="flex justify-between">
                      <span className="font-mono text-xs">{n}</span>
                      <span className="font-mono">{c}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <h2 className="text-sm font-semibold text-heading">Prompt caching</h2>
            <p className="mt-2 text-muted">
              {inTok + cacheTok === 0 ? 'No AI turns yet.' : `${Math.round((cacheTok / (inTok + cacheTok)) * 100)}% of input tokens were served from the prompt cache.`}
            </p>
            <p className="mt-1 text-xs text-muted">Refusals in this period: {count('refusal')}.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
