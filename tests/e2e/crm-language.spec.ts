import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { CRASH, staffFor, staffLogin } from './helpers';

/**
 * Staff CRM in Telugu and Hindi on a real deployment: switch language, open every menu page each role has,
 * and check that no dictionary phrase is still shown in English. Also the library document workflow
 * (upload with language / academic year / type → filter → preview → download → edit → remove).
 * Read-only except the library step, which uploads one "QA …" document and removes it again.
 */
test.skip(!existsSync(path.join(process.cwd(), '.data', 'qa-accounts.json')), 'QA accounts file missing');
test.setTimeout(10 * 60_000);
const RUN = Date.now().toString(36).slice(-5);
const report: string[] = [];
const unknownSeen = new Map<string, number>();

async function setLang(page: Page, lang: 'en' | 'te' | 'hi') {
  const url = new URL(page.url() === 'about:blank' ? (test.info().project.use.baseURL as string) : page.url());
  await page.context().addCookies([{ name: 'bjc_lang', value: lang, domain: url.hostname, path: '/' }]);
}

/** English phrases from the dictionary that are still visible (translation missed), and English-looking text not in it. */
async function audit(page: Page, keys: Set<string>) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-tr'), null, { timeout: 15_000 });
  await page.waitForTimeout(400);
  const texts = await page.evaluate(() => {
    const out: string[] = [];
    const tw = document.createTreeWalker(document.querySelector('.crm-root') ?? document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const el = n.parentElement!;
      if (el.closest('script,style,code,pre,textarea,[data-no-translate]')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const v = (n.nodeValue ?? '').replace(/\s+/g, ' ').trim();
      if (v) out.push(v);
    }
    document.querySelectorAll('[placeholder],[aria-label]').forEach((e) => { for (const a of ['placeholder', 'aria-label']) { const v = e.getAttribute(a); if (v) out.push(v.trim()); } });
    return out;
  });
  const missed = texts.filter((t) => keys.has(t));
  // English-looking UI text with no dictionary entry (collected for translation; names/emails/IDs filtered roughly)
  const unknown = texts.filter((t) => !keys.has(t) && !/[ఀ-౿ऀ-ॿ]/.test(t) && /[a-z]{3,}/.test(t) && !/@|https?:|^[\w.-]+\.(pdf|docx|csv)$|^[A-Z][a-z]+( [A-Z][a-z.]*){0,3}$/.test(t));
  const indic = texts.filter((t) => /[ఀ-౿ऀ-ॿ]/.test(t)).length;
  return { total: texts.length, indic, missed: [...new Set(missed)], unknown };
}

async function navHrefs(page: Page) {
  return page.locator('nav[aria-label=CRM] a').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!).filter((h) => h.startsWith('/crm')))]);
}

for (const [role, lang] of [['super_admin', 'te'], ['super_admin', 'hi'], ['principal', 'te'], ['accounts', 'hi'], ['telecaller', 'te'], ['faculty', 'hi'], ['hostel_warden', 'te']] as const) {
  test(`${role} · ${lang}: every menu page is translated`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await staffLogin(page, staffFor(role));
    // switch with the language menu (as staff do) and confirm it stays on navigation
    await Promise.all([page.waitForEvent('load'), page.locator('select[name=crm-lang]').selectOption(lang)]);
    await page.waitForLoadState('networkidle');
    const j = await (await page.request.get(`${baseURL}/api/crm-i18n/${lang}`)).json();
    const keys = new Set(Object.keys(j.exact as Record<string, string>));
    const hrefs = await navHrefs(page);
    const problems: string[] = [];
    let pages = 0, nodes = 0, indic = 0;
    for (const h of hrefs) {
      const res = await page.goto(h);
      if (!res || res.status() >= 500) { problems.push(`${h}: HTTP ${res?.status()}`); continue; }
      await expect(page.locator('body')).not.toContainText(CRASH);
      const a = await audit(page, keys);
      pages++; nodes += a.total; indic += a.indic;
      for (const u of a.unknown) unknownSeen.set(u, (unknownSeen.get(u) ?? 0) + 1);
      if (a.missed.length) problems.push(`${h}: still English → ${a.missed.slice(0, 6).join(' | ')}`);
      // the selection is preserved while navigating
      await expect(page.locator('select[name=crm-lang]')).toHaveValue(lang);
    }
    report.push(`${role} (${lang}): ${pages} pages, ${indic}/${nodes} visible text items in ${lang === 'te' ? 'Telugu' : 'Hindi'} (rest: names, numbers, IDs, data), dictionary phrases left in English: ${problems.length ? problems.length + ' page(s)' : 'none'}`);
    problems.forEach((p) => report.push('   ' + p));
    await ctx.close();
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test('English is back after switching to English', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await staffLogin(page, staffFor('principal'));
  await Promise.all([page.waitForEvent('load'), page.locator('select[name=crm-lang]').selectOption('te')]);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('nav[aria-label=CRM]')).toContainText('నోటీసులు');
  await Promise.all([page.waitForEvent('load'), page.locator('select[name=crm-lang]').selectOption('en')]);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('nav[aria-label=CRM]')).toContainText('Notices');
  report.push('switch back to English: PASS');
  await ctx.close();
});

