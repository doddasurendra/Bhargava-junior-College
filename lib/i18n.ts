/**
 * Site chrome strings in English / Telugu / Hindi. Page bodies are English in phase 1;
 * full vernacular content comes with the CMS (each entry localised).
 * TODO(college): have a native speaker review the Telugu and Hindi strings.
 */
export const LANGS = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'te', label: 'తెలుగు', short: 'తె' },
  { code: 'hi', label: 'हिंदी', short: 'हि' },
] as const;
export type Lang = (typeof LANGS)[number]['code'];
export const LANG_COOKIE = 'bjc_lang';

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'te' || v === 'hi';
}

const en = {
  admissionsOpen: 'Admissions open 2027–29',
  nav: {
    results: 'Results',
    summary: 'Summary',
    programs: 'Programs',
    fees: 'Fees',
    scholarship: 'Scholarship',
    hostel: 'Hostel',
    visit: 'Campus visit',
    parents: 'Parents',
    resources: 'Resources',
    about: 'About',
    contact: 'Contact',
  },
  track: 'Track admission',
  enquire: 'Enquire now',
  bar: { visit: 'Visit', fees: 'Fees', call: 'Call', whatsapp: 'WhatsApp', enquire: 'Enquire' },
  menu: 'Menu',
  language: 'Language',
};

export type Dict = typeof en;

const te: Dict = {
  admissionsOpen: 'అడ్మిషన్లు ప్రారంభం 2027–29',
  nav: {
    results: 'ఫలితాలు',
    summary: 'సారాంశం',
    programs: 'కోర్సులు',
    fees: 'ఫీజులు',
    scholarship: 'స్కాలర్‌షిప్',
    hostel: 'హాస్టల్',
    visit: 'క్యాంపస్ సందర్శన',
    parents: 'తల్లిదండ్రులు',
    resources: 'వనరులు',
    about: 'మా గురించి',
    contact: 'సంప్రదించండి',
  },
  track: 'అడ్మిషన్ స్థితి',
  enquire: 'ఇప్పుడే విచారించండి',
  bar: { visit: 'సందర్శన', fees: 'ఫీజులు', call: 'కాల్', whatsapp: 'వాట్సాప్', enquire: 'విచారణ' },
  menu: 'మెనూ',
  language: 'భాష',
};

const hi: Dict = {
  admissionsOpen: 'प्रवेश खुले हैं 2027–29',
  nav: {
    results: 'परिणाम',
    summary: 'सारांश',
    programs: 'कोर्स',
    fees: 'फीस',
    scholarship: 'छात्रवृत्ति',
    hostel: 'हॉस्टल',
    visit: 'कैंपस विज़िट',
    parents: 'अभिभावक',
    resources: 'संसाधन',
    about: 'हमारे बारे में',
    contact: 'संपर्क',
  },
  track: 'एडमिशन स्थिति',
  enquire: 'अभी पूछताछ करें',
  bar: { visit: 'विज़िट', fees: 'फीस', call: 'कॉल', whatsapp: 'व्हाट्सऐप', enquire: 'पूछताछ' },
  menu: 'मेनू',
  language: 'भाषा',
};

export const dict: Record<Lang, Dict> = { en, te, hi };
