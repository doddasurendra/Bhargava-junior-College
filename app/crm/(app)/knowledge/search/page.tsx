import Link from 'next/link';
import { Empty, Panel } from '@/components/crm/ui';
import { AskBox, Marked } from '@/components/kb/client';
import { AccessPill } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { getLang } from '@/lib/i18n-server';
import { LEVELS } from '@/lib/kb/access';
import { ASSISTANT_INFO, assistantsFor, history } from '@/lib/kb/ai';
import { CENTRES, centreById } from '@/lib/kb/centres';
import { kbT, LEVEL_LABEL } from '@/lib/kb/i18n';
import { search } from '@/lib/kb/index';
import { allow, LIMITS } from '@/lib/kb/rate';
import { getSettings, staffViewer } from '@/lib/kb/service';
import { formatDateTime } from '@/lib/dates';
import { HistoryClear } from './HistoryClear';

export const metadata = { title: 'Search & ask' };

type SP = { q?: string; centre?: string; kind?: string; lang?: string; access?: string; assistant?: string };

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const q = (searchParams.q ?? '').trim().slice(0, 300);
  const limited = q && !allow(`search:staff:${user.id}`, LIMITS.staff.search);
  const t0 = Date.now();
  const hits = q && !limited ? await search(v, q, { centre: searchParams.centre || undefined, sourceKind: (searchParams.kind as never) || undefined, lang: (searchParams.lang as never) || undefined, access: (searchParams.access as never) || undefined }, { perSource: true, k: 30 }) : [];
  const ms = Date.now() - t0;
  const assistants = assistantsFor(v);
  const initial = assistants.includes(searchParams.assistant as never) ? (searchParams.assistant as (typeof assistants)[number]) : assistants[0];
  const settings = await getSettings();
  const past = (await history(v)).slice(0, 15);
  return (
    <div className="space-y-5">
      <Panel title={`🔎 ${t.search}`}>
        <form className="grid gap-2 sm:grid-cols-6">
          <input name="q" defaultValue={q} placeholder={t.searchPlaceholder} maxLength={300} className="input py-2 text-sm sm:col-span-2" />
          <select name="centre" defaultValue={searchParams.centre ?? ''} className="input py-2 text-sm"><option value="">{t.centre}: {t.all}</option>{CENTRES.filter((c) => c.kind === 'content' || c.id === 'core').map((c) => <option key={c.id} value={c.id}>{c.name[lang]}</option>)}</select>
          <select name="kind" defaultValue={searchParams.kind ?? ''} className="input py-2 text-sm"><option value="">Type: {t.all}</option><option value="article">{t.articles}</option><option value="file">{t.files}</option><option value="website">Website</option></select>
          <select name="access" defaultValue={searchParams.access ?? ''} className="input py-2 text-sm"><option value="">{t.access}: {t.all}</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l][lang]}</option>)}</select>
          <div className="flex gap-2">
            <select name="lang" defaultValue={searchParams.lang ?? ''} className="input py-2 text-sm"><option value="">{t.language}</option><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिंदी</option></select>
            <button className="btn-primary py-2 text-sm">{t.search}</button>
          </div>
        </form>
        {limited && <p className="mt-3 text-sm text-maroon">Too many searches in a minute. Please wait.</p>}
        {q && !limited && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted">{hits.length} result(s) in {ms} ms · only items you are allowed to see · keyword search in English, Telugu and Hindi{process.env.VOYAGE_API_KEY ? ' + semantic' : ''}</p>
            {hits.length === 0 ? <Empty>{t.noResults}</Empty> : (
              <ul className="space-y-2">
                {hits.map((h) => (
                  <li key={h.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={h.href} className="font-medium text-heading underline">{h.sourceKind === 'file' ? '📄' : h.sourceKind === 'website' ? '🌐' : '📝'} {h.title}{h.page ? ` · ${h.pageLabel} ${h.page}` : ''}</Link>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted">{centreById(h.centre)?.name[lang]} · {h.lang} · score {h.score}<AccessPill access={h.access} sensitivity={h.sensitivity} lang={lang} /></span>
                    </div>
                    {h.section && <p className="mt-0.5 text-xs text-muted">{h.section}</p>}
                    <p className="mt-1 text-sm leading-6"><Marked text={h.snippet} /></p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>
      <Panel title={`🤖 ${t.ask}`}>
        <AskBox assistants={assistants.map((a) => ({ id: a, name: ASSISTANT_INFO[a].name[lang] }))} initial={initial} suggestions={(settings.assistants[initial]?.suggestions?.length ? settings.assistants[initial].suggestions : ASSISTANT_INFO[initial].suggestions[lang]).slice(0, 4)} labels={{ placeholder: t.askPlaceholder, ask: t.askButton, sources: t.sources, page: t.page, basedOn: t.basedOn, helpful: t.helpful, notHelpful: t.notHelpful, suggested: t.suggested }} />
      </Panel>
      <Panel title={t.history} actions={past.length ? <HistoryClear label={t.clearHistory} /> : undefined}>
        {past.length === 0 ? <Empty>No questions yet.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {past.map((m, i) => (
              <li key={i} className="py-2">
                <p className="font-medium">{m.q} <span className="text-xs text-muted">· {formatDateTime(m.at)} · {ASSISTANT_INFO[m.assistant as keyof typeof ASSISTANT_INFO]?.name[lang] ?? m.assistant}{m.feedback ? ` · ${m.feedback === 'up' ? '👍' : '👎'}` : ''}</span></p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{m.a}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
