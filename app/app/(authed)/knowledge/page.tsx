import Link from 'next/link';
import { raiseGrievanceAction } from '@/app/app/kb-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { AskBox, KbLangSwitch } from '@/components/kb/client';
import { OfflineCache } from '@/components/kb/Offline';
import { SamplePill } from '@/components/kb/ui';
import { requireAppUser } from '@/lib/app/service';
import { formatDate } from '@/lib/dates';
import { getLang } from '@/lib/i18n-server';
import { ASSISTANT_INFO, assistantsFor } from '@/lib/kb/ai';
import { centreById } from '@/lib/kb/centres';
import { kbGrievances } from '@/lib/kb/collections';
import { listFiles } from '@/lib/kb/files';
import { kbT, pick } from '@/lib/kb/i18n';
import { familyLive } from '@/lib/kb/live';
import { audit, getSettings, listArticles } from '@/lib/kb/service';
import { currentViewer } from '@/lib/kb/viewer';
import { getRecordStore } from '@/lib/records';

export const metadata = { title: 'Knowledge' };

const T = {
  en: { mine: 'For you', recent: 'Recent results', upcoming: 'Upcoming tests', grievance: 'Raise a grievance', myGrievances: 'My grievances', docs: 'Documents', offline: '{n} articles saved on this phone for offline reading', none: 'Nothing here yet.', other: 'Also useful' },
  te: { mine: 'మీ కోసం', recent: 'ఇటీవలి ఫలితాలు', upcoming: 'రాబోయే పరీక్షలు', grievance: 'ఫిర్యాదు నమోదు చేయండి', myGrievances: 'నా ఫిర్యాదులు', docs: 'పత్రాలు', offline: 'ఆఫ్‌లైన్ కోసం {n} వ్యాసాలు ఈ ఫోన్‌లో సేవ్ అయ్యాయి', none: 'ఇంకా ఏమీ లేదు.', other: 'ఇవి కూడా ఉపయోగపడతాయి' },
  hi: { mine: 'आपके लिए', recent: 'हाल के परिणाम', upcoming: 'आगामी परीक्षाएँ', grievance: 'शिकायत दर्ज करें', myGrievances: 'मेरी शिकायतें', docs: 'दस्तावेज़', offline: 'ऑफ़लाइन पढ़ने के लिए {n} लेख इस फ़ोन पर सहेजे गए', none: 'अभी कुछ नहीं।', other: 'ये भी उपयोगी हैं' },
};

