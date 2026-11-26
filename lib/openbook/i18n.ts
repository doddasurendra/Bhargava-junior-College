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
  revision: ['Formula Sheets', 'ఫార్ములా షీట్లు', 'फ़ॉर्मूला शीट'],
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
  { key: 'patterns', href: '/app/openbook/patterns' }, { key: 'flashcards', href: '/app/openbook/flashcards' }, { key: 'revision', href: '/app/openbook/revision' }, { key: 'community', href: '/app/openbook/community' }, { key: 'tutor', href: '/app/openbook/tutor' },
  { key: 'challenge', href: '/app/openbook/challenge' }, { key: 'scan', href: '/app/openbook/scan' },
];

/** Page headings and descriptions (§27), English / Telugu / Hindi. */
export const PAGES: Record<string, [[string, string], [string, string], [string, string]]> = {
  library: [['Digital Library', 'Search by title, author, subject, publisher, exam or year.'], ['డిజిటల్ లైబ్రరీ', 'శీర్షిక, రచయిత, సబ్జెక్ట్, ప్రచురణకర్త, పరీక్ష లేదా సంవత్సరం ద్వారా వెతకండి.'], ['डिजिटल लाइब्रेरी', 'शीर्षक, लेखक, विषय, प्रकाशक, परीक्षा या वर्ष से खोजें।']],
  papers: [['Previous Year Papers', 'Official papers, model papers and student uploads. Originals are kept unchanged.'], ['గత సంవత్సర ప్రశ్నాపత్రాలు', 'అధికారిక, మోడల్ పేపర్లు మరియు విద్యార్థుల అప్‌లోడ్‌లు. అసలు ఫైళ్లు మార్చబడవు.'], ['पिछले वर्ष के प्रश्नपत्र', 'आधिकारिक, मॉडल पेपर और छात्रों के अपलोड। मूल फ़ाइलें नहीं बदली जातीं।']],
  generate: [['AI Question Generator', 'Questions only on the concept you choose, in your exam’s real pattern, never repeating one you already had.'], ['AI ప్రశ్నల జనరేటర్', 'మీరు ఎంచుకున్న కాన్సెప్ట్‌పై మాత్రమే, మీ పరీక్ష అసలు నమూనాలో ప్రశ్నలు; ఇంతకు ముందు వచ్చినవి మళ్లీ రావు.'], ['AI प्रश्न जनरेटर', 'केवल आपके चुने हुए कॉन्सेप्ट पर, आपकी परीक्षा के असली पैटर्न में प्रश्न; पहले मिले प्रश्न दोबारा नहीं।']],
  questions: [['My Questions', 'Generated, scanned and saved questions. Each shows the duplicate checks it passed.'], ['నా ప్రశ్నలు', 'తయారైన, స్కాన్ చేసిన, సేవ్ చేసిన ప్రశ్నలు. ప్రతిదానిపై ఏ డూప్లికేట్ తనిఖీలు జరిగాయో చూపిస్తుంది.'], ['मेरे प्रश्न', 'बनाए, स्कैन किए और सहेजे गए प्रश्न। हर प्रश्न पर डुप्लिकेट जाँच दिखाई जाती है।']],
  mock: [['AI Mock Tests', 'Timed papers in your exam’s pattern with instant evaluation and a detailed report.'], ['AI మాక్ టెస్టులు', 'మీ పరీక్ష నమూనాలో సమయ పరిమితి గల పేపర్లు, వెంటనే మూల్యాంకనం, వివరమైన నివేదిక.'], ['AI मॉक टेस्ट', 'आपकी परीक्षा के पैटर्न में समयबद्ध पेपर, तुरंत मूल्यांकन और विस्तृत रिपोर्ट।']],
  assistant: [['AI Study Assistant', 'Answers come from Open Book’s books with the book and page; it says when something isn’t in your sources.'], ['AI స్టడీ అసిస్టెంట్', 'సమాధానాలు ఓపెన్ బుక్ పుస్తకాల నుంచి, పుస్తకం మరియు పేజీతో; మీ వనరుల్లో లేకపోతే అదే చెబుతుంది.'], ['AI अध्ययन सहायक', 'उत्तर ओपन बुक की पुस्तकों से, पुस्तक और पृष्ठ के साथ; स्रोतों में न हो तो साफ़ बताता है।']],
  tutor: [['Voice Tutor', 'Talk to your tutor in English, Telugu or Hindi. Tap 🎤, speak, and it answers aloud.'], ['వాయిస్ ట్యూటర్', 'ఇంగ్లీష్, తెలుగు లేదా హిందీలో మాట్లాడండి. 🎤 నొక్కి మాట్లాడితే, గట్టిగా సమాధానం చెబుతుంది.'], ['वॉयस ट्यूटर', 'अंग्रेज़ी, तेलुगु या हिंदी में बात करें। 🎤 दबाकर बोलें, ट्यूटर बोलकर जवाब देगा।']],
  notes: [['My Notes', 'Private to you. Highlights, notes and your revision list from every book.'], ['నా నోట్స్', 'మీకు మాత్రమే. ప్రతి పుస్తకంలోని హైలైట్లు, నోట్స్, రివిజన్ జాబితా.'], ['मेरे नोट्स', 'केवल आपके लिए। हर पुस्तक के हाइलाइट, नोट्स और रिवीज़न सूची।']],
  bookmarks: [['My Bookmarks', 'Bookmarked pages, favourite books and your reading history.'], ['నా బుక్‌మార్క్‌లు', 'బుక్‌మార్క్ చేసిన పేజీలు, ఇష్టమైన పుస్తకాలు, చదివిన చరిత్ర.'], ['मेरे बुकमार्क', 'बुकमार्क किए पृष्ठ, पसंदीदा पुस्तकें और पढ़ने का इतिहास।']],
  analytics: [['Learning Analytics', 'Your own learning data. Only you (and your teachers for your batch) can see it.'], ['అభ్యాస విశ్లేషణ', 'మీ అభ్యాస సమాచారం. మీరు (మరియు మీ బ్యాచ్ ఉపాధ్యాయులు) మాత్రమే చూడగలరు.'], ['सीखने का विश्लेषण', 'आपका अपना डेटा। केवल आप (और आपके बैच के शिक्षक) देख सकते हैं।']],
  path: [['Learning Path', 'A personal order of concepts to read, practise, revise and test, counted back from your exam date.'], ['అభ్యాస మార్గం', 'చదవడానికి, సాధన చేయడానికి, రివిజన్‌కు, పరీక్షకు మీ వ్యక్తిగత కాన్సెప్ట్ క్రమం, పరీక్ష తేదీ నుంచి లెక్కించినది.'], ['सीखने का मार्ग', 'पढ़ने, अभ्यास, रिवीज़न और टेस्ट के लिए आपका व्यक्तिगत क्रम, परीक्षा तिथि से पीछे गिनकर।']],
  patterns: [['Pattern Analyzer', 'Past weightage from approved papers. It shows trends; it never predicts exact questions.'], ['ప్యాటర్న్ విశ్లేషణ', 'ఆమోదించిన పేపర్ల నుంచి గత వెయిటేజ్. ధోరణులు చూపిస్తుంది; ఖచ్చితమైన ప్రశ్నలను ఊహించదు.'], ['पैटर्न विश्लेषक', 'स्वीकृत पेपरों से पिछला वेटेज। रुझान दिखाता है; सटीक प्रश्नों की भविष्यवाणी नहीं करता।']],
  flashcards: [['Flashcards & Revision', 'Spaced repetition: Again / Hard / Good / Easy decides when each card comes back.'], ['ఫ్లాష్‌కార్డులు & రివిజన్', 'స్పేస్డ్ రిపిటిషన్: Again / Hard / Good / Easy ప్రకారం కార్డు మళ్లీ ఎప్పుడు వస్తుందో నిర్ణయమవుతుంది.'], ['फ्लैशकार्ड और रिवीज़न', 'स्पेस्ड रिपिटिशन: Again / Hard / Good / Easy तय करता है कि कार्ड कब लौटेगा।']],
  revision: [['Formula sheets & revision', 'A one-page formula sheet and revision notes for any chapter. Save it as a PDF.'], ['ఫార్ములా షీట్లు & రివిజన్', 'ఏ అధ్యాయానికైనా ఒక పేజీ ఫార్ములా షీట్ మరియు రివిజన్ నోట్స్. PDF గా సేవ్ చేయండి.'], ['फ़ॉर्मूला शीट और रिवीज़न', 'किसी भी अध्याय के लिए एक पृष्ठ की फ़ॉर्मूला शीट और रिवीज़न नोट्स। PDF के रूप में सहेजें।']],
  community: [['Question Community', 'BJC students and teachers only. Be kind; no personal details.'], ['ప్రశ్నల కమ్యూనిటీ', 'BJC విద్యార్థులు మరియు ఉపాధ్యాయులకు మాత్రమే. మర్యాదగా ఉండండి; వ్యక్తిగత వివరాలు వద్దు.'], ['प्रश्न समुदाय', 'केवल BJC छात्र और शिक्षक। विनम्र रहें; व्यक्तिगत जानकारी नहीं।']],
  challenge: [['Daily Challenge', '5 questions per subject, the same for your whole batch. Open 6 AM–11 PM.'], ['రోజువారీ సవాలు', 'ప్రతి సబ్జెక్ట్‌కు 5 ప్రశ్నలు, మీ బ్యాచ్ అందరికీ ఒకటే. ఉదయం 6 నుంచి రాత్రి 11 వరకు.'], ['दैनिक चुनौती', 'हर विषय के 5 प्रश्न, पूरे बैच के लिए एक जैसे। सुबह 6 से रात 11 बजे तक।']],
  scan: [['Scan a Question', 'Photograph a handwritten or printed question, check the text, then solve it or ask a teacher.'], ['ప్రశ్నను స్కాన్ చేయండి', 'చేతిరాత లేదా ముద్రిత ప్రశ్నను ఫోటో తీసి, టెక్స్ట్ సరిచూసి, పరిష్కరించండి లేదా ఉపాధ్యాయుడిని అడగండి.'], ['प्रश्न स्कैन करें', 'हाथ से लिखे या छपे प्रश्न की फ़ोटो लें, टेक्स्ट जाँचें, फिर हल करें या शिक्षक से पूछें।']],
};
export const page = (lang: ObLang, key: keyof typeof PAGES) => { const [title, sub] = PAGES[key][lang === 'te' ? 1 : lang === 'hi' ? 2 : 0]; return { title, sub }; };

