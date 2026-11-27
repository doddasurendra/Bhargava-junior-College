import { D1 } from './dict/d1';
import { D2 } from './dict/d2';
import { D3 } from './dict/d3';
import { D4 } from './dict/d4';
import { D5 } from './dict/d5';
import { D6 } from './dict/d6';
import { compile, type CompiledDict, type CrmLang, type Row } from './translate';

export { translate, compile, serialise, deserialise, norm } from './translate';
export type { CompiledDict, CrmLang, Row } from './translate';

/** All staff CRM rows: [English, Telugu, Hindi]. TODO(college): a native speaker should review them. */
export const ROWS: readonly Row[] = [...D1, ...D2, ...D3, ...D4, ...D5, ...D6];

const cache = new Map<CrmLang, CompiledDict>();
export function dictFor(lang: CrmLang): CompiledDict {
  let d = cache.get(lang);
  if (!d) { d = compile(ROWS, lang); cache.set(lang, d); }
  return d;
}
