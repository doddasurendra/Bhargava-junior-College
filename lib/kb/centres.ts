import type { Lang } from '../i18n';
import type { Level } from './access';

/**
 * The 22 Knowledge Centres (§1–§22), in their BJC (junior college) versions. A centre is a view, not a
 * store: its articles and documents are KB items tagged with the centre, and its "live data" links point
 * to the existing modules (attendance, marks, fees, leads, results) — that data is never copied here.
 * Degree-college items are replaced with their BJC versions (no semesters, NBA/AICTE or campus placements).
 */
type T = Record<Lang, string>;
export interface Topic {
  key: string;
  t: T;
  /** "BJC version" note shown to editors */
  note?: string;
  /** live module this topic shows, per surface */
  crm?: string;
  app?: string;
  site?: string;
}
export interface Centre {
  id: string;
  section: number;
  name: T;
  intro: string;
  icon: string;
  /** levels that may open the centre (any match) */
  open: Level[];
  /** default access for new articles in this centre */
  defaultAccess: Level;
  /** shown in the CRM sidebar group vs. a management screen of the hub itself */
  kind: 'content' | 'system';
  topics: Topic[];
  /** the public website groups shown on /knowledge-base */
  publicGroup?: 'admissions' | 'courses' | 'campus' | 'exams' | 'career' | 'events';
}

const tp = (key: string, en: string, te: string, hi: string, links: Partial<Pick<Topic, 'crm' | 'app' | 'site' | 'note'>> = {}): Topic => ({ key, t: { en, te, hi }, ...links });
const STAFF: Level[] = ['faculty', 'subject_head', 'principal', 'management', 'admissions', 'accounts', 'admin'];