/** Interface words used by the interactive components. */
const UI = {
  generate: ['Generate questions', 'ప్రశ్నలు తయారు చేయండి', 'प्रश्न बनाएँ'], generating: ['Generating and checking for duplicates…', 'తయారు చేసి డూప్లికేట్లు తనిఖీ చేస్తోంది…', 'प्रश्न बना रहे हैं और डुप्लिकेट जाँच रहे हैं…'],
  check: ['Check answer', 'జవాబు తనిఖీ చేయండి', 'उत्तर जाँचें'], checking: ['Checking…', 'తనిఖీ చేస్తోంది…', 'जाँच रहे हैं…'], reveal: ['Reveal answer', 'జవాబు చూపించు', 'उत्तर दिखाएँ'], hide: ['Hide answer', 'జవాబు దాచు', 'उत्तर छिपाएँ'],
  simpler: ['Explain simpler', 'సులభంగా వివరించు', 'आसान भाषा में समझाएँ'], advanced: ['Advanced', 'లోతుగా', 'उन्नत'], correct: ['Correct', 'సరైనది', 'सही'], notQuite: ['Not quite', 'సరికాదు', 'सही नहीं'],
  answer: ['Answer', 'జవాబు', 'उत्तर'], noKey: ['No answer key for this question yet.', 'ఈ ప్రశ్నకు ఇంకా జవాబు కీ లేదు.', 'इस प्रश्न की उत्तर कुंजी अभी नहीं है।'], yourAnswer: ['Your answer', 'మీ జవాబు', 'आपका उत्तर'],
  submit: ['Submit', 'సమర్పించండి', 'जमा करें'], saveNext: ['Save & next', 'సేవ్ చేసి తర్వాత', 'सहेजें और आगे'], previous: ['Previous', 'మునుపటి', 'पिछला'], clear: ['Clear', 'తుడిచివేయి', 'साफ़ करें'],
  markReview: ['Mark for review', 'సమీక్షకు గుర్తించు', 'समीक्षा के लिए चिह्नित करें'], unmark: ['Unmark review', 'గుర్తు తీసివేయి', 'चिह्न हटाएँ'], saved: ['All answers saved', 'అన్ని జవాబులు సేవ్ అయ్యాయి', 'सभी उत्तर सहेजे गए'], saving: ['Saving…', 'సేవ్ అవుతోంది…', 'सहेज रहे हैं…'],
  tapShow: ['Tap to show the answer', 'జవాబు కోసం నొక్కండి', 'उत्तर देखने के लिए टैप करें'], sessionDone: ['Session done. Cards come back when they are due again.', 'సెషన్ పూర్తయింది. గడువు వచ్చినప్పుడు కార్డులు మళ్లీ వస్తాయి.', 'सत्र पूरा। कार्ड फिर से समय आने पर लौटेंगे।'],
  marking: ['Marking…', 'మార్కులు వేస్తోంది…', 'अंक दे रहे हैं…'], scan: ['📷 Scan with camera or choose a photo', '📷 కెమెరాతో స్కాన్ చేయండి లేదా ఫోటో ఎంచుకోండి', '📷 कैमरे से स्कैन करें या फ़ोटो चुनें'],
  solve: ['Solve step by step', 'దశలవారీగా పరిష్కరించు', 'चरण-दर-चरण हल करें'], similar: ['5 similar questions', '5 సారూప్య ప్రశ్నలు', '5 मिलते-जुलते प्रश्न'], saveMine: ['Save to my questions', 'నా ప్రశ్నల్లో సేవ్ చేయి', 'मेरे प्रश्नों में सहेजें'],
  makeCard: ['Make a flashcard', 'ఫ్లాష్‌కార్డ్ చేయి', 'फ्लैशकार्ड बनाएँ'], post: ['Post to community', 'కమ్యూనిటీలో పోస్ట్ చేయి', 'समुदाय में पोस्ट करें'], teacher: ['Send to a teacher', 'ఉపాధ్యాయుడికి పంపు', 'शिक्षक को भेजें'],
  createStart: ['Create and start the test', 'టెస్ట్ తయారు చేసి ప్రారంభించండి', 'टेस्ट बनाएँ और शुरू करें'], building: ['Building your test…', 'మీ టెస్ట్ తయారవుతోంది…', 'आपका टेस्ट बन रहा है…'],
} as const;
export type UiKey = keyof typeof UI;
export const ui = (lang: ObLang | undefined, k: UiKey) => UI[k][lang === 'te' ? 1 : lang === 'hi' ? 2 : 0];

