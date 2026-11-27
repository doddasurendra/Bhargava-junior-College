/** Student sign-up and forgot-password text in English, Telugu and Hindi. TODO(college): native-speaker review. */
export type SLang = 'en' | 'te' | 'hi';
const T = {
  title: ['Student sign-up', 'విద్యార్థి సైన్-అప్', 'छात्र साइन-अप'],
  sub: ['For admitted students of Bhargava Junior College. Use the College ID given by the college.', 'భార్గవ జూనియర్ కళాశాలలో ప్రవేశం పొందిన విద్యార్థుల కోసం. కళాశాల ఇచ్చిన కాలేజ్ IDని ఉపయోగించండి.', 'भार्गव जूनियर कॉलेज के प्रवेशित छात्रों के लिए। कॉलेज द्वारा दिया गया कॉलेज ID उपयोग करें।'],
  parent: ['I’m a parent →', 'నేను తల్లిదండ్రిని →', 'मैं अभिभावक हूँ →'],
  name: ['Student name', 'విద్యార్థి పేరు', 'छात्र का नाम'],
  nameHint: ['As in college records', 'కళాశాల రికార్డుల్లో ఉన్నట్లు', 'कॉलेज रिकॉर्ड के अनुसार'],
  cid: ['College ID / Admission number', 'కాలేజ్ ID / ప్రవేశ సంఖ్య', 'कॉलेज ID / प्रवेश संख्या'],
  dob: ['Date of birth', 'పుట్టిన తేదీ', 'जन्म तिथि'],
  pw: ['Password', 'పాస్‌వర్డ్', 'पासवर्ड'],
  pwHint: ['At least 8 characters, with a letter and a number.', 'కనీసం 8 అక్షరాలు, ఒక అక్షరం మరియు ఒక అంకెతో.', 'कम से कम 8 अक्षर, एक अक्षर और एक अंक के साथ।'],
  confirm: ['Confirm password', 'పాస్‌వర్డ్ నిర్ధారించండి', 'पासवर्ड की पुष्टि करें'],
  show: ['Show', 'చూపించు', 'दिखाएँ'],
  hide: ['Hide', 'దాచు', 'छिपाएँ'],
  weak: ['Weak', 'బలహీనం', 'कमज़ोर'],
  fair: ['Fair', 'సరే', 'ठीक'],
  strong: ['Strong', 'బలమైనది', 'मज़बूत'],
  consent: ['I agree to the college’s terms and privacy policy (DPDP Act 2023).', 'కళాశాల నిబంధనలు మరియు గోప్యతా విధానానికి (DPDP చట్టం 2023) నేను అంగీకరిస్తున్నాను.', 'मैं कॉलेज की शर्तों और गोपनीयता नीति (DPDP अधिनियम 2023) से सहमत हूँ।'],
  terms: ['terms and privacy policy', 'నిబంధనలు మరియు గోప్యతా విధానం', 'शर्तें और गोपनीयता नीति'],
  create: ['Create account', 'ఖాతా సృష్టించండి', 'खाता बनाएँ'],
  creating: ['Creating…', 'సృష్టిస్తోంది…', 'बन रहा है…'],
  have: ['Already have an account?', 'ఇప్పటికే ఖాతా ఉందా?', 'पहले से खाता है?'],
  signin: ['Sign in', 'సైన్ ఇన్', 'साइन इन'],
  forgot: ['Forgot password?', 'పాస్‌వర్డ్ మర్చిపోయారా?', 'पासवर्ड भूल गए?'],
  reset: ['reset your password', 'మీ పాస్‌వర్డ్ రీసెట్ చేయండి', 'अपना पासवर्ड रीसेट करें'],
  fTitle: ['Forgot password', 'పాస్‌వర్డ్ మర్చిపోయారా', 'पासवर्ड भूल गए'],
  fIntro: ['Student accounts have no email or mobile, so a new password needs a one-time code from one of these:', 'విద్యార్థి ఖాతాలకు ఈమెయిల్ లేదా మొబైల్ లేదు, కాబట్టి కొత్త పాస్‌వర్డ్‌కు వీరిలో ఒకరి నుండి ఒకసారి ఉపయోగించే కోడ్ అవసరం:', 'छात्र खातों में ईमेल या मोबाइल नहीं होता, इसलिए नए पासवर्ड के लिए इनमें से किसी से एक बार का कोड चाहिए:'],
  fA: ['Your parent: in the parent app, My child → Reset student password. They get a 6-digit code (valid 30 minutes) and give it to you.', 'మీ తల్లిదండ్రులు: తల్లిదండ్రుల యాప్‌లో, నా బిడ్డ → విద్యార్థి పాస్‌వర్డ్ రీసెట్. వారికి 6 అంకెల కోడ్ (30 నిమిషాలు చెల్లుతుంది) వస్తుంది, వారు దాన్ని మీకు ఇస్తారు.', 'आपके अभिभावक: अभिभावक ऐप में, मेरा बच्चा → छात्र पासवर्ड रीसेट। उन्हें 6 अंकों का कोड (30 मिनट मान्य) मिलता है और वे आपको देते हैं।'],
  fB: ['The admin office: they can give you a one-time code that is valid for 24 hours.', 'అడ్మిన్ కార్యాలయం: వారు 24 గంటలు చెల్లే ఒకసారి ఉపయోగించే కోడ్ ఇవ్వగలరు.', 'प्रशासन कार्यालय: वे 24 घंटे मान्य एक बार का कोड दे सकते हैं।'],
  code: ['6-digit code', '6 అంకెల కోడ్', '6 अंकों का कोड'],
  newPw: ['New password', 'కొత్త పాస్‌వర్డ్', 'नया पासवर्ड'],
  setPw: ['Set new password', 'కొత్త పాస్‌వర్డ్ సెట్ చేయండి', 'नया पासवर्ड सेट करें'],
  saving: ['Saving…', 'సేవ్ చేస్తోంది…', 'सहेजा जा रहा है…'],
  done: ['Password changed. Sign in with your College ID and the new password.', 'పాస్‌వర్డ్ మార్చబడింది. మీ కాలేజ్ ID మరియు కొత్త పాస్‌వర్డ్‌తో సైన్ ఇన్ చేయండి.', 'पासवर्ड बदल गया। अपने कॉलेज ID और नए पासवर्ड से साइन इन करें।'],
  created: ['Account created.', 'ఖాతా సృష్టించబడింది.', 'खाता बन गया।'],
} as const;
export type SKey = keyof typeof T;
export const st = (lang: string, k: SKey) => T[k][lang === 'te' ? 1 : lang === 'hi' ? 2 : 0];
export const sDict = (lang: string) => Object.fromEntries(Object.keys(T).map((k) => [k, st(lang, k as SKey)])) as Record<SKey, string>;

