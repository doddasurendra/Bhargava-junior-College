import 'server-only';
import { parseCsv } from '../crm/csv';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { LEVELS, SENSITIVITY, type Level, type Sensitivity } from './access';
import { centreById } from './centres';
import { CHANNELS } from './collections';
import { unzip } from './extract';
import { listFiles, uploadFile } from './files';
import { readKbFile } from './storage';
import { audit, KbError, listArticles, saveArticle, staffViewer } from './service';
import { zip } from './zip';

/**
 * Import & Export (§1.6). Export: a category/centre or the whole KB the user may see, as a ZIP (one Markdown
 * file per article with front matter + the document files) or JSON. Import: PDF/Word/Excel/PPT/images (via
 * the document upload), CSV of articles, a ZIP of any of those (Markdown becomes articles), our own JSON
 * export, or a page of the college's own website.
 */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';

export async function exportKb(user: Staff, opts: { centre?: string; format: 'zip' | 'json' }) {
  if (!can(user, 'kb.approve') && !can(user, 'kb.analytics')) throw new KbError('Only approvers and leaders can export the knowledge base.');
  const v = await staffViewer(user);
  const articles = await listArticles(v, { centre: opts.centre, status: 'all' });
  const files = await listFiles(v, { centre: opts.centre, status: 'all' });
  await audit(user, 'export', 'export', opts.centre ?? 'all', `Export ${opts.format}`, `${articles.length} articles, ${files.length} files`);
  if (opts.format === 'json') {
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), by: user.id, centre: opts.centre ?? null, articles: articles.map((a) => ({ id: a.id, ...a.a })), files: files.map((f) => ({ id: f.id, ...f.data })) }, null, 2);
    return { bytes: new TextEncoder().encode(json), mime: 'application/json', name: `bjc-knowledge-${opts.centre ?? 'all'}.json` };
  }
  const enc = new TextEncoder();
  const entries: { name: string; data: Uint8Array }[] = [];
  for (const { id, a } of articles) {
    const fm = ['---', `id: ${id}`, `title: ${JSON.stringify(a.title.en)}`, a.title.te ? `title_te: ${JSON.stringify(a.title.te)}` : '', a.title.hi ? `title_hi: ${JSON.stringify(a.title.hi)}` : '', `centre: ${a.centre}`, a.topic ? `topic: ${a.topic}` : '', `access: ${a.access}`, `sensitivity: ${a.sensitivity}`, `status: ${a.status}`, `version: ${a.version}`, `channels: [${a.channels.join(', ')}]`, a.reviewBy ? `review_by: ${a.reviewBy}` : '', '---'].filter(Boolean).join('\n');
    const body = [a.body.en, a.body.te ? `\n\n<!-- te -->\n${a.body.te}` : '', a.body.hi ? `\n\n<!-- hi -->\n${a.body.hi}` : ''].join('');
    entries.push({ name: `${a.centre}/articles/${slug(a.title.en)}-${id.slice(0, 8)}.md`, data: enc.encode(`${fm}\n\n${body}\n`) });
  }
  for (const f of files) {
    const bytes = await readKbFile(f.data.storageKey);
    if (bytes) entries.push({ name: `${f.data.centre}/files/${f.id.slice(0, 8)}-${f.data.name}`, data: bytes });
  }
  entries.push({ name: 'README.txt', data: enc.encode(`Bhargava Junior College knowledge base export\n${new Date().toISOString()}\n${articles.length} articles, ${files.length} files.\nContains only items the exporting user (${user.fullName}) may see.\n`) });
  return { bytes: zip(entries), mime: 'application/zip', name: `bjc-knowledge-${opts.centre ?? 'all'}.zip` };
}

interface Defaults {
  centre: string;
  access: Level;
  sensitivity: Sensitivity;
}

function frontMatter(md: string) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Record<string, string> = {};
  if (m) for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return { meta, body: m ? md.slice(m[0].length) : md };
}

const lvl = (s: string | undefined, d: Level): Level => (LEVELS.includes(s as Level) ? (s as Level) : d);
const sens = (s: string | undefined, d: Sensitivity): Sensitivity => (SENSITIVITY.includes(s as Sensitivity) ? (s as Sensitivity) : d);

async function importArticle(user: Staff, d: Defaults, title: string, body: string, meta: Record<string, string> = {}) {
  const [en, te, hi] = body.split(/\n*<!-- (?:te|hi) -->\n/);
  const centre = centreById(meta.centre ?? '') ? meta.centre : d.centre;
  const access = lvl(meta.access, d.access);
  return saveArticle(user, { titleEn: (meta.title || title).slice(0, 200), titleTe: meta.title_te, titleHi: meta.title_hi, bodyEn: (en ?? '').trim().slice(0, 20000) || title, bodyTe: te?.trim() || null, bodyHi: hi?.trim() || null, centre, topic: meta.topic || null, access, sensitivity: access === 'public' ? 'public' : sens(meta.sensitivity, d.sensitivity), channels: (meta.channels?.replace(/[[\]]/g, '').split(/,\s*/).filter((c) => (CHANNELS as readonly string[]).includes(c)) as (typeof CHANNELS)[number][]) ?? ['staff'] }, undefined, 'imported');
}