/** The student/parent app's Knowledge tab (§3, §5, §23): their centre, live data for their own child, AI, grievances. */
export default async function AppKnowledgePage({ searchParams }: { searchParams: { grievance?: string } }) {
  const u = await requireAppUser();
  const lang = getLang();
  const t = kbT(lang);
  const s = T[lang];
  const v = await currentViewer('app');
  if (v.kind !== 'student' && v.kind !== 'parent') return <p className="text-sm text-muted">Knowledge opens for students and parents once the College ID is issued.</p>;
  const mainCentre = v.kind === 'student' ? 'student' : 'parent';
  const studentId = v.kind === 'student' ? v.studentId : v.studentIds[0];
  const [articles, files, live, settings, mine] = await Promise.all([listArticles(v, { status: 'all' }), listFiles(v), familyLive(studentId), getSettings(), kbGrievances.list(getRecordStore(), { k1: v.kind === 'parent' ? `parent:${u.phone}` : `student:${studentId}` })]);
  await audit(v, 'view', 'centre', mainCentre, mainCentre);
  const appArticles = articles.filter((a) => a.a.channels.includes('app') || a.a.channels.includes('website'));
  const main = appArticles.filter((a) => a.a.centre === mainCentre);
  const other = appArticles.filter((a) => a.a.centre !== mainCentre);
  const c = centreById(mainCentre)!;
  const assistants = assistantsFor(v);
  const topicTitle = (centre: string, key: string | null) => (key ? centreById(centre)?.topics.find((x) => x.key === key)?.t[lang] : null);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-heading">{c.icon} {c.name[lang]}</h1>
        <KbLangSwitch current={lang} label="" />
      </div>
      <section className="card p-4">
        <AskBox surface="app" assistants={assistants.map((a) => ({ id: a, name: ASSISTANT_INFO[a].name[lang] }))} initial={assistants[0]} suggestions={(settings.assistants[assistants[0]]?.suggestions?.length ? settings.assistants[assistants[0]].suggestions : ASSISTANT_INFO[assistants[0]].suggestions[lang]).slice(0, 3)} labels={{ placeholder: t.askPlaceholder, ask: t.askButton, sources: t.sources, page: t.page, basedOn: t.basedOn, helpful: t.helpful, notHelpful: t.notHelpful, suggested: t.suggested }} compact />
      </section>
      <section className="card p-4">
        <p className="mb-2 text-sm font-semibold text-heading">⚡ {s.mine}{live.batch ? ` · ${live.batch}` : ''}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">{s.upcoming}</p>
            {live.upcoming.length ? <ul>{live.upcoming.map((x, i) => <li key={i}>{x.title} · {formatDate(x.date, { day: 'numeric', month: 'short' })}</li>)}</ul> : <p className="text-muted">–</p>}
          </div>
          <div>
            <p className="text-xs text-muted">{s.recent}</p>
            {live.recent.length ? <ul>{live.recent.map((x, i) => <li key={i}>{x.title}: <b>{x.pct}%</b></li>)}</ul> : <p className="text-muted">–</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">{c.topics.filter((x) => x.app).map((x) => <Link key={x.key} href={x.app!} className="rounded-full border border-line px-2.5 py-1">{x.t[lang]}</Link>)}</div>
        <p className="mt-2 text-[11px] text-muted">{t.liveNote}</p>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-heading">{t.articles}</h2>
        {main.length === 0 ? <p className="text-sm text-muted">{s.none}</p> : (
          <ul className="space-y-2">
            {main.map(({ id, a }) => (
              <li key={id}><Link href={`/app/knowledge/a/${id}`} className="card block p-3"><span className="font-medium text-heading">{pick(a.title, lang)}</span> <SamplePill show={a.sample} label={t.sample} />{topicTitle(a.centre, a.topic) && <span className="block text-xs text-muted">{topicTitle(a.centre, a.topic)}</span>}</Link></li>
            ))}
          </ul>
        )}
      </section>
      {other.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-heading">{s.other}</h2>
          <ul className="space-y-2">{other.map(({ id, a }) => <li key={id}><Link href={`/app/knowledge/a/${id}`} className="card block p-3 text-sm"><span className="text-xs text-muted">{centreById(a.centre)?.icon} {centreById(a.centre)?.name[lang]} · </span>{pick(a.title, lang)}</Link></li>)}</ul>
        </section>
      )}
      {files.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-heading">{s.docs}</h2>
          <ul className="space-y-2">{files.map((f) => <li key={f.id}><a href={`/api/kb/files/${f.id}`} className="card block p-3 text-sm">📄 {pick(f.data.title, lang)}</a></li>)}</ul>
        </section>
      )}
      <section id="grievance" className="card p-4">
        <p className="mb-2 font-semibold text-heading">{s.grievance}</p>
        <QuickForm action={raiseGrievanceAction} submit={s.grievance} cols={1} fields={[{ name: 'category', label: 'Category', type: 'select', defaultValue: searchParams.grievance ? 'academics' : undefined, options: ['academics', 'hostel', 'transport', 'fees', 'staff', 'facilities', 'safety', 'other'].map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) })) }, { name: 'text', label: 'What happened?', type: 'textarea', required: true, rows: 3 }]} />
        {mine.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted">{s.myGrievances}</p>
            <ul className="mt-1 space-y-1 text-sm">{mine.map((g) => <li key={g.id}><b>{g.data.status.replace('_', ' ')}</b> · {g.data.text.slice(0, 80)}{g.data.reply ? <span className="block text-xs">↳ {g.data.reply}</span> : null}</li>)}</ul>
          </div>
        )}
      </section>
      <OfflineCache label={s.offline} articles={appArticles.filter((x) => x.a.sensitivity === 'public' || x.a.sensitivity === 'internal').map(({ id, a }) => ({ id, title: pick(a.title, lang), body: pick(a.body, lang) || a.body.en, centre: a.centre }))} />
    </div>
  );
}
