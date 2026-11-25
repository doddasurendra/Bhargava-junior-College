/** Open Book interface labels in English, Telugu and Hindi (§27). AI answers follow the chosen language separately. */
export type ObLang = 'en' | 'te' | 'hi';
type Dict = Record<string, [string, string, string]>;
const D: Dict = {
  home: ['Open Book', 'ఓపెన్ బుక్', 'ओपन बुक'],
  library: ['Digital Library', 'డిజిటల్ లైబ్రరీ', 'डिजिटल लाइब्रेरी'],
  inter: ['Intermediate Books', 'ఇంటర్మీడియట్ పుస్తకాలు', 'इंटरमीडिएट पुस्तकें'],
  jee: ['JEE Preparation', 'JEE సన్నద్ధత', 'JEE तैयारी'],
  neet: ['NEET Preparation', 'NEET సన్నద్ధత', 'NEET तैयारी'],
  higher: ['Higher Education & Competitive Exams', 'ఉన్నత విద్య & పోటీ పరీక్షలు', 'उच्च शिक्षा और प्रतियोगी परीक्षाएँ'],
  papers: ['Previous Year Papers', 'గత సంవత్సర ప్రశ్నాపత్రాలు', 'पिछले वर्ष के प्रश्नपत्र'],
  generate: ['AI Question Generator', 'AI ప్రశ్నల జనరేటర్', 'AI प्रश्न जनरेटर'],
  mock: ['AI Mock Tests', 'AI మాక్ టెస్టులు', 'AI मॉक टेस्ट'],
  assistant: ['AI Study Assistant', 'AI స్టడీ అసిస్టెంట్', 'AI अध्ययन सहायक'],
  notes: ['My Notes', 'నా నోట్స్', 'मेरे नोट्स'],
  bookmarks: ['My Bookmarks', 'నా బుక్‌మార్క్‌లు', 'मेरे बुकमार्क'],
  analytics: ['Learning Analytics', 'అభ్యాస విశ్లేషణ', 'सीखने का विश्लेषण'],
  path: ['Learning Path', 'అభ్యాస మార్గం', 'सीखने का मार्ग'],
  patterns: ['Pattern Analyzer', 'ప్యాటర్న్ విశ్లేషణ', 'पैटर्न विश्लेषक'],
  flashcards: ['Flashcards', 'ఫ్లాష్‌కార్డులు', 'फ्लैशकार्ड'],
  community: ['Community', 'కమ్యూనిటీ', 'समुदाय'],
  tutor: ['Voice Tutor', 'వాయిస్ ట్యూటర్', 'वॉयस ट्यूटर'],
  challenge: ['Daily Challenge', 'రోజువారీ సవాలు', 'दैनिक चुनौती'],
  scan: ['Scan a Question', 'ప్రశ్నను స్కాన్ చేయండి', 'प्रश्न स्कैन करें'],
  questions: ['My Questions', 'నా ప్రశ్నలు', 'मेरे प्रश्न'],
  continue: ['Continue reading', 'చదవడం కొనసాగించండి', 'पढ़ना जारी रखें'],
  comingSoon: ['Coming soon', 'త్వరలో', 'जल्द आ रहा है'],
  search: ['Search', 'వెతకండి', 'खोजें'],
  recommended: ['Recommended for you', 'మీ కోసం సిఫార్సులు', 'आपके लिए सुझाव'],
  recent: ['Recently added', 'ఇటీవల జోడించినవి', 'हाल ही में जोड़े गए'],
  dueCards: ['cards due today', 'ఈరోజు చూడాల్సిన కార్డులు', 'आज के कार्ड'],
  today: ['Today', 'ఈరోజు', 'आज'],
};
export const t = (lang: ObLang, key: keyof typeof D) => D[key][lang === 'te' ? 1 : lang === 'hi' ? 2 : 0];
export const OB_MENU: { key: keyof typeof D; href: string }[] = [
  { key: 'home', href: '/app/openbook' }, { key: 'library', href: '/app/openbook/library' }, { key: 'inter', href: '/app/openbook/library?category=intermediate' },
  { key: 'jee', href: '/app/openbook/library?category=engineering' }, { key: 'neet', href: '/app/openbook/library?category=medical' }, { key: 'higher', href: '/app/openbook/library?category=higher' },
  { key: 'papers', href: '/app/openbook/papers' }, { key: 'generate', href: '/app/openbook/generate' }, { key: 'mock', href: '/app/openbook/mock' }, { key: 'assistant', href: '/app/openbook/assistant' },
  { key: 'notes', href: '/app/openbook/notes' }, { key: 'bookmarks', href: '/app/openbook/bookmarks' }, { key: 'analytics', href: '/app/openbook/analytics' }, { key: 'path', href: '/app/openbook/path' },
  { key: 'patterns', href: '/app/openbook/patterns' }, { key: 'flashcards', href: '/app/openbook/flashcards' }, { key: 'community', href: '/app/openbook/community' }, { key: 'tutor', href: '/app/openbook/tutor' },
  { key: 'challenge', href: '/app/openbook/challenge' }, { key: 'scan', href: '/app/openbook/scan' },
];
