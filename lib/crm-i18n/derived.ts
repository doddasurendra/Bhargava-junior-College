import { CENTRES, PUBLIC_GROUPS } from '@/lib/kb/centres';
import type { Row } from './translate';

/**
 * Rows taken from content that already carries Telugu and Hindi (Knowledge Hub centres, their topics and groups),
 * so the CRM shows the same wording the Knowledge Hub uses instead of a second translation.
 */
export function derivedRows(): Row[] {
  const out: Row[] = [];
  const add = (en: string, te?: string | null, hi?: string | null) => { if (en && te && hi) out.push([en, te, hi]); };
  for (const c of CENTRES) {
    add(c.name.en, c.name.te, c.name.hi);
    // CRM sidebar label: "🎒 Student" (icon + name without "Knowledge Centre")
    const short = (s: string) => s.replace(/ (Knowledge )?Centre$/, '');
    add(`${c.icon} ${short(c.name.en)}`, `${c.icon} ${c.name.te}`, `${c.icon} ${c.name.hi}`);
    for (const t of c.topics) add(t.t.en, t.t.te, t.t.hi);
  }
  for (const g of PUBLIC_GROUPS) add(g.name.en, g.name.te, g.name.hi);
  return out;
}