export const CENTRES: Centre[] = [
  {
    id: 'core', section: 1, kind: 'system', icon: '📚', open: STAFF, defaultAccess: 'faculty',
    name: { en: 'Core knowledge base', te: 'ప్రధాన నాలెడ్జ్ బేస్', hi: 'मुख्य नॉलेज बेस' },
    intro: 'Dashboard, repositories, categories, search, import/export, approvals, versions, audit and sync.',
    topics: [
      tp('website', 'Website knowledge repository', 'వెబ్‌సైట్ సమాచార భాండాగారం', 'वेबसाइट ज्ञान भंडार', { site: '/knowledge-base' }),
      tp('app', 'Mobile app knowledge repository', 'మొబైల్ యాప్ సమాచార భాండాగారం', 'मोबाइल ऐप ज्ञान भंडार', { app: '/app/knowledge' }),
    ],
  },
  {
    id: 'documents', section: 2, kind: 'system', icon: '🗂️', open: STAFF, defaultAccess: 'faculty',
    name: { en: 'Documents & files', te: 'పత్రాలు & ఫైళ్లు', hi: 'दस्तावेज़ और फ़ाइलें' },
    intro: 'Upload PDF, Word, Excel/CSV, PowerPoint, images and scans; preview, OCR, versions, approval, archive.',
    topics: [],
  },
  {
    id: 'student', section: 3, kind: 'content', icon: '🎒', open: ['student', ...STAFF], defaultAccess: 'student', publicGroup: 'courses',
    name: { en: 'Student Knowledge Centre', te: 'విద్యార్థి సమాచార కేంద్రం', hi: 'छात्र ज्ञान केंद्र' },
    intro: 'Handbook, TSBIE and BJC rules, year-wise study material, papers, lab manuals, exams, scholarships, welfare and career guidance.',
    topics: [
      tp('handbook', 'Student handbook', 'విద్యార్థి హ్యాండ్‌బుక్', 'छात्र पुस्तिका', { note: 'BJC rules, campus routine, dress code, mobile policy' }),
      tp('regulations', 'Academic regulations', 'అకడమిక్ నియమాలు', 'शैक्षणिक नियम', { note: 'TS Intermediate (TSBIE) rules + BJC academic rules' }),
      tp('syllabus', 'Course & syllabus', 'కోర్సు & సిలబస్', 'कोर्स और पाठ्यक्रम', { crm: '/crm/syllabus', app: '/app/syllabus', note: 'TS Inter, JEE Main, JEE Advanced, NEET' }),
      tp('materials', 'Year-wise & chapter-wise study material', 'సంవత్సరం & అధ్యాయం వారీ స్టడీ మెటీరియల్', 'वर्ष व अध्याय-वार अध्ययन सामग्री', { app: '/app/study', note: 'Inter 1st year / 2nd year (no semesters)' }),
      tp('notes', 'Notes, NCERT references & formula sheets', 'నోట్స్, NCERT రిఫరెన్సులు & ఫార్ములా షీట్లు', 'नोट्स, NCERT संदर्भ और सूत्र पत्र'),
      tp('previous_papers', 'Previous papers (TS Inter, JEE, NEET)', 'పాత ప్రశ్నపత్రాలు (TS ఇంటర్, JEE, NEET)', 'पिछले प्रश्नपत्र (TS इंटर, JEE, NEET)'),
      tp('model_papers', 'BJC model papers & mock tests', 'BJC మోడల్ పేపర్లు & మాక్ టెస్టులు', 'BJC मॉडल पेपर और मॉक टेस्ट', { app: '/app/tests' }),
      tp('lab_manuals', 'Lab manuals (Physics, Chemistry, Botany, Zoology)', 'ల్యాబ్ మాన్యువల్స్ (ఫిజిక్స్, కెమిస్ట్రీ, బోటనీ, జువాలజీ)', 'प्रयोगशाला पुस्तिकाएँ (भौतिकी, रसायन, वनस्पति, जंतु)'),
      tp('homework', 'Homework & DPP rules', 'హోంవర్క్ & DPP నియమాలు', 'होमवर्क और DPP नियम', { app: '/app/homework' }),
      tp('practicals', 'Inter practical records & projects', 'ఇంటర్ ప్రాక్టికల్ రికార్డులు & ప్రాజెక్టులు', 'इंटर प्रैक्टिकल रिकॉर्ड और प्रोजेक्ट'),
      tp('attendance_policy', 'Attendance & leave rules', 'హాజరు & సెలవు నియమాలు', 'उपस्थिति और अवकाश नियम', { app: '/app/attendance' }),
      tp('exam_process', 'Internal tests & board exam process', 'అంతర్గత పరీక్షలు & బోర్డు పరీక్ష విధానం', 'आंतरिक परीक्षा और बोर्ड परीक्षा प्रक्रिया'),
      tp('revaluation', 'Recounting, re-verification & Advanced Supplementary', 'రీకౌంటింగ్, రీ-వెరిఫికేషన్ & అడ్వాన్స్‌డ్ సప్లిమెంటరీ', 'पुनर्गणना, पुनः सत्यापन और एडवांस्ड सप्लीमेंट्री', { note: 'TSBIE recounting / re-verification, Advanced Supplementary Exams' }),
      tp('scholarships', 'Scholarships (BSAT & government)', 'స్కాలర్‌షిప్‌లు (BSAT & ప్రభుత్వ)', 'छात्रवृत्ति (BSAT और सरकारी)', { site: '/scholarship' }),
      tp('grievances', 'Raise a grievance', 'ఫిర్యాదు నమోదు', 'शिकायत दर्ज करें', { app: '/app/knowledge?grievance=1' }),
      tp('welfare', 'Counselling, wellbeing, health & hostel care', 'కౌన్సెలింగ్, శ్రేయస్సు, ఆరోగ్యం & హాస్టల్ సంరక్షణ', 'परामर्श, कल्याण, स्वास्थ्य और छात्रावास देखभाल', { app: '/app/wellbeing' }),
      tp('career', 'Career guidance', 'కెరీర్ మార్గదర్శనం', 'करियर मार्गदर्शन'),
      tp('higher_studies', 'JoSAA, NEET (MCC/state) & EAPCET counselling', 'JoSAA, NEET (MCC/రాష్ట్ర) & EAPCET కౌన్సెలింగ్', 'JoSAA, NEET (MCC/राज्य) और EAPCET काउंसलिंग'),
    ],
  },
  {
    id: 'student360', section: 4, kind: 'content', icon: '🧭', open: ['student', 'faculty', 'subject_head', 'principal', 'management', 'admin', 'accounts'], defaultAccess: 'faculty',
    name: { en: 'Student 360° Centre', te: 'విద్యార్థి 360° కేంద్రం', hi: 'छात्र 360° केंद्र' },
    intro: 'Live per-student view from the existing modules: profile, attendance, test scores, board results, readiness and AI recommendations.',
    topics: [
      tp('profile', 'Profile & academic history (SSC, school)', 'ప్రొఫైల్ & విద్యా చరిత్ర (SSC, పాఠశాల)', 'प्रोफ़ाइल और शैक्षणिक इतिहास (SSC, स्कूल)', { crm: '/crm/students' }),
      tp('attendance', 'Attendance', 'హాజరు', 'उपस्थिति', { app: '/app/attendance' }),
      tp('tests', 'Weekly & mock test scores', 'వారపు & మాక్ టెస్ట్ మార్కులు', 'साप्ताहिक और मॉक टेस्ट अंक', { app: '/app/results' }),
      tp('board', 'Inter 1st / 2nd year board results', 'ఇంటర్ 1వ / 2వ సంవత్సరం బోర్డు ఫలితాలు', 'इंटर प्रथम / द्वितीय वर्ष बोर्ड परिणाम', { app: '/app/report-card' }),
      tp('improvement', 'Subjects needing improvement / supplementary', 'మెరుగుపడాల్సిన / సప్లిమెంటరీ సబ్జెక్టులు', 'सुधार / पूरक परीक्षा वाले विषय', { note: 'Replaces "backlogs"' }),
      tp('assignments', 'Assignment tracking', 'అసైన్‌మెంట్ ట్రాకింగ్', 'असाइनमेंट ट्रैकिंग', { app: '/app/homework' }),
      tp('olympiads', 'Workshops & olympiads attended', 'వర్క్‌షాప్‌లు & ఒలింపియాడ్‌లు', 'कार्यशालाएँ और ओलंपियाड', { note: 'Replaces "internships"' }),
      tp('achievements', 'Certifications & achievements', 'సర్టిఫికెట్లు & విజయాలు', 'प्रमाणपत्र और उपलब्धियाँ', { app: '/app/sports' }),
      tp('fees', 'Fee status', 'ఫీజు స్థితి', 'फ़ीस स्थिति', { app: '/app/fees' }),
      tp('readiness', 'JEE/NEET readiness (mock rank trend)', 'JEE/NEET సన్నద్ధత (మాక్ ర్యాంక్ ధోరణి)', 'JEE/NEET तैयारी (मॉक रैंक रुझान)', { note: 'Replaces "placement preparation"' }),
      tp('mentor', 'Mentor & progress', 'మెంటర్ & పురోగతి', 'मेंटर और प्रगति', { crm: '/crm/mentor' }),
      tp('ai_reco', 'AI improvement recommendations', 'AI మెరుగుదల సూచనలు', 'AI सुधार सुझाव'),
    ],
  },
  {
    id: 'parent', section: 5, kind: 'content', icon: '👪', open: ['parent', ...STAFF], defaultAccess: 'parent', publicGroup: 'campus',
    name: { en: 'Parent Knowledge Centre', te: 'తల్లిదండ్రుల సమాచార కేంద్రం', hi: 'अभिभावक ज्ञान केंद्र' },
    intro: 'Parent handbook plus live updates for your own child only: attendance, progress, exams, fees, PTMs and teacher messages.',
    topics: [
      tp('handbook', 'Parent handbook', 'తల్లిదండ్రుల హ్యాండ్‌బుక్', 'अभिभावक पुस्तिका'),
      tp('attendance', 'Attendance updates', 'హాజరు సమాచారం', 'उपस्थिति अपडेट', { app: '/app/attendance' }),
      tp('progress', 'Academic performance & progress reports', 'విద్యా ప్రగతి నివేదికలు', 'शैक्षणिक प्रदर्शन और प्रगति रिपोर्ट', { app: '/app/results' }),
      tp('exams', 'Exam dates & hall tickets', 'పరీక్ష తేదీలు & హాల్ టికెట్లు', 'परीक्षा तिथियाँ और हॉल टिकट', { app: '/app/tests' }),
      tp('fees', 'Fee notifications', 'ఫీజు సమాచారం', 'फ़ीस सूचनाएँ', { app: '/app/fees' }),
      tp('announcements', 'College announcements', 'కాలేజీ ప్రకటనలు', 'कॉलेज घोषणाएँ', { app: '/app/notices' }),
      tp('ptm', 'Book a PTM slot', 'PTM స్లాట్ బుక్ చేయండి', 'PTM स्लॉट बुक करें', { app: '/app/ptm' }),
      tp('teacher', 'Message the teacher', 'టీచర్‌కు సందేశం', 'शिक्षक को संदेश', { app: '/app/messages' }),
      tp('grievance', 'Grievance support', 'ఫిర్యాదు సహాయం', 'शिकायत सहायता', { app: '/app/knowledge?grievance=1' }),
      tp('emergency', 'Emergency contacts per campus', 'క్యాంపస్ వారీ అత్యవసర సంప్రదింపులు', 'कैंपस-वार आपातकालीन संपर्क', { note: 'warden, security, doctor' }),
      tp('counselling_guide', 'Parent Counselling Guide', 'తల్లిదండ్రుల కౌన్సెలింగ్ గైడ్', 'अभिभावक परामर्श मार्गदर्शिका', { site: '/parent-counselling' }),
    ],
  },
  {
    id: 'faculty', section: 6, kind: 'content', icon: '🧑‍🏫', open: ['faculty', 'subject_head', 'principal', 'management', 'admin'], defaultAccess: 'faculty',
    name: { en: 'Faculty Knowledge Centre', te: 'అధ్యాపక సమాచార కేంద్రం', hi: 'शिक्षक ज्ञान केंद्र' },
    intro: 'Faculty handbook, allocations, lesson plans, syllabus completion, leave, exam duties, mentoring and training.',
    topics: [
      tp('handbook', 'Faculty handbook', 'అధ్యాపక హ్యాండ్‌బుక్', 'शिक्षक पुस्तिका'),
      tp('profiles', 'Faculty profiles & qualifications (16 Power Houses)', 'అధ్యాపకుల ప్రొఫైళ్లు (16 పవర్ హౌసెస్)', 'शिक्षक प्रोफ़ाइल (16 पावर हाउस)', { site: '/faculty', crm: '/crm/staff-directory' }),
      tp('allocation', 'Subject & class allocation', 'సబ్జెక్టు & తరగతి కేటాయింపు', 'विषय और कक्षा आवंटन', { crm: '/crm/academics/my-classes' }),
      tp('lesson_plans', 'Teaching & lesson plans', 'బోధన & పాఠ్య ప్రణాళికలు', 'शिक्षण और पाठ योजनाएँ', { crm: '/crm/syllabus' }),
      tp('syllabus', 'Syllabus completion', 'సిలబస్ పూర్తి', 'पाठ्यक्रम पूर्णता', { crm: '/crm/syllabus' }),
      tp('attendance', 'Faculty attendance', 'అధ్యాపకుల హాజరు', 'शिक्षक उपस्थिति', { crm: '/crm/my-attendance' }),
      tp('leave', 'Leave policies', 'సెలవు విధానాలు', 'अवकाश नीतियाँ', { crm: '/crm/leave' }),
      tp('exam_duties', 'Exam duties (invigilation)', 'పరీక్ష విధులు (ఇన్విజిలేషన్)', 'परीक्षा ड्यूटी (निरीक्षण)'),
      tp('assessment', 'Internal assessment guidelines', 'అంతర్గత మూల్యాంకన మార్గదర్శకాలు', 'आंतरिक मूल्यांकन दिशानिर्देश'),
      tp('mentoring', 'Student mentoring', 'విద్యార్థి మెంటరింగ్', 'छात्र मेंटरिंग', { crm: '/crm/mentor' }),
      tp('resources', 'Teaching resources & question banks created', 'బోధనా వనరులు & ప్రశ్న బ్యాంకులు', 'शिक्षण संसाधन और प्रश्न बैंक', { note: 'Replaces "research & publications"' }),
      tp('fdp', 'Faculty development & training', 'అధ్యాపక అభివృద్ధి & శిక్షణ', 'शिक्षक विकास और प्रशिक्षण'),
      tp('performance', 'Performance documentation (private)', 'పనితీరు పత్రాలు (గోప్యం)', 'प्रदर्शन दस्तावेज़ (निजी)', { note: 'Restricted: faculty member, Principal, Management' }),
    ],
  },
  {
    id: 'departments', section: 7, kind: 'content', icon: '🔬', open: ['faculty', 'subject_head', 'principal', 'management'], defaultAccess: 'faculty',
    name: { en: 'Subject Department Centre', te: 'సబ్జెక్టు విభాగ కేంద్రం', hi: 'विषय विभाग केंद्र' },
    intro: 'Mathematics, Physics, Chemistry and Biology (Botany & Zoology), each with a Subject Head.',
    topics: [
      tp('profile', 'Department profile, vision & mission', 'విభాగ ప్రొఫైల్, విజన్ & మిషన్', 'विभाग प्रोफ़ाइल, विज़न और मिशन'),
      tp('directory', 'Faculty & students by batch', 'బ్యాచ్ వారీ అధ్యాపకులు & విద్యార్థులు', 'बैच-वार शिक्षक और छात्र', { crm: '/crm/academics' }),
      tp('timetable', 'Allocation, timetable & workload', 'కేటాయింపు, టైమ్‌టేబుల్ & పని భారం', 'आवंटन, समय-सारणी और कार्यभार', { crm: '/crm/academics' }),
      tp('performance', 'Subject-wise attendance & performance', 'సబ్జెక్టు వారీ హాజరు & ప్రగతి', 'विषय-वार उपस्थिति और प्रदर्शन', { crm: '/crm/academics/overview' }),
      tp('exam_analysis', 'Question-wise & chapter-wise exam analysis', 'ప్రశ్న & అధ్యాయం వారీ పరీక్ష విశ్లేషణ', 'प्रश्न व अध्याय-वार परीक्षा विश्लेषण', { crm: '/crm/academics/overview' }),
      tp('lab', 'Lab equipment, condition & purchase requests', 'ల్యాబ్ పరికరాలు, స్థితి & కొనుగోలు అభ్యర్థనలు', 'प्रयोगशाला उपकरण, स्थिति और खरीद अनुरोध'),
      tp('olympiad', 'Olympiad/NTSE coaching, science projects, workshops', 'ఒలింపియాడ్/NTSE కోచింగ్, సైన్స్ ప్రాజెక్టులు', 'ओलंपियाड/NTSE कोचिंग, विज्ञान परियोजनाएँ', { note: 'Replaces "research, projects, internships"' }),
      tp('meetings', 'Department meetings (minutes)', 'విభాగ సమావేశాలు (మినిట్స్)', 'विभाग बैठकें (कार्यवृत्त)'),
      tp('budget', 'Department expense requests', 'విభాగ ఖర్చు అభ్యర్థనలు', 'विभाग व्यय अनुरोध'),
      tp('inspection', 'TSBIE practical inspection records', 'TSBIE ప్రాక్టికల్ తనిఖీ రికార్డులు', 'TSBIE प्रैक्टिकल निरीक्षण रिकॉर्ड', { note: 'Replaces "accreditation" (not applicable)' }),
      tp('monthly', 'Monthly subject performance report', 'నెలవారీ సబ్జెక్టు ప్రగతి నివేదిక', 'मासिक विषय प्रदर्शन रिपोर्ट'),
    ],
  },
  {
    id: 'principal', section: 8, kind: 'content', icon: '🏛️', open: ['principal', 'management'], defaultAccess: 'principal',
    name: { en: 'Principal Knowledge Centre', te: 'ప్రిన్సిపాల్ సమాచార కేంద్రం', hi: 'प्रधानाचार्य ज्ञान केंद्र' },
    intro: 'College overview, academic and department monitoring, admissions, results, grievances, staff and one approvals inbox.',
    topics: [
      tp('overview', 'College overview', 'కాలేజీ అవలోకనం', 'कॉलेज अवलोकन', { crm: '/crm/summary' }),
      tp('academic', 'Academic & department monitoring', 'అకడమిక్ & విభాగ పర్యవేక్షణ', 'शैक्षणिक और विभाग निगरानी', { crm: '/crm/academics/overview' }),
      tp('attendance', 'Student, faculty & attendance monitoring', 'విద్యార్థి, అధ్యాపక & హాజరు పర్యవేక్షణ', 'छात्र, शिक्षक और उपस्थिति निगरानी', { crm: '/crm/staff-attendance' }),
      tp('admissions', 'Admission statistics', 'అడ్మిషన్ గణాంకాలు', 'प्रवेश आँकड़े', { crm: '/crm/dashboard' }),
      tp('results', 'Exam results', 'పరీక్ష ఫలితాలు', 'परीक्षा परिणाम', { crm: '/crm/academics/overview' }),
      tp('jee_neet', 'JEE/NEET results & college admissions achieved', 'JEE/NEET ఫలితాలు & సాధించిన కాలేజీ సీట్లు', 'JEE/NEET परिणाम और प्राप्त कॉलेज प्रवेश', { note: 'Replaces "placement performance"' }),
      tp('finance', 'Financial overview (summary)', 'ఆర్థిక అవలోకనం (సారాంశం)', 'वित्तीय अवलोकन (सारांश)', { crm: '/crm/summary' }),
      tp('grievances', 'Student grievances', 'విద్యార్థి ఫిర్యాదులు', 'छात्र शिकायतें', { crm: '/crm/knowledge/grievances' }),
      tp('staff', 'Staff management', 'సిబ్బంది నిర్వహణ', 'स्टाफ़ प्रबंधन', { crm: '/crm/staff-directory' }),
      tp('approvals', 'Pending approvals inbox', 'పెండింగ్ ఆమోదాలు', 'लंबित स्वीकृतियाँ', { crm: '/crm/knowledge/approvals' }),
      tp('reports', 'Institutional reports', 'సంస్థాగత నివేదికలు', 'संस्थागत रिपोर्ट', { crm: '/crm/knowledge/reports' }),
      tp('plans', 'College development plans', 'కాలేజీ అభివృద్ధి ప్రణాళికలు', 'कॉलेज विकास योजनाएँ'),
    ],
  },
  {
    id: 'management', section: 9, kind: 'content', icon: '📈', open: ['management'], defaultAccess: 'management',
    name: { en: 'Management Intelligence Centre', te: 'యాజమాన్య ఇంటెలిజెన్స్ కేంద్రం', hi: 'प्रबंधन इंटेलिजेंस केंद्र' },
    intro: 'Institutional dashboard, strength by program/batch/campus, campus comparison, admissions funnel, finance, results and growth.',
    topics: [
      tp('dashboard', 'Institutional dashboard', 'సంస్థాగత డ్యాష్‌బోర్డ్', 'संस्थागत डैशबोर्ड', { crm: '/crm/summary' }),
      tp('strength', 'Student strength by program, batch & campus', 'ప్రోగ్రామ్, బ్యాచ్ & క్యాంపస్ వారీ విద్యార్థుల సంఖ్య', 'प्रोग्राम, बैच और कैंपस-वार छात्र संख्या'),
      tp('campus', 'Campus comparison (Bairamalguda / Kuntloor / LB Nagar)', 'క్యాంపస్ పోలిక (బైరామల్‌గూడ / కుంట్లూర్ / LB నగర్)', 'कैंपस तुलना (बैरामलगुडा / कुंटलूर / LB नगर)', { note: 'Replaces "department comparison"' }),
      tp('faculty', 'Faculty analytics', 'అధ్యాపక విశ్లేషణ', 'शिक्षक विश्लेषण', { crm: '/crm/staff-attendance' }),
      tp('admissions', 'Admission funnel, sources & cost per lead', 'అడ్మిషన్ ఫన్నెల్, మూలాలు & ఒక్కో లీడ్ ఖర్చు', 'प्रवेश फ़नल, स्रोत और प्रति लीड लागत', { crm: '/crm/dashboard' }),
      tp('finance', 'Fee collection, budget & expenditure', 'ఫీజు వసూలు, బడ్జెట్ & ఖర్చు', 'फ़ीस संग्रह, बजट और व्यय', { crm: '/crm/accounts' }),
      tp('results', 'Results analytics', 'ఫలితాల విశ్లేషణ', 'परिणाम विश्लेषण', { note: 'Replaces "placement analytics"' }),
      tp('infrastructure', 'Infrastructure management', 'మౌలిక సదుపాయాల నిర్వహణ', 'बुनियादी ढाँचा प्रबंधन'),
      tp('growth', 'Growth reports (year on year)', 'వృద్ధి నివేదికలు (సంవత్సరం వారీ)', 'वृद्धि रिपोर्ट (वर्ष-दर-वर्ष)'),
      tp('meetings', 'Management meeting records', 'యాజమాన్య సమావేశ రికార్డులు', 'प्रबंधन बैठक रिकॉर्ड'),
      tp('strategy', 'Strategic plans & decision-support reports', 'వ్యూహాత్మక ప్రణాళికలు & నిర్ణయ నివేదికలు', 'रणनीतिक योजनाएँ और निर्णय-सहायक रिपोर्ट'),
      tp('briefing', 'Daily briefing (7 PM)', 'రోజువారీ బ్రీఫింగ్ (రాత్రి 7)', 'दैनिक ब्रीफ़िंग (शाम 7 बजे)', { crm: '/crm/knowledge/briefing' }),
    ],
  },
  {
    id: 'admission', section: 10, kind: 'content', icon: '📝', open: ['public', 'student', 'parent', ...STAFF], defaultAccess: 'public', publicGroup: 'admissions',
    name: { en: 'Admission Knowledge Centre', te: 'అడ్మిషన్ సమాచార కేంద్రం', hi: 'प्रवेश ज्ञान केंद्र' },
    intro: 'Guidelines, eligibility, procedure, documents, fees and BSAT, counselling schedules, status tracking and admission FAQs.',
    topics: [
      tp('guidelines', 'Admission guidelines & courses', 'అడ్మిషన్ మార్గదర్శకాలు & కోర్సులు', 'प्रवेश दिशानिर्देश और कोर्स', { site: '/admissions' }),
      tp('eligibility', 'Eligibility (Class 10 / Class 12 passed)', 'అర్హత (10వ / 12వ తరగతి ఉత్తీర్ణత)', 'पात्रता (कक्षा 10 / 12 उत्तीर्ण)', { site: '/programs' }),
      tp('procedure', 'Procedure & application forms', 'విధానం & దరఖాస్తు ఫారాలు', 'प्रक्रिया और आवेदन पत्र', { app: '/app/apply' }),
      tp('documents', 'Required documents', 'అవసరమైన పత్రాలు', 'आवश्यक दस्तावेज़', { app: '/app/documents' }),
      tp('fees', 'Fee structure & BSAT scholarships', 'ఫీజు వివరాలు & BSAT స్కాలర్‌షిప్‌లు', 'फ़ीस संरचना और BSAT छात्रवृत्ति', { site: '/fees' }),
      tp('counselling', 'Counselling schedules & 10-step guide', 'కౌన్సెలింగ్ షెడ్యూల్ & 10-దశల గైడ్', 'काउंसलिंग कार्यक्रम और 10-चरण गाइड', { site: '/parent-counselling' }),
      tp('track', 'Track my admission', 'నా అడ్మిషన్ ట్రాక్ చేయండి', 'मेरा प्रवेश ट्रैक करें', { site: '/track' }),
      tp('orientation', 'New-student orientation', 'కొత్త విద్యార్థుల ఓరియెంటేషన్', 'नए छात्रों का ओरिएंटेशन'),
      tp('faqs', 'Admission FAQs (what parents care about)', 'అడ్మిషన్ FAQలు (తల్లిదండ్రుల ప్రశ్నలు)', 'प्रवेश FAQ (अभिभावकों के प्रश्न)'),
    ],
  },
  {
    id: 'career', section: 11, kind: 'content', icon: '🎓', open: ['public', 'student', 'parent', ...STAFF], defaultAccess: 'public', publicGroup: 'career',
    name: { en: 'Career & Higher Education Centre', te: 'కెరీర్ & ఉన్నత విద్య కేంద్రం', hi: 'करियर और उच्च शिक्षा केंद्र' },
    intro: 'College profiles (IIT, NIT, IIIT, AIIMS, state colleges), exam eligibility, JEE/NEET strategy, counselling process and results statistics.',
    topics: [
      tp('colleges', 'College profiles, cut-offs & seats', 'కాలేజీ ప్రొఫైళ్లు, కటాఫ్‌లు & సీట్లు', 'कॉलेज प्रोफ़ाइल, कट-ऑफ़ और सीटें', { note: 'Replaces company profiles, drives and job descriptions' }),
      tp('eligibility', 'Exam eligibility (JEE Main/Advanced, NEET, EAPCET)', 'పరీక్ష అర్హత (JEE మెయిన్/అడ్వాన్స్‌డ్, NEET, EAPCET)', 'परीक्षा पात्रता (JEE मेन/एडवांस्ड, NEET, EAPCET)'),
      tp('strategy', 'JEE/NEET strategy, time management & mock analysis', 'JEE/NEET వ్యూహం, సమయ నిర్వహణ & మాక్ విశ్లేషణ', 'JEE/NEET रणनीति, समय प्रबंधन और मॉक विश्लेषण', { note: 'Replaces "aptitude preparation"' }),
      tp('coding', 'Intro to coding / olympiad prep (optional)', 'కోడింగ్ పరిచయం / ఒలింపియాడ్ (ఐచ్ఛికం)', 'कोडिंग परिचय / ओलंपियाड (वैकल्पिक)'),
      tp('counselling', 'Counselling process (JoSAA/MCC choice filling, document verification)', 'కౌన్సెలింగ్ ప్రక్రియ (JoSAA/MCC ఆప్షన్లు, పత్రాల పరిశీలన)', 'काउंसलिंग प्रक्रिया (JoSAA/MCC विकल्प, दस्तावेज़ सत्यापन)', { note: 'Replaces interview prep / mock interviews' }),
      tp('documents', 'Scholarship & application documents', 'స్కాలర్‌షిప్ & దరఖాస్తు పత్రాలు', 'छात्रवृत्ति और आवेदन दस्तावेज़', { note: 'Replaces "resume preparation"' }),
      tp('certifications', 'Olympiads, NTSE & national exams', 'ఒలింపియాడ్‌లు, NTSE & జాతీయ పరీక్షలు', 'ओलंपियाड, NTSE और राष्ट्रीय परीक्षाएँ', { note: 'Replaces "industry certifications"' }),
      tp('alumni', 'Alumni career information', 'పూర్వ విద్యార్థుల కెరీర్ సమాచారం', 'पूर्व छात्र करियर जानकारी', { crm: '/crm/alumni' }),
      tp('statistics', 'Results statistics (selections by exam & year)', 'ఫలితాల గణాంకాలు (పరీక్ష & సంవత్సరం వారీ)', 'परिणाम आँकड़े (परीक्षा और वर्ष-वार)', { site: '/results', note: 'Replaces "placement statistics"' }),
    ],
  },
  {
    id: 'library', section: 12, kind: 'content', icon: '📖', open: ['student', 'parent', ...STAFF], defaultAccess: 'student',
    name: { en: 'Library & Digital Learning Centre', te: 'గ్రంథాలయం & డిజిటల్ లెర్నింగ్ కేంద్రం', hi: 'पुस्तकालय और डिजिटल लर्निंग केंद्र' },
    intro: 'Library handbook, catalogue and availability, digital library, membership, issue/return and fines, videos and DPPs.',
    topics: [
      tp('handbook', 'Library handbook & membership', 'గ్రంథాలయ హ్యాండ్‌బుక్ & సభ్యత్వం', 'पुस्तकालय पुस्तिका और सदस्यता'),
      tp('catalogue', 'Book catalogue, authors & availability', 'పుస్తకాల జాబితా, రచయితలు & లభ్యత', 'पुस्तक सूची, लेखक और उपलब्धता', { crm: '/crm/library' }),
      tp('digital', 'Digital library: e-books, journals, papers', 'డిజిటల్ గ్రంథాలయం: ఈ-బుక్స్, జర్నల్స్', 'डिजिटल पुस्तकालय: ई-बुक्स, जर्नल'),
      tp('loans', 'Issue, return & fines', 'ఇష్యూ, రిటర్న్ & జరిమానాలు', 'जारी, वापसी और जुर्माना', { crm: '/crm/library' }),
      tp('resources', 'Learning resources (videos, DPPs)', 'అభ్యాస వనరులు (వీడియోలు, DPPలు)', 'अध्ययन संसाधन (वीडियो, DPP)', { app: '/app/study' }),
    ],
  },
  {
    id: 'admin_ops', section: 13, kind: 'content', icon: '🏢', open: ['admin', 'accounts', 'principal', 'management'], defaultAccess: 'admin',
    name: { en: 'Administration & Operations Centre', te: 'పరిపాలన & కార్యకలాపాల కేంద్రం', hi: 'प्रशासन और संचालन केंद्र' },
    intro: 'Admin and HR policies, recruitment and payroll (Accounts/Admin only), purchases, assets, hostel, transport, security and emergency procedures.',
    topics: [
      tp('handbook', 'Admin handbook, HR policies & employee handbook', 'అడ్మిన్ హ్యాండ్‌బుక్, HR విధానాలు', 'प्रशासन पुस्तिका, HR नीतियाँ'),
      tp('hr', 'Recruitment, onboarding, leave & payroll documents', 'నియామకం, ఆన్‌బోర్డింగ్, సెలవు & జీతాల పత్రాలు', 'भर्ती, ऑनबोर्डिंग, अवकाश और वेतन दस्तावेज़', { note: 'Accounts/Admin only' }),
      tp('purchases', 'Purchase requests, inventory & assets', 'కొనుగోలు అభ్యర్థనలు, ఇన్వెంటరీ & ఆస్తులు', 'खरीद अनुरोध, इन्वेंटरी और संपत्ति'),
      tp('maintenance', 'Maintenance requests', 'మరమ్మతు అభ్యర్థనలు', 'रखरखाव अनुरोध'),
      tp('hostel', 'Hostel administration (Kuntloor, Bairamalguda)', 'హాస్టల్ నిర్వహణ (కుంట్లూర్, బైరామల్‌గూడ)', 'छात्रावास प्रशासन (कुंटलूर, बैरामलगुडा)', { crm: '/crm/hostel' }),
      tp('transport', 'Transport', 'రవాణా', 'परिवहन', { crm: '/crm/transport' }),
      tp('security', 'Security procedures', 'భద్రతా విధానాలు', 'सुरक्षा प्रक्रियाएँ'),
      tp('emergency', 'Emergency procedures (fire, medical, missing student) per campus', 'అత్యవసర విధానాలు (అగ్ని, వైద్య, తప్పిపోయిన విద్యార్థి)', 'आपातकालीन प्रक्रियाएँ (आग, चिकित्सा, लापता छात्र)'),
      tp('vendors', 'Vendors', 'విక్రేతలు', 'विक्रेता'),
      tp('office', 'Approvals & office procedures', 'ఆమోదాలు & కార్యాలయ విధానాలు', 'स्वीकृतियाँ और कार्यालय प्रक्रियाएँ'),
    ],
  },
  {
    id: 'compliance', section: 14, kind: 'content', icon: '✅', open: ['principal', 'management', 'admin'], defaultAccess: 'principal',
    name: { en: 'Recognition & Compliance Centre', te: 'గుర్తింపు & నిబంధనల కేంద్రం', hi: 'मान्यता और अनुपालन केंद्र' },
    intro: 'TSBIE recognition (College Code 58560), affiliation renewals, board circulars, inspections, licences/NOCs with expiry, audits and DPDP records.',
    topics: [
      tp('tsbie', 'TSBIE recognition (College Code 58560) & affiliation renewals', 'TSBIE గుర్తింపు (కాలేజీ కోడ్ 58560) & అనుబంధ పునరుద్ధరణ', 'TSBIE मान्यता (कॉलेज कोड 58560) और संबद्धता नवीनीकरण', { note: 'Replaces NAAC, NBA, AICTE, UGC (not applicable to a junior college)' }),
      tp('circulars', 'TS Intermediate Board circulars', 'TS ఇంటర్మీడియట్ బోర్డు సర్క్యులర్లు', 'TS इंटरमीडिएट बोर्ड परिपत्र'),
      tp('quality', 'Internal quality reviews (academic audits)', 'అంతర్గత నాణ్యత సమీక్షలు (అకడమిక్ ఆడిట్)', 'आंतरिक गुणवत्ता समीक्षा (शैक्षणिक ऑडिट)', { note: 'Replaces IQAC' }),
      tp('inspection', 'Board inspection checklists', 'బోర్డు తనిఖీ చెక్‌లిస్టులు', 'बोर्ड निरीक्षण चेकलिस्ट'),
      tp('faculty_records', 'Faculty qualification records (restricted)', 'అధ్యాపక అర్హత రికార్డులు (పరిమితం)', 'शिक्षक योग्यता रिकॉर्ड (प्रतिबंधित)'),
      tp('achievements', 'Student achievements, olympiad records & results evidence', 'విద్యార్థి విజయాలు, ఒలింపియాడ్ రికార్డులు & ఫలితాల ఆధారాలు', 'छात्र उपलब्धियाँ, ओलंपियाड रिकॉर्ड और परिणाम प्रमाण', { note: 'Replaces research publications, patents, funded projects' }),
      tp('licences', 'Building, fire, health & hostel licences / NOCs (expiry & renewal)', 'భవన, అగ్నిమాపక, ఆరోగ్య & హాస్టల్ లైసెన్సులు / NOCలు', 'भवन, अग्नि, स्वास्थ्य और छात्रावास लाइसेंस / NOC'),
      tp('audits', 'Audit, annual & improvement reports', 'ఆడిట్, వార్షిక & మెరుగుదల నివేదికలు', 'ऑडिट, वार्षिक और सुधार रिपोर्ट'),
      tp('dpdp', 'DPDP Act 2023 records, safety audits & CCTV policy', 'DPDP చట్టం 2023 రికార్డులు, భద్రతా ఆడిట్ & CCTV విధానం', 'DPDP अधिनियम 2023 रिकॉर्ड, सुरक्षा ऑडिट और CCTV नीति'),
    ],
  },
  {
    id: 'exams', section: 15, kind: 'content', icon: '🧪', open: ['public', 'student', 'parent', ...STAFF], defaultAccess: 'student', publicGroup: 'exams',
    name: { en: 'Examination Knowledge Centre', te: 'పరీక్షల సమాచార కేంద్రం', hi: 'परीक्षा ज्ञान केंद्र' },
    intro: 'Regulations, timetables, internal and external exams (TS Inter, JEE, NEET), hall tickets, registration, results, revaluation and malpractice rules.',
    topics: [
      tp('regulations', 'Exam regulations & malpractice rules', 'పరీక్ష నియమాలు & మాల్‌ప్రాక్టీస్ నిబంధనలు', 'परीक्षा नियम और कदाचार नियम'),
      tp('timetables', 'Timetables & notifications', 'టైమ్‌టేబుల్స్ & ప్రకటనలు', 'समय-सारणी और सूचनाएँ', { app: '/app/tests' }),
      tp('internal', 'Internal exams (weekly, mock)', 'అంతర్గత పరీక్షలు (వారపు, మాక్)', 'आंतरिक परीक्षाएँ (साप्ताहिक, मॉक)', { crm: '/crm/academics', app: '/app/tests' }),
      tp('external', 'External exams (TS Inter board, JEE, NEET)', 'బాహ్య పరీక్షలు (TS ఇంటర్ బోర్డు, JEE, NEET)', 'बाहरी परीक्षाएँ (TS इंटर बोर्ड, JEE, NEET)'),
      tp('hall_tickets', 'Hall-ticket guidelines', 'హాల్ టికెట్ మార్గదర్శకాలు', 'हॉल टिकट दिशानिर्देश'),
      tp('registration', 'Registration (board fees, JEE/NEET applications)', 'రిజిస్ట్రేషన్ (బోర్డు ఫీజు, JEE/NEET దరఖాస్తులు)', 'पंजीकरण (बोर्ड फ़ीस, JEE/NEET आवेदन)'),
      tp('results', 'Results', 'ఫలితాలు', 'परिणाम', { app: '/app/results', site: '/results' }),
      tp('revaluation', 'Revaluation / re-verification & supplementary', 'రీవాల్యుయేషన్ / రీ-వెరిఫికేషన్ & సప్లిమెంటరీ', 'पुनर्मूल्यांकन / पुनः सत्यापन और पूरक'),
      tp('faqs', 'Exam FAQs', 'పరీక్ష FAQలు', 'परीक्षा FAQ'),
    ],
  },
  {
    id: 'events', section: 16, kind: 'content', icon: '🎉', open: ['public', 'student', 'parent', ...STAFF], defaultAccess: 'public', publicGroup: 'events',
    name: { en: 'Events & Student Activities Centre', te: 'కార్యక్రమాలు & విద్యార్థి కార్యకలాపాల కేంద్రం', hi: 'कार्यक्रम और छात्र गतिविधि केंद्र' },
    intro: 'College events, science fair / talent day, cultural fests, workshops and speaker sessions, quiz and olympiad contests, sports, clubs and social service.',
    topics: [
      tp('calendar', 'College events', 'కాలేజీ కార్యక్రమాలు', 'कॉलेज कार्यक्रम', { crm: '/crm/events', app: '/app/events' }),
      tp('science_fair', 'Science fair / Talent day', 'సైన్స్ ఫెయిర్ / టాలెంట్ డే', 'विज्ञान मेला / टैलेंट डे', { note: 'Replaces technical fests' }),
      tp('cultural', 'Cultural fests', 'సాంస్కృతిక ఉత్సవాలు', 'सांस्कृतिक उत्सव'),
      tp('sessions', 'Workshops, seminars & motivational speakers', 'వర్క్‌షాప్‌లు, సెమినార్లు & ప్రేరణ ప్రసంగాలు', 'कार्यशालाएँ, सेमिनार और प्रेरक वक्ता', { crm: '/crm/sessions', app: '/app/sessions' }),
      tp('quiz', 'Quiz & olympiad contests', 'క్విజ్ & ఒలింపియాడ్ పోటీలు', 'क्विज़ और ओलंपियाड प्रतियोगिताएँ', { note: 'Replaces hackathons/conferences' }),
      tp('sports', 'Sports', 'క్రీడలు', 'खेल', { crm: '/crm/sports', app: '/app/sports' }),
      tp('clubs', 'Clubs', 'క్లబ్‌లు', 'क्लब'),
      tp('social', 'Social service activities', 'సామాజిక సేవా కార్యక్రమాలు', 'सामाजिक सेवा गतिविधियाँ', { note: 'NSS is not applicable at junior college level' }),
      tp('awards', 'Achievements, awards & gallery', 'విజయాలు, అవార్డులు & గ్యాలరీ', 'उपलब्धियाँ, पुरस्कार और गैलरी', { site: '/campus' }),
    ],
  },
  {
    id: 'ai', section: 17, kind: 'system', icon: '🤖', open: ['public', 'student', 'parent', ...STAFF], defaultAccess: 'public',
    name: { en: 'AI Chatbot & Assistant Centre', te: 'AI చాట్‌బాట్ & సహాయక కేంద్రం', hi: 'AI चैटबॉट और सहायक केंद्र' },
    intro: 'One AI brain with role-aware assistants; answers only from what the asking user may see, always with sources and page numbers.',
    topics: [],
  },
  {
    id: 'advanced_ai', section: 18, kind: 'system', icon: '✨', open: ['principal', 'management', 'subject_head', 'admin'], defaultAccess: 'principal',
    name: { en: 'Advanced AI Intelligence', te: 'అధునాతన AI ఇంటెలిజెన్స్', hi: 'उन्नत AI इंटेलिजेंस' },
    intro: 'Daily briefing, early warning, one-click reports, knowledge audit, AI summaries/FAQs (approved by staff), duplicate and outdated detection.',
    topics: [],
  },
  {
    id: 'notifications', section: 19, kind: 'system', icon: '🔔', open: ['principal', 'management', 'admin'], defaultAccess: 'admin',
    name: { en: 'Notification & Automation Centre', te: 'నోటిఫికేషన్ & ఆటోమేషన్ కేంద్రం', hi: 'सूचना और स्वचालन केंद्र' },
    intro: 'Rules: trigger → audience → channel → template (3 languages) → schedule; message log with delivery status, quiet hours and opt-outs.',
    topics: [],
  },
  {
    id: 'security', section: 20, kind: 'system', icon: '🛡️', open: ['management'], defaultAccess: 'management',
    name: { en: 'Security & Knowledge Governance', te: 'భద్రత & సమాచార పాలన', hi: 'सुरक्षा और ज्ञान शासन' },
    intro: 'Role-based access, sensitivity labels, AI permission filter, PII masking, audit, watermarks, retention, owners and review dates.',
    topics: [],
  },
  {
    id: 'supabase', section: 21, kind: 'system', icon: '🧩', open: ['management'], defaultAccess: 'admin',
    name: { en: 'Supabase Integration Centre', te: 'సుపాబేస్ అనుసంధాన కేంద్రం', hi: 'सुपाबेस एकीकरण केंद्र' },
    intro: 'Health and control for database, RLS, storage, pgvector, functions, cron jobs, realtime, auth, queues and integrations. Super Admin / Developer only.',
    topics: [],
  },
  {
    id: 'analytics', section: 22, kind: 'system', icon: '📊', open: ['principal', 'management'], defaultAccess: 'principal',
    name: { en: 'Knowledge Analytics & Monitoring', te: 'సమాచార విశ్లేషణ & పర్యవేక్షణ', hi: 'ज्ञान विश्लेषण और निगरानी' },
    intro: 'Usage, search quality, AI quality, content health, contributors, performance and alerts, with exports.',
    topics: [],
  },
];

