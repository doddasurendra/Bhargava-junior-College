import te from '@/content/parent-counselling/te.json';
import en from '@/content/parent-counselling/en.json';
import hi from '@/content/parent-counselling/hi.json';

/** The 11-page Parent Counselling Session Guide (cover + 10 steps). Telugu is the PDF original; en/hi share its keys. */
export type GuideContent = typeof te;
export type GuideLang = 'te' | 'en' | 'hi';
export const GUIDE_LANGS: { code: GuideLang; label: string }[] = [
  { code: 'te', label: 'తెలుగు' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
];
export const GUIDE_LANG_COOKIE = 'bpc_lang';
export const isGuideLang = (v: unknown): v is GuideLang => v === 'te' || v === 'en' || v === 'hi';

const ALL: Record<GuideLang, GuideContent> = { te, en: en as GuideContent, hi: hi as GuideContent };
export const guideContent = (lang: GuideLang): GuideContent => ALL[lang];
export const englishGuide = (): GuideContent => ALL.en;

export const STEP_COUNT = 10;
export const PDF_PATH = '/docs/Bhargava_Parent_Counselling_Guide_10_Steps_Telugu.pdf';

/** Admin-filled blanks (CMS block `parentCounselling`). */
export type GuideSettings = {
  calls: string | null; visits: string | null; progress: string | null; medical: string | null; laundry: string | null;
  tuition: string | null; hostelFee: string | null; scholarship: string | null; schedule: string | null; visiting: string | null; lastDate: string | null;
};

export type Answers = Record<string, unknown>;

/** Columns derived from the answers on every save (kept in sync so the CRM can query them). */
export function deriveColumns(a: Answers) {
  const g = englishGuide();
  const s1 = g.steps['1'];
  const s10 = g.steps['10'];
  const worries = s1.worries.filter((_, i) => a[`s1.w.${i}`] === true).slice(0, 2);
  const next = s10.next.filter((_, i) => a[`s10.next.${i}`] === true);
  const interestIdx = typeof a['s10.int'] === 'string' ? Number(a['s10.int']) : NaN;
  const str = (k: string) => (typeof a[k] === 'string' && (a[k] as string).trim() ? (a[k] as string).trim().slice(0, 500) : null);
  const date = (k: string) => {
    const v = str(k);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  return {
    worries,
    nextStep: next.length ? next.join(', ') : null,
    nextStepDate: date('s10.nf.0'),
    interest: (['high', 'medium', 'low'] as const)[interestIdx] ?? null,
    followUpDate: date('s10.follow'),
    outcome: str('s10.outcome'),
    selfCheck: [0, 1, 2].map((i) => a[`s10.self.${i}`] === true),
  };
}