/** Server messages (errors) in the three languages, keyed by their English text. */
const ERR: Record<string, [string, string]> = {
  'These details don’t match our records. Check your College ID and date of birth, or contact the admin office.': ['ఈ వివరాలు మా రికార్డులతో సరిపోలడం లేదు. మీ కాలేజ్ ID మరియు పుట్టిన తేదీని తనిఖీ చేయండి, లేదా అడ్మిన్ కార్యాలయాన్ని సంప్రదించండి.', 'ये विवरण हमारे रिकॉर्ड से मेल नहीं खाते। अपना कॉलेज ID और जन्म तिथि जाँचें, या प्रशासन कार्यालय से संपर्क करें।'],
  'An account already exists for this College ID. Sign in or reset your password.': ['ఈ కాలేజ్ IDకి ఇప్పటికే ఖాతా ఉంది. సైన్ ఇన్ చేయండి లేదా మీ పాస్‌వర్డ్ రీసెట్ చేయండి.', 'इस कॉलेज ID के लिए पहले से खाता है। साइन इन करें या अपना पासवर्ड रीसेट करें।'],
  'Too many attempts. Please try again later.': ['చాలా ప్రయత్నాలు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి.', 'बहुत अधिक प्रयास। कृपया बाद में फिर प्रयास करें।'],
  'This account is blocked. Please contact the admin office.': ['ఈ ఖాతా బ్లాక్ చేయబడింది. దయచేసి అడ్మిన్ కార్యాలయాన్ని సంప్రదించండి.', 'यह खाता ब्लॉक है। कृपया प्रशासन कार्यालय से संपर्क करें।'],
  'That code is not correct or has expired. Ask your parent or the admin office for a new one.': ['ఆ కోడ్ సరైనది కాదు లేదా గడువు ముగిసింది. కొత్తది కోసం మీ తల్లిదండ్రులను లేదా అడ్మిన్ కార్యాలయాన్ని అడగండి.', 'वह कोड सही नहीं है या समाप्त हो गया है। नए कोड के लिए अपने अभिभावक या प्रशासन कार्यालय से कहें।'],
  'Enter your name as in college records (2–60 letters).': ['కళాశాల రికార్డుల్లో ఉన్నట్లు మీ పేరు నమోదు చేయండి (2–60 అక్షరాలు).', 'कॉलेज रिकॉर्ड के अनुसार अपना नाम दर्ज करें (2–60 अक्षर)।'],
  'Enter your College ID, like BJC-2027-JEE-0001.': ['మీ కాలేజ్ IDని నమోదు చేయండి, ఉదా. BJC-2027-JEE-0001.', 'अपना कॉलेज ID दर्ज करें, जैसे BJC-2027-JEE-0001।'],
  'Enter your date of birth.': ['మీ పుట్టిన తేదీని నమోదు చేయండి.', 'अपनी जन्म तिथि दर्ज करें।'],
  'Enter a valid date.': ['సరైన తేదీని నమోదు చేయండి.', 'सही तारीख दर्ज करें।'],
  'Students must be between 14 and 25 years old.': ['విద్యార్థుల వయస్సు 14 మరియు 25 సంవత్సరాల మధ్య ఉండాలి.', 'छात्रों की आयु 14 से 25 वर्ष के बीच होनी चाहिए।'],
  'Use at least 8 characters.': ['కనీసం 8 అక్షరాలు ఉపయోగించండి.', 'कम से कम 8 अक्षर उपयोग करें।'],
  'Use at most 128 characters.': ['గరిష్ఠంగా 128 అక్షరాలు ఉపయోగించండి.', 'अधिकतम 128 अक्षर उपयोग करें।'],
  'Use at least one letter and one number.': ['కనీసం ఒక అక్షరం మరియు ఒక అంకె ఉపయోగించండి.', 'कम से कम एक अक्षर और एक अंक उपयोग करें।'],
  'Don’t use your College ID in the password.': ['పాస్‌వర్డ్‌లో మీ కాలేజ్ IDని ఉపయోగించవద్దు.', 'पासवर्ड में अपना कॉलेज ID उपयोग न करें।'],
  'The two passwords don’t match.': ['రెండు పాస్‌వర్డ్‌లు సరిపోలడం లేదు.', 'दोनों पासवर्ड मेल नहीं खाते।'],
  'Please agree to the terms and privacy policy to continue.': ['కొనసాగడానికి దయచేసి నిబంధనలు మరియు గోప్యతా విధానానికి అంగీకరించండి.', 'जारी रखने के लिए कृपया शर्तों और गोपनीयता नीति से सहमत हों।'],
  'Enter the 6-digit code.': ['6 అంకెల కోడ్ నమోదు చేయండి.', '6 अंकों का कोड दर्ज करें।'],
  'Something went wrong. Please try again.': ['ఏదో తప్పు జరిగింది. దయచేసి మళ్లీ ప్రయత్నించండి.', 'कुछ गलत हुआ। कृपया फिर से प्रयास करें।'],
};
export const sErr = (lang: string, msg: string) => (lang === 'te' ? ERR[msg]?.[0] : lang === 'hi' ? ERR[msg]?.[1] : null) ?? msg;
