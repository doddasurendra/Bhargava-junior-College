import { college, fullAddress } from '@/content/college';
import { buildKnowledge } from '../assistant/knowledge';
import type { Content } from '../cms/blocks';
import { search, terms, type Doc } from '../staffAssistant/retrieve';

/**
 * Shared BJC knowledge base for BOTH website assistants (chat agent and voice agent).
 *
 * Source of truth: the same verified website content the site renders (CMS blocks + confirmed college facts),
 * so the assistants can never say something the website doesn't. Pipeline:
 *   website content → text → chunks (one per section / FAQ / article) → metadata (title, URL, section, sample flag)
 *   → keyword index (BM25) with multilingual query expansion and typo tolerance → top-K retrieval with a score
 *   threshold → grounded answer with sources, or an honest "not found".
 * Re-indexes automatically whenever CMS content changes (new content object) — no manual step needed; the
 * version hash changes with the text. Semantic (embedding) search can be added on top when an embeddings
 * provider is configured; until then retrieval is lexical (documented in the README).
 */

export type Lang = 'en' | 'te' | 'hi';

export interface Chunk {
  id: string;
  title: string;
  section: string;
  url: string;
  text: string;
  sample: boolean;
}

const SECTION_URLS: [RegExp, string][] = [
  [/^Programs/i, '/programs'],
  [/^Fees/i, '/fees'],
  [/^BSAT/i, '/scholarship'],
  [/^Hostel/i, '/hostel'],
  [/^Campus visits/i, '/visit'],
  [/^Admission/i, '/admissions'],
  [/^Results/i, '/results'],
  [/^Faculty/i, '/faculty'],
  [/^FAQs/i, '/#faq'],
  [/^Knowledge base/i, '/about'],
  [/^About/i, '/about'],
  [/^Contact/i, '/contact'],
];

const SAMPLE_RE = /\s*\[SAMPLE DATA[^\]]*\]/g;
const urlFor = (section: string) => SECTION_URLS.find(([re]) => re.test(section))?.[1] ?? '/';

/** djb2 — a short, stable version id for the indexed text (document versioning). */
export function versionOf(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function buildCorpus(c: Content): Chunk[] {
  const about = [
    `## About ${college.name}`,
    `${college.name} is run by ${college.society}. Motto: ${college.motto}.`,
    `Vision: ${college.vision}.`,
    `Mission: ${college.mission}`,
    college.apart,
    `Leadership: ${college.leader.name}, ${college.leaderCredentialsFull}.`,
    '## Contact and location',
    `The college is located at ${fullAddress}, ${college.address.region}. Location and directions: ${college.address.locality}, ${college.address.city}.`,
    `Address: ${fullAddress}. Phones: ${college.phones.map((p) => p.display).join(', ')}. Email: ${college.email}.`,
    `Office hours: ${college.hours.map((h) => `${h.days} ${h.time}`).join('; ')}.`,
  ].join('\n');
  const text = `${about}\n${buildKnowledge(c)}`;

  const chunks: Chunk[] = [];
  let section = 'General';
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    if (body) push(section, section, body);
    buf = [];
  };
  const push = (sec: string, title: string, body: string) => {
    const sample = SAMPLE_RE.test(sec) || SAMPLE_RE.test(body);
    SAMPLE_RE.lastIndex = 0;
    const cleanSec = sec.replace(SAMPLE_RE, '').trim();
    chunks.push({ id: `${chunks.length}-${versionOf(cleanSec + body)}`, title: title.replace(SAMPLE_RE, '').trim(), section: cleanSec, url: urlFor(cleanSec), text: body.replace(SAMPLE_RE, '').trim(), sample });
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^#\s/.test(line)) continue; // document title
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      flush();
      section = h2[1];
      continue;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      flush();
      buf = [];
      section = section.startsWith('Knowledge base') ? section : section;
      // each knowledge-base article is its own chunk
      buf.push(`__TITLE__${h3[1]}`);
      continue;
    }
    // each FAQ is its own chunk
    if (/^Q: /.test(line) && /^FAQs/i.test(section)) {
      flush();
      const q = line.replace(/^Q:\s*/, '').split(' A: ')[0];
      push(section, q, line.replace(/^Q:\s*/, '').replace(' A: ', '\n'));
      continue;
    }
    buf.push(line);
  }
  flush();
  // titled article chunks
  return chunks
    .map((ch) => (ch.text.startsWith('__TITLE__') ? { ...ch, title: ch.text.split('\n')[0].slice(9), text: ch.text.split('\n').slice(1).join('\n').trim() } : ch))
    .filter((ch) => ch.text && ch.section !== 'Useful pages');
}

// ---------------------------------------------------------------- query understanding

export function detectLang(s: string): Lang {
  if (/[\u0C00-\u0C7F]/.test(s)) return 'te';
  if (/[\u0900-\u097F]/.test(s)) return 'hi';
  return 'en';
}

