// Staff CRM translation coverage. Run `node scripts/i18n-extract.mjs` first, then:
//   npx vite-node scripts/i18n-coverage.ts
// Prints coverage for Telugu and Hindi and writes the untranslated UI strings to .data/crm-missing.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { dictFor, translate } from '../lib/crm-i18n';

const all: string[] = JSON.parse(readFileSync('.data/crm-strings.json', 'utf8'));
// Not UI text: CSS class lists, log tags, storage keys, code fragments, sample names/places kept as written.
const NOT_UI = /^\[[\w/-]+\]|^(max|min|space|rounded|overflow|whitespace|border|bg|pad|b\.v|s\.bookId|noopener)\b|\{x\}__|^[a-z-]+:\{x\}|^(tel|search|staff-register|article|file|batch|custom_|rejected-|openbook\/)|^[A-Z][a-z]+ [A-Z]\.?$|^[A-Z]\. [A-Z]|^\{x\} (capitalize|cursor|mt-)|Error$|^Content-Type$|^Authorization|^Asia\/|^BJC-\d|^JEE-1A$|^(Claude|Razorpay|Supabase|Excel|Internet|App|Push|Lv|He|She|Her|His|Their|They|s are|code is)$|^supabase functions|Junior College$|High School$|ZPHS|dev-db|SUPABASE_SERVICE|Local mode|Local JSON|\.data\/|Sample staff from the brief|Turned off here|Supabase (Postgres|bucket|integration)|Knowledge Hub collections|Query log|RLS (off|on)|\(input: unknown/;
const names = /^(Anitha M|Kavitha N|K\. Ravi Teja|K\. Srinivas|Lakshmi Prasad|Mahesh Goud|Naveen Kumar|Padma Devi|Prakash V|Ravi Teja|Srinivas K|Sunitha Reddy|Swapna R|Venkatesh Rao|Dilsukhnagar)$/;
const ui = all.filter((s) => !NOT_UI.test(s) && !names.test(s));
const res: Record<string, string[]> = {};
for (const lang of ['te', 'hi'] as const) {
  const d = dictFor(lang);
  const miss = ui.filter((s) => translate(d, s.replace(/\{x\}/g, '7')) === null);
  res[lang] = miss;
  console.log(`${lang}: ${ui.length - miss.length}/${ui.length} CRM UI strings translated (${(((ui.length - miss.length) / ui.length) * 100).toFixed(1)}%); ${all.length - ui.length} non-UI strings (class names, log tags, sample names) excluded`);
}
writeFileSync('.data/crm-missing.json', JSON.stringify(res, null, 1));
