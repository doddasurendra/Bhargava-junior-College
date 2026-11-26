import 'server-only';
import type { Staff } from '../crm/types';
import { obSources } from './collections';
import https from 'node:https';
import { audit, canManage, need, staffActor, store } from './core';

/**
 * Official sources per category (§2). Seeded once from this list; admins edit them on the Sources screen.
 * Every URL is checked by checkSources() (manually or by the weekly cron) and the result is stored with the
 * date, so a moved or broken exam site shows up for admins instead of silently sending students nowhere.
 */
type Seed = [category: string, examId: string | null, name: string, url: string, type: 'syllabus' | 'textbook' | 'previous_papers' | 'answer_keys' | 'info_bulletin' | 'mock_test' | 'portal' | 'course', licence: 'link_only' | 'free_official' | 'open_licence' | 'public_domain', note?: string];

export const SOURCE_SEED: Seed[] = [
  ['intermediate', null, 'NCERT textbooks (Class 11 & 12, chapter-wise PDFs)', 'https://ncert.nic.in/textbook.php', 'textbook', 'free_official', 'Free official e-books. Linked, not re-hosted (NCERT terms).'],
  ['intermediate', null, 'ePathshala (NCERT e-books and resources)', 'https://epathshala.nic.in/', 'textbook', 'free_official'],
  ['intermediate', null, 'DIKSHA (national digital education platform)', 'https://diksha.gov.in/', 'portal', 'free_official'],
  ['intermediate', 'inter1-mpc', 'TGBIE (formerly TSBIE) – Telangana Board of Intermediate Education', 'https://tgbie.cgg.gov.in/', 'syllabus', 'link_only', 'Syllabus, model papers, circulars. Renamed from TSBIE. Telugu Akademi textbooks are bought, not re-hosted.'],
  ['intermediate', 'inter1-bipc', 'BIEAP – Board of Intermediate Education, Andhra Pradesh', 'https://bie.ap.gov.in/', 'syllabus', 'link_only'],
  ['engineering', 'jee-main', 'NTA JEE Main (information bulletin, syllabus, papers, keys)', 'https://jeemain.nta.nic.in/', 'info_bulletin', 'link_only'],
  ['engineering', 'jee-advanced', 'JEE Advanced (syllabus, past papers and answer keys)', 'https://jeeadv.ac.in/', 'previous_papers', 'link_only'],
  ['engineering', 'bitsat', 'BITSAT (BITS admissions: syllabus, pattern, sample test)', 'https://www.bitsadmission.com/', 'syllabus', 'link_only'],
  ['engineering', 'viteee', 'VITEEE (syllabus, pattern, mock test)', 'https://viteee.vit.ac.in/', 'mock_test', 'link_only'],
  ['engineering', 'eapcet-e', 'TG EAPCET (TGCHE)', 'https://eapcet.tgche.ac.in/', 'previous_papers', 'link_only', 'Moved from eapcet.tsche.ac.in to the TGCHE domain; verify each year.'],
  ['engineering', 'eapcet-e', 'AP EAPCET (APSCHE)', 'https://cets.apsche.ap.gov.in/', 'previous_papers', 'link_only'],
  ['engineering', 'comedk', 'COMEDK UGET', 'https://www.comedk.org/', 'syllabus', 'link_only'],
  ['medical', 'neet-ug', 'NTA NEET UG (bulletin, syllabus, papers, keys)', 'https://neet.nta.nic.in/', 'info_bulletin', 'link_only'],
  ['medical', 'neet-ug', 'National Medical Commission (official NEET UG syllabus)', 'https://www.nmc.org.in/', 'syllabus', 'link_only'],
  ['medical', 'aiims', 'AIIMS examinations (admission and counselling information)', 'https://www.aiimsexams.ac.in/', 'portal', 'link_only', 'AIIMS MBBS seats are filled through NEET UG since 2020.'],
  ['higher', 'iit-jam', 'IIT-JAM 2027 (IIT Kharagpur)', 'https://jam.iitkgp.ac.in/', 'previous_papers', 'link_only', 'The organising IIT changes every year.'],
  ['higher', 'gate', 'GATE 2027 (IIT Madras)', 'https://gate2027.iitm.ac.in/', 'previous_papers', 'link_only', 'The organising IIT changes every year.'],
  ['higher', 'gate', 'NPTEL (free courses)', 'https://nptel.ac.in/', 'course', 'free_official'],
  ['higher', 'cat', 'CAT (IIM)', 'https://iimcat.ac.in/', 'mock_test', 'link_only'],
  ['higher', 'mat', 'MAT (AIMA)', 'https://mat.aima.in/', 'syllabus', 'link_only'],
  ['higher', 'gmat', 'GMAT (mba.com, GMAC official practice)', 'https://www.mba.com/', 'mock_test', 'link_only', 'Official guides are copyrighted: links only.'],
  ['higher', 'gre', 'GRE (ETS official practice)', 'https://www.ets.org/gre.html', 'mock_test', 'link_only', 'Official guides are copyrighted: links only.'],
  ['higher', 'upsc', 'UPSC (syllabus, notifications, previous papers)', 'https://upsc.gov.in/', 'previous_papers', 'link_only'],
  ['higher', 'appsc', 'APPSC', 'https://psc.ap.gov.in/', 'previous_papers', 'link_only'],
  ['higher', 'tgpsc', 'TGPSC (formerly TSPSC, renamed 2024)', 'https://www.tgpsc.gov.in/', 'previous_papers', 'link_only', 'Renamed TGPSC in 2024 (old tspsc.gov.in no longer resolves).'],
  ['higher', 'ssc', 'Staff Selection Commission', 'https://ssc.gov.in/', 'previous_papers', 'link_only'],
  ['higher', 'banking', 'IBPS', 'https://www.ibps.in/', 'portal', 'link_only'],
  ['higher', 'banking', 'SBI Careers', 'https://sbi.co.in/web/careers', 'portal', 'link_only'],
  ['higher', 'banking', 'RBI opportunities', 'https://opportunities.rbi.org.in/', 'portal', 'link_only'],
  ['higher', 'rrb', 'RRB Chandigarh (Railway Recruitment Board)', 'https://www.rrbcdg.gov.in/', 'portal', 'link_only'],
  ['higher', 'rrb', 'Indian Railways', 'https://indianrailways.gov.in/', 'portal', 'link_only'],
  ['higher', null, 'National Digital Library of India', 'https://ndl.iitkgp.ac.in/', 'portal', 'open_licence'],
  ['higher', null, 'SWAYAM (free online courses)', 'https://swayam.gov.in/', 'course', 'free_official'],
];