export const CONTENT_CENTRES = CENTRES.filter((c) => c.kind === 'content');
export const centreById = (id: string) => CENTRES.find((c) => c.id === id) ?? null;
export const CENTRE_IDS = CENTRES.map((c) => c.id) as [string, ...string[]];

/** Subject departments (§7). */
export const DEPARTMENTS = [
  { id: 'maths', name: { en: 'Mathematics', te: 'గణితం', hi: 'गणित' }, subjects: ['Mathematics', 'Maths'] },
  { id: 'physics', name: { en: 'Physics', te: 'భౌతిక శాస్త్రం', hi: 'भौतिकी' }, subjects: ['Physics'] },
  { id: 'chemistry', name: { en: 'Chemistry', te: 'రసాయన శాస్త్రం', hi: 'रसायन विज्ञान' }, subjects: ['Chemistry'] },
  { id: 'biology', name: { en: 'Biology (Botany & Zoology)', te: 'జీవశాస్త్రం (వృక్ష & జంతు)', hi: 'जीव विज्ञान (वनस्पति और जंतु)' }, subjects: ['Biology', 'Botany', 'Zoology'] },
] as const;
export type DepartmentId = (typeof DEPARTMENTS)[number]['id'];

/** The public /knowledge-base groups (§23). */
export const PUBLIC_GROUPS: { id: NonNullable<Centre['publicGroup']>; name: Record<Lang, string> }[] = [
  { id: 'admissions', name: { en: 'Admissions', te: 'అడ్మిషన్లు', hi: 'प्रवेश' } },
  { id: 'courses', name: { en: 'Courses & study', te: 'కోర్సులు & చదువు', hi: 'कोर्स और पढ़ाई' } },
  { id: 'campus', name: { en: 'Campus & parents', te: 'క్యాంపస్ & తల్లిదండ్రులు', hi: 'कैंपस और अभिभावक' } },
  { id: 'exams', name: { en: 'Exams', te: 'పరీక్షలు', hi: 'परीक्षाएँ' } },
  { id: 'career', name: { en: 'Career', te: 'కెరీర్', hi: 'करियर' } },
  { id: 'events', name: { en: 'Events', te: 'కార్యక్రమాలు', hi: 'कार्यक्रम' } },
];
