import { cookies } from 'next/headers';
import Link from 'next/link';
import { GuideApp, type GuideMode, type GuideSessionView } from '@/components/parentCounselling/GuideApp';
import { getStaffSession } from '@/lib/crm/auth';
import { can, canSeeLead } from '@/lib/crm/permissions';
import { getCrmRepo } from '@/lib/crm/repo';
import { listLeads } from '@/lib/crm/service';
import { maskPhone } from '@/lib/phone';
import { getContent } from '@/lib/cms';
import { GUIDE_LANG_COOKIE, guideContent, isGuideLang, PDF_PATH, type GuideLang, type GuideSettings } from '@/lib/parentCounselling/content';
import { getGuideSession } from '@/lib/parentCounselling/sessions';
import { startGuideSessionAction } from './actions';

export type GuideSearch = { lang?: string; mode?: string; session?: string; q?: string; error?: string };

/** Shared server entry for /parent-counselling, /parent-counselling/step-N and /parent-counselling/print. */
export async function GuideServer({ page, searchParams, print = false }: { page: number; searchParams: GuideSearch; print?: boolean }) {
  const cookieLang = cookies().get(GUIDE_LANG_COOKIE)?.value;
  const lang: GuideLang = isGuideLang(searchParams.lang) ? searchParams.lang : isGuideLang(cookieLang) ? cookieLang : 'te';
  const c = guideContent(lang);
  const { parentCounselling } = await getContent();
  const settings: GuideSettings = {
    calls: parentCounselling.calls, visits: parentCounselling.visits, progress: parentCounselling.progress, medical: parentCounselling.medical,
    laundry: parentCounselling.laundry, tuition: parentCounselling.tuition, hostelFee: parentCounselling.hostelFee, scholarship: parentCounselling.scholarship,
    schedule: parentCounselling.schedule, visiting: parentCounselling.visiting, lastDate: parentCounselling.lastDate,
  };

  const wantsCounsellor = searchParams.mode === 'counsellor' || Boolean(searchParams.session);
  const user = wantsCounsellor ? await getStaffSession() : null;
  const isCounsellor = Boolean(user && can(user, 'counselling.record'));
  let session: GuideSessionView | null = null;

  if (isCounsellor && searchParams.session) {
    const s = await getGuideSession(searchParams.session);
    if (s && (s.counsellorId === user!.id || can(user!, 'lead.viewAll'))) {
      const lead = await getCrmRepo().getLead(s.leadId);
      const label = lead ? `${lead.studentName ?? lead.contactName ?? lead.parentName ?? 'Lead'} · ${maskPhone(lead.phone)}` : s.leadId;
      session = { id: s.id, leadLabel: label, answers: s.answers, ended: Boolean(s.endedAt) };
    }
  }

  // Counsellor without a session: choose or create the lead first.
  if (isCounsellor && !session && !print) {
    const rows = (await listLeads(user!, { q: searchParams.q?.slice(0, 60) || undefined })).filter((r) => canSeeLead(user!, r.lead)).slice(0, 40);
    const app = c.ui.app;
    return (
      <div className="container-x py-10">
        <p className="eyebrow">{app.counsellorMode}</p>
        <h1 className="mt-2 font-display text-3xl text-heading">{c.cover.title1} {c.cover.title2}</h1>
        <p className="mt-2 text-sm text-muted">{c.cover.sub1}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {(['te', 'en', 'hi'] as const).map((l) => (
            <Link key={l} href={`/parent-counselling?mode=counsellor&lang=${l}`} className={l === lang ? 'btn-primary px-3 py-1' : 'btn-outline px-3 py-1'}>{guideContent(l).ui.app.language}: {l.toUpperCase()}</Link>
          ))}
          <Link href={`/parent-counselling?lang=${lang}`} className="btn-outline px-3 py-1">{c.cover.footer} →</Link>
        </div>
        {searchParams.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Lead not found or details missing. Check the name and a valid 10-digit mobile number.</p>}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="font-semibold text-heading">{app.chooseLead}</h2>
            <form method="get" className="mt-3 flex gap-2">
              <input type="hidden" name="mode" value="counsellor" />
              <input type="hidden" name="lang" value={lang} />
              <input name="q" defaultValue={searchParams.q ?? ''} placeholder={app.searchLead} className="input flex-1" />
              <button className="btn-outline">🔍</button>
            </form>
            <ul className="mt-4 max-h-[420px] divide-y divide-line overflow-y-auto">
              {rows.map(({ lead }) => (
                <li key={lead.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 text-sm">
                    <b className="text-heading">{lead.studentName ?? lead.contactName ?? '—'}</b>
                    <span className="block truncate text-xs text-muted">{lead.parentName ?? lead.contactName ?? ''} · {maskPhone(lead.phone)} · {lead.status}</span>
                  </span>
                  <form action={startGuideSessionAction}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <button className="btn-primary px-3 py-1.5 text-sm">{app.startSession}</button>
                  </form>
                </li>
              ))}
              {!rows.length && <li className="py-3 text-sm text-muted">—</li>}
            </ul>
          </section>
          <section className="card p-6">
            <h2 className="font-semibold text-heading">{app.newLead}</h2>
            <form action={startGuideSessionAction} className="mt-3 grid gap-3">
              <input type="hidden" name="lang" value={lang} />
              <label className="text-sm">{app.parentName}<input name="parentName" required maxLength={80} className="input mt-1 w-full" /></label>
              <label className="text-sm">{app.studentName}<input name="studentName" maxLength={80} className="input mt-1 w-full" /></label>
              <label className="text-sm">{app.phone}<input name="phone" required inputMode="tel" maxLength={15} className="input mt-1 w-full" /></label>
              <button className="btn-primary w-fit">{app.startSession}</button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  const mode: GuideMode = print ? 'print' : session ? 'counsellor' : 'public';
  const q = new URLSearchParams();
  q.set('lang', lang);
  if (session) { q.set('mode', 'counsellor'); q.set('session', session.id); }
  return <GuideApp lang={lang} c={c} settings={settings} mode={mode} session={session} initialPage={page} pdfUrl={PDF_PATH} query={`?${q.toString()}`} />;
}