/** Telugu / Hindi words → English search terms, so questions in any of the three languages find the same facts. */
const EXPAND: [RegExp, string][] = [
  [/ఫీజు|రుసుము|ఖర్చు|फीस|शुल्क|खर्च/, 'fees fee tuition'],
  [/కోర్సు|కోర్సులు|ప్రోగ్రామ్|कोर्स|पाठ्यक्रम|प्रोग्राम/, 'programs program course jee neet'],
  [/హాస్టల్|వసతి|हॉस्टल|छात्रावास|होस्टल/, 'hostel rooms mess'],
  [/స్కాలర్|ఉపకార|బిఎస్ఏటీ|छात्रवृत्ति|स्कॉलरशिप|बीसैट/, 'scholarship bsat'],
  [/ప్రవేశ|అడ్మిషన్|प्रवेश|एडमिशन|दाखिला/, 'admission process documents'],
  [/చిరునామా|ఎక్కడ|లొకేషన్|पता|कहाँ|कहां|लोकेशन/, 'address location'],
  [/ఫోన్|నంబర్|సంప్రదించ|फोन|नंबर|संपर्क/, 'phones contact email'],
  [/సమయం|సమయాలు|టైమింగ్|समय|टाइमिंग/, 'office hours'],
  [/పత్రాలు|డాక్యుమెంట్|दस्तावेज|डॉक्यूमेंट/, 'documents admission'],
  [/సందర్శన|విజిట్|చూడ|विजिट|देखने|मिलने/, 'campus visit slot'],
  [/ఫలితాలు|రిజల్ట్|परिणाम|रिजल्ट/, 'results toppers'],
  [/అధ్యాపక|టీచర్|ఫ్యాకల్టీ|शिक्षक|फैकल्टी|अध्यापक/, 'faculty teachers'],
  [/బస్సు|రవాణా|बस|परिवहन/, 'transport bus'],
  [/విజన్|లక్ష్య|मिशन|विजन|लक्ष्य/, 'vision mission'],
  [/ప్రిన్సిపాల్|యాజమాన్య|प्रिंसिपल|प्रबंधन/, 'leadership'],
];
const EN_SYNONYMS: [RegExp, string][] = [
  [/\b(cost|price|charges?|amount|how much)\b/i, 'fees tuition'],
  [/\b(courses?|stream|mpc|bipc|iit|medical|engineering)\b/i, 'programs jee neet'],
  [/\b(where|located|location|reach|map)\b/i, 'address'],
  [/\b(call|phone|number|mobile|email|contact)\b/i, 'phones email'],
  [/\b(timings?|open|closed|working hours)\b/i, 'office hours'],
  [/\b(dorm|accommodation|stay|food|mess)\b/i, 'hostel'],
  [/\b(teachers?|lecturers?|staff)\b/i, 'faculty'],
  [/\b(bus|transport|van)\b/i, 'transport'],
  [/\b(principal|chairman|director|founder|management)\b/i, 'leadership'],
];

function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Rewrites a question into search terms: language expansion, synonyms, and typo correction against the index vocabulary. */
export function rewriteQuery(q: string, vocab: Set<string>) {
  let extra = '';
  for (const [re, add] of [...EXPAND, ...EN_SYNONYMS]) if (re.test(q)) extra += ` ${add}`;
  const fixed = terms(q).map((t) => {
    if (vocab.has(t) || t.length < 5) return t;
    let best: string | null = null;
    for (const v of vocab) if (editDistance(t, v, t.length >= 8 ? 2 : 1) <= (t.length >= 8 ? 2 : 1)) { best = v; break; }
    return best ?? t;
  });
  return `${fixed.join(' ')}${extra}`.trim();
}

// ---------------------------------------------------------------- index + retrieval

interface Index { content: Content; chunks: Chunk[]; docs: Doc[]; vocab: Set<string>; version: string; builtAt: string }
let cached: Index | null = null;

export function indexFor(c: Content): Index {
  if (cached?.content === c) return cached;
  const chunks = buildCorpus(c);
  const docs: Doc[] = chunks.map((ch) => ({ id: ch.id, source: 'kb', title: ch.title, text: ch.text, date: null, href: ch.url }));
  const vocab = new Set(chunks.flatMap((ch) => terms(`${ch.title} ${ch.text}`)));
  cached = { content: c, chunks, docs, vocab, version: versionOf(chunks.map((ch) => ch.id).join('|')), builtAt: new Date().toISOString() };
  return cached;
}

/** Drops the cached index; the next question rebuilds it from the latest content (admin "sync now"). */
export function resetIndex() {
  cached = null;
}

export const MIN_SCORE = 1.2;