test('library documents: upload (language, academic year, type) → filter → preview → download → edit → remove', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await staffLogin(page, staffFor('academic_coordinator'));
  await setLang(page, 'en');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText(`QA ${RUN} Chemistry revision notes: mole concept and stoichiometry`, { x: 40, y: 800, size: 12, font });
  const title = `QA ${RUN} Chemistry notes`;
  await page.goto('/crm/openbook?tab=books');
  const f = page.locator('form').filter({ has: page.locator('select[name=docType]') }).first();
  await f.locator('input[type=file]').first().setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
  await f.locator('input[name=title]').fill(title);
  await f.locator('select[name=language]').selectOption('te');
  await f.locator('input[name=academicYear]').fill('2026-27');
  await f.locator('select[name=docType]').selectOption('notes');
  await f.locator('input[name=subjects]').fill('Chemistry');
  await f.getByRole('button', { name: /Upload and extract text/ }).click();
  await expect(f.locator('[role=status],[role=alert]').last()).toBeVisible({ timeout: 120_000 });
  // filter by language + academic year + type
  await page.goto('/crm/openbook?tab=books&language=te&academicYear=2026-27&docType=notes');
  const row = page.locator('li').filter({ hasText: title }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('Telugu');
  await expect(row).toContainText('2026-27');
  // preview (inline) and download (attachment) through the signed-in file route
  const href = await row.getByRole('link', { name: 'Preview' }).getAttribute('href');
  const pv = await page.request.get(href!);
  expect(pv.status()).toBe(200);
  expect(pv.headers()['content-type']).toContain('pdf');
  const dl = await page.request.get(href! + '&download=1');
  expect(dl.status()).toBe(200);
  expect(dl.headers()['content-disposition']).toMatch(/^attachment/);
  // signed out: no access
  const anon = await (await browser.newContext()).request.get(new URL(href!, page.url()).toString());
  expect(anon.status()).toBe(401);
  // edit details
  await row.getByRole('link', { name: 'Edit' }).click();
  const ef = page.locator('form').filter({ has: page.locator('input[name=id]') }).filter({ has: page.locator('select[name=docType]') }).first();
  await ef.locator('select[name=language]').selectOption('hi');
  await ef.getByRole('button', { name: 'Save details' }).click();
  await expect(ef.locator('[role=status],[role=alert]').last()).toContainText('Saved', { timeout: 30_000 });
  await page.goto('/crm/openbook?tab=books&language=hi&docType=notes');
  const row2 = page.locator('li').filter({ hasText: title }).first();
  await expect(row2).toContainText('Hindi');
  // remove (status only; the stored file stays for the audit trail)
  await row2.getByRole('button', { name: 'Remove' }).click();
  await page.waitForTimeout(2000);
  await page.goto('/crm/openbook?tab=books&status=rejected&docType=notes');
  await expect(page.locator('li').filter({ hasText: title }).first()).toContainText('rejected');
  report.push('library upload → filter → preview → download → anonymous 401 → edit → remove: PASS');
  await ctx.close();
});

test.afterAll(() => {
  writeFileSync(`.data/crm-unknown-${process.pid}.json`, JSON.stringify([...unknownSeen].sort((a, b) => b[1] - a[1]), null, 0));
  console.log('\nCRM LANGUAGE & LIBRARY RESULTS\n' + report.join('\n'));
});
