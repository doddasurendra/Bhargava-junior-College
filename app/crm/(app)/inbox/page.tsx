import Link from 'next/link';
import { AutoRefresh, ClaimButton, CloseForm, ReplyForm, ScrollToEnd, TransferForm } from '@/components/crm/inboxForms';
import { CategoryBadge, Empty, programShort } from '@/components/crm/ui';
import { conversationView, inboxList, type InboxView } from '@/lib/chat/inbox';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';
import { CrmError } from '@/lib/crm/service';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Chat inbox' };

const VIEWS: { value: InboxView; label: string }[] = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'mine', label: 'Mine' },
  { value: 'open', label: 'All open' },
  { value: 'closed', label: 'Closed' },
];

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export default async function InboxPage({ searchParams }: { searchParams: { view?: string; c?: string } }) {
  const user = await requireStaff('inbox.reply');
  const view = (VIEWS.find((v) => v.value === searchParams.view)?.value ?? 'waiting') as InboxView;
  const list = await inboxList(user, view);
  let selected: Awaited<ReturnType<typeof conversationView>> | null = null;
  if (searchParams.c) {
    try {
      selected = await conversationView(user, searchParams.c);
    } catch (e) {
      if (!(e instanceof CrmError)) throw e;
    }
  }
  const staffName = (id: string | null) => (id ? selected?.staff.find((s) => s.id === id)?.fullName ?? 'Staff' : '');
  const c = selected?.conv;
  const mine = c?.assigneeId === user.id;
  const disabledReason = !selected
    ? null
    : !selected.canReply
      ? c?.status === 'closed'
        ? 'This conversation is closed.'
        : 'Someone else is handling this conversation.'
      : !selected.freeTextOk
        ? 'More than 24 hours since the family’s last WhatsApp message. WhatsApp only allows an approved template now; send one from the lead page, or call.'
        : null;

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-heading">Chat inbox</h1>
        <p className="text-xs text-muted">Website chat handoffs and WhatsApp messages from families. Updates every few seconds.</p>
      </div>

      <nav aria-label="Inbox views" className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Link key={v.value} href={`/crm/inbox?view=${v.value}`} className={`chip px-3.5 py-1.5 text-sm ${view === v.value ? 'chip-active' : ''}`}>
            {v.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-surface">
          {list.length === 0 && (
            <li className="p-4">
              <Empty>{view === 'waiting' ? 'Nobody is waiting. 🎉' : 'No conversations here.'}</Empty>
            </li>
          )}
          {list.map((x) => (
            <li key={x.id}>
              <Link href={`/crm/inbox?view=${view}&c=${x.id}`} className={`flex gap-3 p-3 hover:bg-bg ${x.id === c?.id ? 'bg-gold-100/50 dark:bg-gold/10' : ''}`}>
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ${x.channel === 'whatsapp' ? 'bg-[#25D366] text-white' : 'bg-navy text-white'}`}>{x.channel === 'whatsapp' ? 'WA' : 'WEB'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-heading">{x.contactName ?? (x.contactPhone ? phoneFor(user, x.contactPhone) : null) ?? 'Visitor'}</span>
                    <span className="shrink-0 text-[11px] text-muted">{ago(x.lastMessageAt)}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {x.status === 'waiting' ? `Waiting · ${x.handoffReason ?? ''}` : x.status === 'closed' ? `Closed · ${x.closeNote ?? ''}` : `With ${x.assigneeName}`}
                  </span>
                </span>
                {x.unread > 0 && x.status !== 'closed' && <span className="mt-1 grid h-5 min-w-5 place-items-center self-start rounded-full bg-maroon px-1 text-[11px] font-bold text-white">{x.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>

        {!selected || !c ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line p-10 text-sm text-muted">Choose a conversation.</div>
        ) : (
          <section className="flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-heading">
                  {c.contactName ?? 'Visitor'} <span className="font-mono text-sm font-normal text-muted">{phoneFor(user, c.contactPhone)}</span>
                </p>
                <p className="text-xs text-muted">
                  {c.channel === 'whatsapp' ? 'WhatsApp' : 'Website chat'} · {c.status === 'assigned' ? `with ${staffName(c.assigneeId)}` : c.status}
                  {c.channel === 'whatsapp' && selected.windowClosesAt && c.status !== 'closed' && ` · reply window ${selected.freeTextOk ? `open until ${formatDateTime(selected.windowClosesAt)}` : 'closed'}`}
                </p>
                {selected.lead && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {selected.leadVisible ? (
                      <Link href={`/crm/leads/${selected.lead.id}`} className="font-semibold text-maroon underline dark:text-gold">
                        Open lead
                      </Link>
                    ) : (
                      <span className="text-muted">Lead owned by a colleague</span>
                    )}
                    <span>{programShort(selected.lead.program)}</span>
                    <CategoryBadge category={selected.lead.category} />
                  </p>
                )}
              </div>
              {c.status !== 'closed' && (
                <div className="flex flex-wrap items-center gap-2">
                  {(c.status === 'waiting' || (!mine && selected.canReply)) && <ClaimButton id={c.id} />}
                  {selected.canReply && c.status === 'assigned' && <TransferForm id={c.id} targets={selected.transferTargets} />}
                  {selected.canReply && c.status === 'assigned' && <CloseForm id={c.id} />}
                </div>
              )}
            </header>

            <ol className="flex-1 space-y-2 overflow-y-auto bg-bg p-4">
              {selected.messages.map((m) => (
                <li key={m.id} className={`flex ${m.author === 'contact' ? 'justify-start' : m.author === 'system' || m.author === 'note' ? 'justify-center' : 'justify-end'}`}>
                  {m.author === 'system' ? (
                    <p className="max-w-[80%] rounded-lg bg-gold-100 px-3 py-1 text-center text-xs text-navy">{m.text}</p>
                  ) : m.author === 'note' ? (
                    <p className="max-w-[80%] rounded-lg border border-dashed border-line px-3 py-1 text-center text-xs text-muted" title="Only staff can see this">
                      🔒 {m.text}
                    </p>
                  ) : (
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.author === 'contact' ? 'rounded-bl-sm bg-surface ring-1 ring-line' : m.author === 'bot' ? 'rounded-br-sm bg-navy/10 text-ink dark:bg-white/10' : 'rounded-br-sm bg-navy text-white'}`}>
                      <p className="mb-0.5 text-[11px] font-semibold opacity-70">{m.author === 'contact' ? c.contactName ?? 'Family' : m.author === 'bot' ? 'Assistant (before handoff)' : staffName(m.staffId)}</p>
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>
                      <p className="mt-1 text-right text-[10px] opacity-60">{formatDateTime(m.createdAt)}</p>
                    </div>
                  )}
                </li>
              ))}
              <ScrollToEnd dep={`${c.id}:${selected.messages.length}`} />
            </ol>

            <footer className="border-t border-line p-3">
              <ReplyForm id={c.id} disabledReason={disabledReason} />
            </footer>
          </section>
        )}
      </div>
    </div>
  );
}