export function retrieve(c: Content, question: string, k = 3) {
  const idx = indexFor(c);
  const query = rewriteQuery(question, idx.vocab);
  const hits = search(idx.docs, query, k * 2).filter((h) => h.score >= MIN_SCORE);
  // de-duplicate by section+title, keep the best
  const seen = new Set<string>();
  const out = [];
  for (const h of hits) {
    const ch = idx.chunks.find((x) => x.id === h.id)!;
    const key = `${ch.section}|${ch.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...ch, score: h.score });
    if (out.length >= k) break;
  }
  return { query, hits: out };
}

export const NOT_FOUND: Record<Lang, string> = {
  en: "I couldn't find verified information about that in the Bhargava Junior College knowledge base. Please contact the college office for confirmation.",
  te: 'భార్గవ జూనియర్ కాలేజీ సమాచారంలో దీని గురించి ధృవీకరించిన వివరాలు నాకు దొరకలేదు. దయచేసి నిర్ధారణ కోసం కాలేజీ కార్యాలయాన్ని సంప్రదించండి.',
  hi: 'भार्गव जूनियर कॉलेज की जानकारी में मुझे इसके बारे में सत्यापित जानकारी नहीं मिली। कृपया पुष्टि के लिए कॉलेज कार्यालय से संपर्क करें।',
};
const FROM: Record<Lang, string> = { en: 'From', te: 'ఆధారం:', hi: 'स्रोत:' };
const SAMPLE_NOTE: Record<Lang, string> = {
  en: 'This is currently listed information; please confirm with a counsellor.',
  te: 'ఇది ప్రస్తుతం జాబితాలో ఉన్న సమాచారం; దయచేసి కౌన్సెలర్‌తో నిర్ధారించుకోండి.',
  hi: 'यह फ़िलहाल सूचीबद्ध जानकारी है; कृपया काउंसलर से पुष्टि करें।',
};

/**
 * Grounded answer without an LLM: the best matching facts, quoted from the knowledge base with their source.
 * Used by both agents when the AI model is not configured or unavailable. Facts stay in English (the source
 * language); framing text follows the visitor's language.
 */
export const GREETING: Record<Lang, string> = {
  en: 'Hello! Welcome to Bhargava Junior College. How can I help you today?',
  te: 'నమస్కారం! భార్గవ జూనియర్ కాలేజీకి స్వాగతం. ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను?',
  hi: 'नमस्ते! भार्गव जूनियर कॉलेज में आपका स्वागत है। आज मैं आपकी कैसे मदद कर सकती हूँ?',
};
/** A bare greeting ("hi", "hello sir", "నమస్కారం", "नमस्ते") — answered with a welcome, not a search. */
// (no \b: it only knows ASCII word boundaries, so it never matches after Telugu or Hindi script)
export const isGreeting = (q: string) => /^\s*(hi+|hello+|hey+|hai|good (morning|afternoon|evening)|namaste|namaskar[a-z]*|నమస్కారం|నమస్తే|హాయ్|नमस्ते|नमस्कार|हैलो|हाय)(?=[\s!.,।]|$)[\s!.,।]*(sir|madam|mam|there|bjc|జీ|जी)?[\s!.,।]*$/i.test(q);

export function groundedAnswer(c: Content, question: string, lang: Lang = detectLang(question)) {
  const all = retrieve(c, question, 3).hits;
  if (!all.length) return { found: false as const, text: NOT_FOUND[lang], sources: [] as { title: string; url: string }[] };
  // Best section first; a second only if it is nearly as relevant. Sentences already said are not repeated.
  const hits = [all[0], ...all.slice(1).filter((h) => h.score >= all[0].score * 0.8 && h.section !== 'General')].slice(0, 2);
  const said = new Set<string>();
  const parts = hits.map((h) =>
    h.text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .filter((s) => {
        const k = s.toLowerCase().trim();
        if (!k || said.has(k)) return false;
        said.add(k);
        return true;
      })
      .join(' ')
      .slice(0, 480),
  ).filter(Boolean);
  const body = parts.join('\n\n');
  const note = hits.some((h) => h.sample) ? `\n\n${SAMPLE_NOTE[lang]}` : '';
  const sources = hits.map((h) => ({ title: h.title, url: h.url }));
  return { found: true as const, text: `${body}${note}`, sources, footer: `${FROM[lang]} ${sources.map((s) => s.title).join(' · ')}` };
}

export function indexStatus(c: Content) {
  const idx = indexFor(c);
  const bySection = new Map<string, number>();
  for (const ch of idx.chunks) bySection.set(ch.section, (bySection.get(ch.section) ?? 0) + 1);
  return { version: idx.version, builtAt: idx.builtAt, chunks: idx.chunks.length, sections: [...bySection.entries()].map(([section, n]) => ({ section, chunks: n, url: urlFor(section) })), sampleChunks: idx.chunks.filter((x) => x.sample).length };
}
