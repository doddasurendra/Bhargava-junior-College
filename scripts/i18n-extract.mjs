// Extracts user-visible English strings from the staff CRM source (JSX text, labels, placeholders, messages)
// so they can be translated (lib/crm-i18n) and checked for coverage.
//   node scripts/i18n-extract.mjs                 → .data/crm-strings.json (all strings)
//   npx vite-node scripts/i18n-coverage.ts        → coverage per language, untranslated list in .data/crm-missing.json
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['app/crm', 'components/crm', 'components/openbook/GoogleSearch.tsx', 'components/openbook/BigFileInput.tsx', 'components/openbook/client.tsx', 'lib/crm/types.ts', 'lib/kb/nav.ts', 'content/admissionSystem.ts'];
const SKIP = /\.test\.ts$|i18n|route\.ts$/;
const files = [];
const walk = (p) => { if (!statSync(p, { throwIfNoEntry: false })) return; if (statSync(p).isDirectory()) for (const f of readdirSync(p)) walk(path.join(p, f)); else if (/\.(tsx?)$/.test(p) && !SKIP.test(p)) files.push(p); };
ROOTS.forEach(walk);

const out = new Set();
const CODEY = /[{}<>;=\\]|=>|&&|\|\||\bcan\(|\buser\b\.|\breturn\b|\bawait\b|\bnew [A-Z]|\(\s*\)|\bnull\b|\bundefined\b|\.map\(|\?\.|^\W*[a-z]+\(|\btypeof\b|^[a-z]+[A-Z]\w*$/;
const TAILWIND = /^(-?[a-z]+:)*(text|bg|border|flex|grid|rounded|p[xytrbl]?|m[xytrbl]?|w|h|font|space|gap|items|justify|block|inline|hidden|card|btn|input|chip|absolute|relative|overflow|max|min|shadow|ring|divide|sticky|z|opacity|cursor|select|leading|tracking|uppercase|lowercase|truncate|whitespace|list|col|row|order|self|shrink|grow|underline|italic|sr|tabular|break|aspect|object|fixed|inset|top|left|right|bottom|transition|duration|animate|table|align|decoration|outline|fill|stroke|sm|lg|md|xl|dark|print|hover|focus|disabled|group|peer|placeholder|accent|content|float|clear|isolate|visible|invisible|contents|basis|place|resize|scroll|snap|touch|pointer|will|line)(-[\w./[\]%#]+)?( |$)/;
const keep = (raw) => {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 260) return;
  if (!/[A-Za-z]{2}/.test(s)) return;
  if (/^[a-z0-9_.:/\-#]+$/.test(s)) return; // identifiers, paths, keys, slugs
  if (/^(https?:|\/|#|@|\.|use |import |export |application\/|image\/|text\/)/.test(s)) return;
  if (/^[A-Z0-9_]+$/.test(s)) return; // CONSTANTS
  if (/^[),:;.\-*]/.test(s) || /Promise$|^-?my-|^[a-z]+ [a-z]+-[a-z]/.test(s)) return; // code fragments, class lists
  if (CODEY.test(s.replace(/\{x\}/g, ''))) return;
  if (TAILWIND.test(s)) return;
  if (/^[a-z]+(_[a-z]+)+$/.test(s) || /^[a-z]+(\.[a-zA-Z]+)+$/.test(s)) return; // snake_case, permission keys
  out.add(s);
};
for (const f of files) {
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  for (const m of src.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) keep(m[1]); // JSX text
  for (const m of src.matchAll(/(?<![\w$])'((?:[^'\\\n]|\\.)*)'|(?<![\w$])"((?:[^"\\\n]|\\.)*)"/g)) {
    const s = (m[1] ?? m[2] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (/^[A-Z]/.test(s) || /[a-z] [a-z]/.test(s)) keep(s);
  }
  for (const m of src.matchAll(/`([^`]*)`/g)) { // template literals: interpolations become {x}
    const t = m[1].replace(/\$\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '{x}');
    if (/[A-Za-z]{3}/.test(t.replace(/\{x\}/g, '')) && !/^[\s{x}/?=&.#-]*\{x\}[\s{x}/?=&.#-]*$/.test(t)) keep(t);
  }
}
const list = [...out].sort();
mkdirSync('.data', { recursive: true });
writeFileSync('.data/crm-strings.json', JSON.stringify(list, null, 0));
console.log(`${files.length} files, ${list.length} strings, ${list.reduce((n, s) => n + s.length, 0)} chars → .data/crm-strings.json (coverage: npx vite-node scripts/i18n-coverage.ts)`);