export async function importFile(user: Staff, name: string, bytes: Uint8Array, d: Defaults) {
  const lower = name.toLowerCase();
  const result = { articles: 0, files: 0, errors: [] as string[] };
  const one = async (n: string, b: Uint8Array) => {
    const l = n.toLowerCase();
    try {
      if (l.endsWith('.md')) {
        const { meta, body } = frontMatter(new TextDecoder().decode(b));
        await importArticle(user, d, n.split('/').pop()!.replace(/\.md$/i, '').replace(/-[0-9a-f]{8}$/, '').replace(/-/g, ' '), body, meta);
        result.articles++;
      } else if (l.endsWith('.csv') && /(^|\/)articles?[^/]*\.csv$/.test(l)) {
        const { headers, rows } = parseCsv(new TextDecoder().decode(b).replace(/^﻿/, ''));
        const ix = (h: string) => headers.findIndex((x) => x.trim().toLowerCase() === h);
        for (const r of rows) {
          const title = r[ix('title')]?.trim();
          if (!title) continue;
          await importArticle(user, d, title, r[ix('body')] ?? '', { centre: r[ix('centre')] ?? '', access: r[ix('access')] ?? '', sensitivity: r[ix('sensitivity')] ?? '', topic: r[ix('topic')] ?? '', title_te: r[ix('title_te')] ?? '', title_hi: r[ix('title_hi')] ?? '' });
          result.articles++;
        }
      } else if (l.endsWith('.json')) {
        const j = JSON.parse(new TextDecoder().decode(b)) as { articles?: { title: { en: string; te?: string; hi?: string }; body: { en: string; te?: string; hi?: string }; centre: string; access: string; sensitivity: string; topic?: string }[] };
        for (const a of j.articles ?? []) {
          await importArticle(user, d, a.title.en, [a.body.en, a.body.te ? `<!-- te -->\n${a.body.te}` : '', a.body.hi ? `<!-- hi -->\n${a.body.hi}` : ''].filter(Boolean).join('\n\n'), { centre: a.centre, access: a.access, sensitivity: a.sensitivity, topic: a.topic ?? '', title_te: a.title.te ?? '', title_hi: a.title.hi ?? '' });
          result.articles++;
        }
      } else if (!/(^|\/)(readme\.txt|__macosx\/)/i.test(l) && !l.endsWith('/')) {
        await uploadFile(user, n.split('/').pop()!, b, { centre: d.centre, access: d.access, sensitivity: d.sensitivity });
        result.files++;
      }
    } catch (e) {
      result.errors.push(`${n}: ${(e as Error).message}`.slice(0, 300));
    }
  };
  if (lower.endsWith('.zip')) {
    let entries: Map<string, Uint8Array>;
    try {
      entries = unzip(bytes);
    } catch (e) {
      throw new KbError(`Not a readable ZIP: ${(e as Error).message}`);
    }
    if (entries.size > 300) throw new KbError('A ZIP can hold at most 300 files.');
    for (const [n, b] of entries) await one(n, b);
  } else await one(name, bytes);
  await audit(user, 'import', 'import', null, name, `${result.articles} articles, ${result.files} files, ${result.errors.length} errors`);
  return result;
}

/** Import a page of the college's OWN website as an article (other hosts are refused: no fetching the internet). */
export async function importWebPage(user: Staff, url: string, d: Defaults) {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://bhargava-junior-college.vercel.app');
  let u: URL;
  try {
    u = new URL(url, site);
  } catch {
    throw new KbError('Not a valid link.');
  }
  if (u.host !== site.host) throw new KbError(`Only pages of ${site.host} can be imported.`);
  const r = await fetch(u.toString(), { signal: AbortSignal.timeout(15_000), redirect: 'error' });
  if (!r.ok) throw new KbError(`The page answered HTTP ${r.status}.`);
  const html = (await r.text()).slice(0, 2_000_000);
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.split('|')[0].trim() || u.pathname;
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const text = main
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-4])[^>]*>/gi, (_, n) => `\n${'#'.repeat(Number(n))} `)
    .replace(/<\/(p|li|h\d|div|section|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
  const rec = await importArticle(user, d, title, `${text.slice(0, 19000)}\n\nSource: ${u.toString()}`, { centre: d.centre, access: 'public', sensitivity: 'public' });
  await audit(user, 'import', 'import', rec.id, title, u.toString());
  return rec;
}