export async function listSources() {
  const rows = await obSources.list(store());
  return rows.map((r) => ({ id: r.id, ...r.data })).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** Seeds the official list once (idempotent by URL). */
export async function seedSources(u: Staff | null) {
  if (u) need(canManage(u));
  const have = new Set((await obSources.list(store())).map((r) => r.data.url));
  let added = 0;
  for (const [category, examId, name, url, resourceType, licence, note] of SOURCE_SEED) {
    if (have.has(url)) continue;
    await obSources.put(store(), { category, examId, name, url, resourceType, licence, note: note ?? null });
    added++;
  }
  return added;
}

export async function saveSource(u: Staff, input: Record<string, unknown>, id?: string) {
  need(canManage(u));
  const prev = id ? await obSources.get(store(), id) : null;
  const r = await obSources.put(store(), { ...(prev?.data ?? {}), ...input, status: 'unchecked', httpStatus: null, finalUrl: null, lastChecked: null }, id);
  await audit(staffActor(u), id ? 'source.edit' : 'source.add', r.id, String(input.url ?? ''));
  return r;
}

export async function removeSource(u: Staff, id: string) {
  need(canManage(u));
  await obSources.remove(store(), id);
  await audit(staffActor(u), 'source.remove', id);
}

/** One URL: follows redirects; "moved" when it ends on another host, "broken" on errors or 4xx/5xx. */
export async function checkUrl(url: string): Promise<{ status: 'ok' | 'moved' | 'broken'; httpStatus: number | null; finalUrl: string | null; note: string | null }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BJC-OpenBook-LinkChecker/1.0)', Accept: 'text/html,*/*' } });
    const finalUrl = r.url || url;
    const host = (s: string) => new URL(s).hostname.replace(/^www\./, '');
    if (r.status >= 400) return { status: 'broken', httpStatus: r.status, finalUrl, note: `HTTP ${r.status}` };
    if (host(finalUrl) !== host(url)) return { status: 'moved', httpStatus: r.status, finalUrl, note: `Now redirects to ${host(finalUrl)}` };
    return { status: 'ok', httpStatus: r.status, finalUrl, note: null };
  } catch (e) {
    const code = String((e as { cause?: { code?: string } }).cause?.code ?? (e as Error).name);
    // Some official sites serve an incomplete certificate chain: browsers repair it, strict server checks don't.
    if (/CERT|SIGNATURE|ISSUER|SELF_SIGNED|ALTNAME/i.test(code)) {
      const st = await statusIgnoringCert(url);
      if (st && st < 400) return { status: 'ok', httpStatus: st, finalUrl: url, note: `Opens (HTTP ${st}); the site's certificate chain is incomplete (${code}), browsers still open it.` };
    }
    const msg = code === 'AbortError' ? 'No response within 20 seconds (the site may block cloud servers: open it in a browser to confirm)' : code === 'ENOTFOUND' ? 'Domain does not exist any more (ENOTFOUND): find the new official address' : `Could not connect (${code}); the site may block cloud servers: open it in a browser to confirm`;
    return { status: 'broken', httpStatus: null, finalUrl: null, note: msg };  } finally {
    clearTimeout(t);
  }
}

/** Checks every source (admin button and the weekly cron); returns the problems found. */
export async function checkSources(u: Staff | null) {
  if (u) need(canManage(u));
  const rows = await obSources.list(store());
  const problems: { name: string; url: string; status: string; note: string | null }[] = [];
  for (let i = 0; i < rows.length; i += 6) {
    await Promise.all(rows.slice(i, i + 6).map(async (r) => {
      const c = await checkUrl(r.data.url);
      await obSources.put(store(), { ...r.data, status: c.status, httpStatus: c.httpStatus, finalUrl: c.finalUrl, lastChecked: new Date().toISOString(), note: c.note ?? r.data.note }, r.id);
      if (c.status !== 'ok') problems.push({ name: r.data.name, url: r.data.url, status: c.status, note: c.note });
    }));
  }
  return { checked: rows.length, problems };
}

/** Status code only (no content is trusted or used), for sites with a broken certificate chain. */
function statusIgnoringCert(url: string): Promise<number | null> {
  return new Promise((res) => {
    const r = https.get(url, { rejectUnauthorized: false, timeout: 20_000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BJC-OpenBook-LinkChecker/1.0)' } }, (x) => { res(x.statusCode ?? null); x.resume(); });
    r.on('error', () => res(null));
    r.on('timeout', () => { r.destroy(); res(null); });
  });
}