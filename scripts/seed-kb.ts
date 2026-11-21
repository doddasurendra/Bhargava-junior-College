/**
 * Knowledge Hub demo content (§23): 10–15 sample articles per centre (all marked sample, except facts the
 * website already states), the official 2027-28 brochure PDF as a real published document (text extracted
 * page by page, so the AI can cite "page N"), a few sample documents, categories, notification rules,
 * licences, lab inventory, a grievance and an unanswered question.
 *
 * Runs after seed-demo.ts (`npm run seed:demo`). Same safety rules: refuses NODE_ENV=production and refuses
 * when a Supabase service-role key is set (staging/preview only — use seed:supabase for a demo project).
 * Idempotent: every row id starts with `demo-kb-`; each run removes those rows first.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = process.env.DEMO_OUT ? path.resolve(process.env.DEMO_OUT) : path.join(ROOT, '.data', 'dev-db.json');
const FILES_DIR = path.join(ROOT, '.data', 'kb-files');
const clear = process.argv.includes('--clear');

function envLocal(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  const f = path.join(ROOT, '.env.local');
  if (!existsSync(f)) return '';
  const m = readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed: NODE_ENV=production.');
if (!process.env.DEMO_OUT && envLocal('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Refusing to seed: a Supabase service-role key is set (this seed only writes the local development store).');

type Any = Record<string, any>;
const db: Any = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8').replace(/^﻿/, '')) : {};
db.records ??= {};
for (const c of Object.keys(db.records)) db.records[c] = db.records[c].filter((r: Any) => !String(r.id).startsWith('demo-kb-'));
const save = () => {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(`${FILE}.kb.tmp`, JSON.stringify(db, null, 2));
  renameSync(`${FILE}.kb.tmp`, FILE);
};
// remove the previous demo document files too
if (existsSync(FILES_DIR)) for (const d of readdirSync(FILES_DIR)) if (d.startsWith('demo-kb-')) rmSync(path.join(FILES_DIR, d), { recursive: true, force: true });
if (clear) {
  save();
  console.log('Knowledge Hub demo rows cleared.');
  process.exit(0);
}

const NOW = new Date();
const iso = (daysAgo = 0) => new Date(NOW.getTime() - daysAgo * 86400_000).toISOString();
const day = (n: number) => new Date(NOW.getTime() + n * 86400_000 + 5.5 * 3600_000).toISOString().slice(0, 10);
const staffIds = (db.staff ?? []).map((s: Any) => ({ id: s.id, roles: s.roles as string[] }));
const by = (role: string) => staffIds.find((s: Any) => s.roles.includes(role))?.id ?? staffIds[0]?.id ?? 'demo-staff';
const PRINCIPAL = by('principal');
const COORD = by('academic_coordinator');
const OFFICE = by('admin_office');
const CONTENT = by('data_executive');
const FACULTY = by('faculty');

function rec(collection: string, id: string, data: Any, k1: string | null, k2: string | null, createdAt = iso(20), updatedAt = createdAt) {
  (db.records[collection] ??= []).push({ id, collection, k1, k2, data, createdAt, updatedAt });
}

// ------------------------------------------------------------------ articles
type L = 'public' | 'student' | 'parent' | 'faculty' | 'subject_head' | 'principal' | 'management' | 'admissions' | 'accounts' | 'admin';
interface A { centre: string; topic: string | null; title: string; te?: string; hi?: string; body: string; bodyTe?: string; bodyHi?: string; access: L; sens?: string; channels?: string[]; status?: string; sample?: boolean; reviewBy?: string; dept?: string; type?: string; owner?: string }
const PUB = ['website', 'bot', 'app', 'staff'];
const APP = ['app', 'staff'];
const STAFF = ['staff'];

const real: A[] = [
  // Admission (public, website + bot)
  { centre: 'admission', topic: 'guidelines', title: 'Programs and campuses at a glance', te: 'కోర్సులు మరియు క్యాంపస్‌లు', hi: 'कोर्स और कैंपस एक नज़र में', access: 'public', channels: PUB, sample: false, body: '## Programs\nTwo-year integrated programmes that combine TS Intermediate (MPC or BiPC) with preparation for JEE Main, JEE Advanced (IIT) or NEET-UG, plus a Long Term programme for students who have finished Class 12.\n\n## Campuses\nGirls Residential Campus at Bairamalguda, Boys Residential Campus at Kuntloor, and the Day Scholar Campus at LB Nagar, Hyderabad. Central Administration Office: Saroornagar.\n\n## Class size\nBatches have at most 40 students, with one mentor for every 20 students.', bodyTe: '## కోర్సులు\nTS ఇంటర్మీడియట్ (MPC లేదా BiPC)తో పాటు JEE మెయిన్, JEE అడ్వాన్స్‌డ్ (IIT) లేదా NEET-UG తయారీ కలిపిన రెండు సంవత్సరాల కోర్సులు; 12వ తరగతి పూర్తి చేసిన వారికి లాంగ్ టర్మ్.\n\n## క్యాంపస్‌లు\nబాలికల రెసిడెన్షియల్ (బైరామల్‌గూడ), బాలుర రెసిడెన్షియల్ (కుంట్లూర్), డే స్కాలర్ (LB నగర్).', bodyHi: '## कोर्स\nTS इंटरमीडिएट (MPC या BiPC) के साथ JEE मेन, JEE एडवांस्ड (IIT) या NEET-UG की तैयारी वाले दो वर्षीय कोर्स; कक्षा 12 पूरी कर चुके छात्रों के लिए लॉन्ग टर्म।\n\n## कैंपस\nबालिका आवासीय (बैरामलगुडा), बालक आवासीय (कुंटलूर), डे स्कॉलर (LB नगर)।' },
  { centre: 'admission', topic: 'eligibility', title: 'Who can apply', te: 'ఎవరు దరఖాస్తు చేయవచ్చు', hi: 'कौन आवेदन कर सकता है', access: 'public', channels: PUB, body: '## Two-year programmes\nStudents who have passed Class 10 (SSC or CBSE/ICSE) and are joining Intermediate first year.\n\n## Long Term\nStudents who have passed Class 12 / Intermediate and want a focused year for JEE or NEET.\n\nThe counsellor confirms the right program after the campus visit and counselling session.' },
  { centre: 'admission', topic: 'procedure', title: 'Admission steps and how to track them', te: 'అడ్మిషన్ దశలు', hi: 'प्रवेश के चरण', access: 'public', channels: PUB, sample: false, body: 'Enquiry → campus visit → counselling → application → document verification → fee payment and receipt → College ID.\n\nParents can follow every step on the Track your admission page with a one-time code sent to the mobile number used for the enquiry. The College ID is issued only after the application, documents, fee payment, receipt and student record are complete.' },
  { centre: 'admission', topic: 'documents', title: 'Documents to bring for admission', te: 'అడ్మిషన్‌కు తీసుకురావాల్సిన పత్రాలు', hi: 'प्रवेश के लिए दस्तावेज़', access: 'public', channels: PUB, body: 'The Admission Office checks the documents on the admission checklist (shown on the Admissions page and in the parent app), typically: Class 10 marks memo, transfer certificate, study certificates, Aadhaar, passport-size photos, and caste/income certificates only if a scholarship needs them.\n\nUpload them from the parent app before the verification visit to save time.' },
  { centre: 'admission', topic: 'fees', title: 'BSAT scholarship: up to 60% off tuition', te: 'BSAT స్కాలర్‌షిప్: ట్యూషన్‌పై 60% వరకు తగ్గింపు', hi: 'BSAT छात्रवृत्ति: ट्यूशन पर 60% तक छूट', access: 'public', channels: PUB, sample: false, body: 'One 90-minute test, the Bhargava Scholarship Admission Test (BSAT), decides a tuition scholarship of up to 60%, depending on the score band. Register on the Scholarship page; the test runs on campus or online and results come quickly.\n\nThe fee structure and a fee calculator are on the Fees page.' },
  { centre: 'admission', topic: 'counselling', title: 'Parent counselling: the 10-step guide', access: 'public', channels: PUB, sample: false, body: 'Before choosing a stream, parents can work through the free 10-step Parent Counselling Guide on the website (English, Telugu, Hindi) and then book a counselling session. The counsellor records the discussion so the family never has to repeat itself.' },
  { centre: 'admission', topic: 'orientation', title: 'New-student orientation week', access: 'public', channels: PUB, body: 'In the first week new students meet their mentor, get the timetable and study material, tour the labs and library, and take a short diagnostic test so faculty know where to start. Parents attend an orientation session on the first Saturday.' },
  { centre: 'admission', topic: 'faqs', title: 'Is the college recognised?', access: 'public', channels: PUB, sample: false, body: 'Yes. Bhargava Junior College is recognised by the Government of Telangana (TS Board of Intermediate Education), College Code 58560, and run by Sri Vihana Educational Society.' },
  { centre: 'admission', topic: 'faqs', title: 'How will I know how my child is doing?', access: 'public', channels: PUB, sample: false, body: 'Every Sunday parents get a WhatsApp report with attendance, the test trend and the mentor’s note. In the parent app you can see attendance, results and fees, book a PTM and message the class teacher.' },
  { centre: 'admission', topic: 'fees', title: 'Fee structure 2024-25', access: 'public', channels: PUB, status: 'published', reviewBy: day(-30), body: 'Fee structure for the 2024-25 academic year. Tuition, study material and hostel fees for 2024-25 are listed on the fee card.\n\n(Old: kept to show outdated-content detection. The current fees are on the Fees page.)' },
  // Student centre
  { centre: 'student', topic: 'handbook', title: 'Student handbook: daily routine and conduct', te: 'విద్యార్థి హ్యాండ్‌బుక్', hi: 'छात्र पुस्तिका', access: 'student', channels: APP, body: '## Routine\nClasses, study hours and tests follow the batch timetable in the app. Hostellers follow the hostel schedule.\n\n## Dress code\nCollege uniform on all working days; ID card worn on campus.\n\n## Mobile phones\nPhones are not used in classrooms or study hours. Hostellers deposit phones with the warden and call home at the set times.' },
  { centre: 'student', topic: 'regulations', title: 'TSBIE and BJC academic rules', access: 'student', channels: APP, body: '## TS Board of Intermediate Education\nStudents must meet the board’s minimum attendance (75%) to be allowed to write the Intermediate public examinations; shortage is condoned only as the board allows.\n\n## BJC rules\nWeekly tests are compulsory; a missed test is written the next week. Homework and DPPs are checked by the subject teacher.' },
  { centre: 'student', topic: 'attendance_policy', title: 'Attendance and leave rules', te: 'హాజరు మరియు సెలవు నియమాలు', hi: 'उपस्थिति और अवकाश नियम', access: 'student', channels: APP, body: 'Keep attendance at 75% or above (TSBIE minimum). Parents apply for leave in the app (day scholars) or approve hostel out-passes. Absence without leave is reported to parents the same day.', bodyTe: 'హాజరు 75% లేదా అంతకంటే ఎక్కువగా ఉంచండి (TSBIE కనీసం). తల్లిదండ్రులు యాప్‌లో సెలవు కోసం దరఖాస్తు చేస్తారు. అనుమతి లేని గైర్హాజరు అదే రోజు తల్లిదండ్రులకు తెలియజేయబడుతుంది.', bodyHi: 'उपस्थिति 75% या अधिक रखें (TSBIE न्यूनतम)। अभिभावक ऐप में अवकाश के लिए आवेदन करते हैं। बिना अनुमति की अनुपस्थिति की सूचना उसी दिन अभिभावकों को दी जाती है।' },
  { centre: 'student', topic: 'revaluation', title: 'Recounting, re-verification and Advanced Supplementary exams', access: 'student', channels: APP, body: '## After the results\nTSBIE opens recounting and re-verification (with a photocopy of the answer script) for a few days after the results. Apply online with the fee; the college office helps.\n\n## Advanced Supplementary\nStudents who fail or want to improve can write the Advanced Supplementary Examinations held soon after the results (usually May–June). Dates come in the TSBIE press note.' },
  { centre: 'student', topic: 'scholarships', title: 'Scholarships: BSAT and government schemes', access: 'student', channels: APP, body: 'BSAT gives a tuition scholarship of up to 60% at admission. Eligible students can also apply for Telangana post-matric scholarships through the ePASS portal; the office checks the documents and deadlines with you.' },
  { centre: 'student', topic: 'higher_studies', title: 'After Inter: JoSAA, NEET and EAPCET counselling', access: 'student', channels: APP, body: '## Engineering\nJEE Main ranks lead to NITs, IIITs and GFTIs; JEE Advanced ranks lead to IITs. Seats are allotted through JoSAA counselling (registration, choice filling, rounds).\n\n## Medical\nNEET-UG: 15% All India Quota through MCC counselling; state quota seats in Telangana through the state counselling (KNRUHS).\n\n## State\nTS EAPCET ranks for state engineering and agriculture/pharmacy colleges.' },
  { centre: 'student', topic: 'homework', title: 'Homework and DPP rules', access: 'student', channels: APP, body: 'Daily Practice Problems (DPPs) are given after each topic. Submit homework in the app before the due time; late work is marked late. Ask doubts in the app or at the doubt desk.' },
  { centre: 'student', topic: 'lab_manuals', title: 'Practical record rules (Physics, Chemistry, Botany, Zoology)', access: 'student', channels: APP, body: 'Write each experiment in the record the same week, with aim, apparatus, observations and result. Records are signed by the lecturer and are needed for the board practical examination.' },
  { centre: 'student', topic: 'welfare', title: 'Wellbeing support and the counsellor', access: 'student', channels: APP, body: 'An on-campus counsellor is available; book a private session in the app. Monthly check-ins help mentors notice stress early. What you tell the counsellor stays private.' },
  { centre: 'student', topic: 'career', title: 'Choosing between engineering, medicine and other paths', access: 'student', channels: APP, body: 'Talk to your mentor about strengths, mock-test trends and interests. Besides IIT/NIT and medicine, consider pure sciences (IISER/NISER), architecture, pharmacy, agriculture and law entrance routes.' },
  // Parent
  { centre: 'parent', topic: 'handbook', title: 'Parent handbook', te: 'తల్లిదండ్రుల హ్యాండ్‌బుక్', hi: 'अभिभावक पुस्तिका', access: 'parent', channels: APP, body: 'You get a weekly WhatsApp report every Sunday. In the app: attendance, results, fees and receipts, PTM booking, messages to the class teacher, out-pass approvals and the hostel menu. One mentor looks after every 20 students with a weekly one-to-one.' },
  { centre: 'parent', topic: 'emergency', title: 'Emergency contacts per campus', access: 'parent', channels: APP, body: 'In an emergency call the college office numbers on the Contact page; they reach the warden and security of each campus. Warden, security and doctor numbers per campus will be listed here by the office.' },
  { centre: 'parent', topic: 'ptm', title: 'How PTMs work', access: 'parent', channels: APP, body: 'PTM slots open in the app before each PTM day. Book a 10-minute slot with the class teacher; you can also message the teacher any time.' },
  { centre: 'parent', topic: 'fees', title: 'Fee instalments and reminders', access: 'parent', channels: APP, body: 'Fees can be paid in instalments. Reminders go out 3 days before a due date and while an instalment is overdue. Receipts are always in the app.' },
  // Exams
  { centre: 'exams', topic: 'hall_tickets', title: 'Hall-ticket guidelines', access: 'student', channels: APP, body: 'Board hall tickets come through the college. Check name, photo, subjects and centre. Carry it with your college ID to every paper; keep a photocopy at home.' },
  { centre: 'exams', topic: 'regulations', title: 'Exam conduct and malpractice', access: 'student', channels: APP, body: 'No phones, smart watches, notes or calculators (unless allowed). Arrive 30 minutes early. Any malpractice in a board exam is reported to TSBIE and can cancel the result.' },
  { centre: 'exams', topic: 'internal', title: 'Weekly and mock tests', access: 'public', channels: PUB, body: 'Weekly tests follow the syllabus plan; grand and mock tests follow the JEE/NEET pattern. Results, rank and chapter-wise analysis appear in the app.' },
  { centre: 'exams', topic: 'registration', title: 'JEE and NEET application help', access: 'student', channels: APP, body: 'The office helps you register for JEE Main (NTA), JEE Advanced and NEET-UG: photo and signature specs, category certificates and fee payment. Check your details twice before submitting.' },
  // Career
  { centre: 'career', topic: 'colleges', title: 'IITs, NITs, IIITs and AIIMS: what to know', access: 'public', channels: PUB, body: 'There are 23 IITs (JEE Advanced) and 31 NITs plus IIITs and GFTIs (JEE Main, through JoSAA). AIIMS and government medical colleges admit through NEET-UG counselling. Cut-offs change every year; use the latest JoSAA/MCC opening and closing ranks.' },
  { centre: 'career', topic: 'counselling', title: 'JoSAA and MCC choice filling: a checklist', access: 'public', channels: PUB, body: 'Register, list choices from most to least preferred, lock before the deadline, and keep documents ready for verification: Class 10 and 12 memos, rank card, category and income certificates, photos and ID.' },
  { centre: 'career', topic: 'strategy', title: 'JEE/NEET strategy and mock analysis', access: 'student', channels: APP, body: 'After every mock: list wrong and skipped questions by chapter, redo them within 48 hours, and track time per section. Weak chapters appear in your analytics.' },
  // Events
  { centre: 'events', topic: 'science_fair', title: 'Science fair and talent day', access: 'public', channels: PUB, body: 'Each year students show science projects and talents to parents and guests. Departments guide the projects; prizes go to the best models in each stream.' },
  { centre: 'events', topic: 'quiz', title: 'Quiz and olympiad contests', access: 'public', channels: PUB, body: 'Students take part in national olympiads and inter-college quizzes. The departments coach selected students after class.' },
  { centre: 'events', topic: 'social', title: 'Social service activities', access: 'public', channels: PUB, body: 'Students join tree planting, blood-donation awareness and community clean-up drives organised by the college (NSS is not applicable at junior college level).' },
  // Library
  { centre: 'library', topic: 'loans', title: 'Borrowing books and fines', access: 'student', channels: APP, body: 'Books are lent for 14 days. Return or renew on time; late books are marked overdue and the librarian reminds you.' },
  { centre: 'library', topic: 'digital', title: 'Digital library', access: 'student', channels: APP, body: 'NCERT books, previous papers and recorded classes are linked in the app under Study. Ask the librarian for anything not listed.' },
  // Faculty
  { centre: 'faculty', topic: 'handbook', title: 'Faculty handbook', access: 'faculty', channels: STAFF, body: 'Teaching hours, lesson plans, attendance marking in the app at the start of each period, homework and DPP checking, doubt desk duty and mentor one-to-ones.' },
  { centre: 'faculty', topic: 'leave', title: 'Faculty leave policy', access: 'faculty', channels: STAFF, body: 'Apply for leave in the CRM at least two days ahead (except emergencies). Arrange a substitute for your periods; the Principal approves.' },
  { centre: 'faculty', topic: 'exam_duties', title: 'Invigilation duties', access: 'faculty', channels: STAFF, body: 'Collect papers from the exam cell 15 minutes before; check IDs; no phones in the hall; report any malpractice to the chief superintendent in writing.' },
  { centre: 'faculty', topic: 'assessment', title: 'Internal assessment guidelines', access: 'faculty', channels: STAFF, body: 'Enter marks in the CRM within 48 hours of a test. Use the chapter tags so analytics are correct. Publish only after a second check.' },
  { centre: 'faculty', topic: 'performance', title: 'Faculty performance review process', access: 'principal', sens: 'restricted', channels: STAFF, body: 'Reviews each term combine results trends, syllabus completion, student feedback and observation. Individual reviews are private to the faculty member, Principal and Management.' },
  // Departments
  ...(['maths', 'physics', 'chemistry', 'biology'] as const).map((d): A => ({ centre: 'departments', topic: 'profile', dept: d, title: `${{ maths: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology (Botany & Zoology)' }[d]} department profile`, access: 'faculty', channels: STAFF, body: '## Vision\nStrong concepts for the board and the entrance exam.\n\n## Team\nThe department’s faculty are listed in the live panel (from staff records).\n\n## This term\nSyllabus plan, olympiad coaching and lab schedule.' })),
  { centre: 'departments', topic: 'meetings', dept: 'physics', title: 'Physics department meeting minutes (sample)', access: 'subject_head', channels: STAFF, body: 'Agenda: syllabus pace in 1st year, weekly test analysis (rotational motion weak), lab record checks. Actions: extra DPP on rotation; revise lab schedule.' },
  // Principal / Management
  { centre: 'principal', topic: 'plans', title: 'College development plan 2027-28', access: 'principal', sens: 'confidential', channels: STAFF, body: 'Priorities: results in JEE/NEET, attendance above 90%, mentor one-to-ones every week, new lab equipment, staff training each term.' },
  { centre: 'principal', topic: 'reports', title: 'How institutional reports are prepared', access: 'principal', sens: 'internal', channels: STAFF, body: 'Use Advanced AI → One-click reports for admissions, results, fees and attendance; add the monthly subject reports from each department.' },
  { centre: 'management', topic: 'strategy', title: 'Strategic plan 2027-30', access: 'management', sens: 'restricted', channels: STAFF, body: 'Growth targets per campus, admissions cost per lead, results goals and investment plan. Restricted to Management.' },
  { centre: 'management', topic: 'meetings', title: 'Management meeting record (sample)', access: 'management', sens: 'confidential', channels: STAFF, body: 'Reviewed admissions funnel, fee collection and hostel occupancy. Decisions: open a second BSAT date; expand transport routes.' },
  // Admin ops
  { centre: 'admin_ops', topic: 'emergency', title: 'Emergency procedures: fire, medical, missing student', access: 'admin', sens: 'confidential', channels: STAFF, body: '## Fire\nRaise the alarm, evacuate by the marked routes, assemble at the ground, take the register count, call 101.\n\n## Medical\nFirst aid at the sick room, call the doctor, inform parents, ambulance 108 if needed.\n\n## Missing student\nInform the warden and principal at once, check the gate log and CCTV, call the parents, inform the police if not found within the hour.' },
  { centre: 'admin_ops', topic: 'hr', title: 'Payroll and salary documents (process)', access: 'accounts', sens: 'restricted', channels: STAFF, body: 'Salary statements are prepared by Accounts by the 25th and approved by Management. Only Accounts and Admin handle payroll documents.' },
  { centre: 'admin_ops', topic: 'security', title: 'Security and visitor procedure', access: 'admin', channels: STAFF, body: 'All visitors sign in at the front desk and get a pass; students leave only with an approved out-pass; CCTV covers gates and corridors.' },
  // Compliance
  { centre: 'compliance', topic: 'tsbie', title: 'TSBIE recognition (College Code 58560)', access: 'principal', channels: STAFF, sample: false, body: 'Recognised by the Government of Telangana, College Code 58560. Affiliation renewal papers, inspection reports and board correspondence are filed here.' },
  { centre: 'compliance', topic: 'dpdp', title: 'DPDP Act 2023: how we handle personal data', access: 'principal', sens: 'internal', channels: STAFF, body: 'Families give consent in the app before records are shown. Only staff who need a record can see it; phone numbers are masked for others. Deletion requests are handled by the office and recorded here.' },
  { centre: 'compliance', topic: 'faculty_records', title: 'Faculty qualification records', access: 'principal', sens: 'restricted', channels: STAFF, body: 'Degree certificates and experience letters for every lecturer, kept for board inspections.' },
];

let n = 0;
const aid = () => `demo-kb-a-${String(++n).padStart(4, '0')}`;
const articles: { id: string; a: A }[] = real.map((a) => ({ id: aid(), a }));
// fill every centre to at least 10 with honest sample placeholders, one per topic that has none
const CENTRE_TOPICS: Record<string, { def: L; topics: [string, string][] }> = {
  student: { def: 'student', topics: [['syllabus', 'Course and syllabus overview'], ['materials', 'Year-wise study material'], ['notes', 'Formula sheets and NCERT references'], ['previous_papers', 'Previous papers'], ['model_papers', 'BJC model papers'], ['practicals', 'Inter practical records'], ['exam_process', 'Internal tests and the board exam process'], ['grievances', 'How to raise a grievance']] },
  parent: { def: 'parent', topics: [['attendance', 'Reading the attendance report'], ['progress', 'Understanding the progress report'], ['exams', 'Exam dates and hall tickets'], ['announcements', 'Where to find circulars'], ['teacher', 'Messaging the teacher'], ['grievance', 'Raising a concern'], ['counselling_guide', 'Using the parent counselling guide']] },
  faculty: { def: 'faculty', topics: [['profiles', 'Faculty profiles'], ['allocation', 'Subject and class allocation'], ['lesson_plans', 'Lesson plan template'], ['syllabus', 'Syllabus completion tracking'], ['mentoring', 'Mentoring one-to-ones'], ['resources', 'Question bank contributions'], ['fdp', 'Training calendar']] },
  departments: { def: 'faculty', topics: [['directory', 'Batch directory'], ['timetable', 'Workload and timetable'], ['performance', 'Subject performance review'], ['exam_analysis', 'Exam analysis method'], ['lab', 'Lab inventory and requests'], ['olympiad', 'Olympiad coaching plan'], ['budget', 'Department budget requests'], ['inspection', 'TSBIE practical inspection checklist']] },
  principal: { def: 'principal', topics: [['overview', 'College overview'], ['academic', 'Academic monitoring routine'], ['attendance', 'Attendance monitoring'], ['admissions', 'Admission statistics review'], ['results', 'Results review'], ['jee_neet', 'JEE/NEET results and seats'], ['finance', 'Monthly financial summary'], ['grievances', 'Grievance handling'], ['staff', 'Staff management']] },
  management: { def: 'management', topics: [['dashboard', 'Reading the institutional dashboard'], ['strength', 'Student strength'], ['campus', 'Campus comparison'], ['faculty', 'Faculty analytics'], ['admissions', 'Admission funnel'], ['finance', 'Budget and expenditure'], ['results', 'Results analytics'], ['infrastructure', 'Infrastructure plan'], ['growth', 'Growth report']] },
  admission: { def: 'public', topics: [['track', 'Tracking your admission']] },
  career: { def: 'public', topics: [['eligibility', 'Exam eligibility'], ['coding', 'Intro to coding'], ['documents', 'Scholarship and application documents'], ['certifications', 'Olympiads and NTSE'], ['alumni', 'Alumni stories'], ['statistics', 'Results statistics'], ['colleges', 'State engineering and medical colleges']] },
  library: { def: 'student', topics: [['handbook', 'Library rules and membership'], ['catalogue', 'Finding a book'], ['resources', 'Videos and DPPs'], ['loans', 'Renewing a book'], ['digital', 'E-journals'], ['handbook', 'Reading room timings'], ['catalogue', 'Requesting a new book'], ['resources', 'Previous papers in the library']] },
  admin_ops: { def: 'admin', topics: [['handbook', 'Admin handbook'], ['purchases', 'Purchase requests'], ['maintenance', 'Maintenance requests'], ['hostel', 'Hostel administration'], ['transport', 'Transport routes'], ['vendors', 'Approved vendors'], ['office', 'Office procedures']] },
  compliance: { def: 'principal', topics: [['circulars', 'TSBIE circulars'], ['quality', 'Academic audit'], ['inspection', 'Inspection checklist'], ['achievements', 'Student achievements evidence'], ['licences', 'Licences and NOCs'], ['audits', 'Annual report'], ['dpdp', 'CCTV policy']] },
  exams: { def: 'student', topics: [['timetables', 'Exam timetable'], ['external', 'Board, JEE and NEET dates'], ['results', 'Results'], ['revaluation', 'Revaluation'], ['faqs', 'Exam FAQs'], ['internal', 'Grand tests']] },
  events: { def: 'public', topics: [['calendar', 'Events calendar'], ['cultural', 'Cultural fest'], ['sessions', 'Speaker sessions'], ['sports', 'Sports day'], ['clubs', 'Clubs'], ['awards', 'Achievements and gallery'], ['science_fair', 'Science projects']] },
  student360: { def: 'faculty', topics: [['profile', 'Using the Student 360° view'], ['improvement', 'Improvement plans'], ['readiness', 'Readiness bands explained'], ['ai_reco', 'How recommendations are made'], ['olympiads', 'Recording workshops and olympiads'], ['achievements', 'Recording achievements'], ['mentor', 'Mentor notes'], ['tests', 'Reading test analytics'], ['board', 'Board results'], ['fees', 'Fee status for mentors']] },
};
for (const [centre, def] of Object.entries(CENTRE_TOPICS)) {
  for (const [topic, title] of def.topics) {
    const count = articles.filter((x) => x.a.centre === centre).length;
    if (count >= 12) break;
    const access = def.def;
    articles.push({ id: aid(), a: { centre, topic, title, access, channels: access === 'public' ? PUB : access === 'student' || access === 'parent' ? APP : STAFF, body: `## About\nSample article: “${title}”. The college will replace this text with its official version.\n\n## Until then\nAsk the college office or your class teacher; anything live (attendance, marks, fees) is shown from the college modules, not typed here.` } });
  }
}

const SENS = (a: A) => a.sens ?? (a.access === 'public' ? 'public' : 'internal');
articles.forEach(({ id, a }, i) => {
  // a few are in review / draft so the approvals inbox has work; one AI-generated draft
  const status = a.status ?? (i % 23 === 7 ? 'review' : i % 31 === 11 ? 'draft' : 'published');
  const owner = a.owner ?? (a.centre === 'admission' || a.centre === 'events' ? CONTENT : a.centre === 'admin_ops' ? OFFICE : a.centre === 'faculty' || a.centre === 'departments' ? FACULTY : a.centre === 'student' || a.centre === 'exams' ? COORD : PRINCIPAL);
  const data = {
    title: { en: a.title, te: a.te ?? null, hi: a.hi ?? null },
    body: { en: a.body, te: a.bodyTe ?? null, hi: a.bodyHi ?? null },
    centre: a.centre, topic: a.topic, type: a.type ?? (a.centre === 'admission' && a.topic === 'faqs' ? 'faq' : 'article'),
    access: a.access, sensitivity: SENS(a), channels: a.channels ?? STAFF, tags: [], categoryId: null, fileIds: [],
    ownerId: owner, reviewBy: a.reviewBy ?? day(180 + (i % 120)), status, sample: a.sample ?? true, department: a.dept ?? null, campus: null,
    version: 1, liveVersion: status === 'published' ? 1 : null, createdBy: owner, updatedBy: owner, publishedAt: status === 'published' ? iso(15) : null,
    submittedBy: status === 'review' ? owner : null, approvedBy: status === 'published' ? PRINCIPAL : null, rejectReason: null, aiGenerated: false, basedOn: [],
  };
  const at = iso(30 - (i % 25));
  rec('kb_articles', id, data, a.centre, status, at, at);
  rec('kb_versions', `${id}:v1`, { articleId: id, version: 1, snapshot: { title: data.title, body: data.body, centre: data.centre, topic: data.topic, type: data.type, access: data.access, sensitivity: data.sensitivity, channels: data.channels, tags: [], reviewBy: data.reviewBy, status }, by: owner, at, note: 'created (sample)' }, id, '000001', at);
});

// ------------------------------------------------------------------ documents
let fn = 0;
async function doc(o: { name: string; title: string; mime: string; kind: string; bytes: Uint8Array; pages: string[]; label?: string; centre: string; topic: string | null; access: L; sens: string; channels: string[]; status: string; sample: boolean; reviewBy?: string; dept?: string }) {
  const id = `demo-kb-f-${String(++fn).padStart(3, '0')}`;
  const sha = createHash('sha256').update(o.bytes).digest('hex');
  const key = `${id}/v1-${sha.slice(0, 16)}`;
  mkdirSync(path.join(FILES_DIR, id), { recursive: true });
  writeFileSync(path.join(FILES_DIR, key), o.bytes);
  const text = o.pages.join('\n');
  const at = iso(10 + fn);
  rec('kb_files', id, {
    title: { en: o.title, te: null, hi: null }, name: o.name, mime: o.mime, kind: o.kind, size: o.bytes.length, sha256: sha, storageKey: key, version: 1, liveVersion: o.status === 'published' ? 1 : null,
    history: [{ version: 1, storageKey: key, sha256: sha, size: o.bytes.length, mime: o.mime, name: o.name, at, by: CONTENT, note: 'seeded' }],
    extract: { status: text.trim() ? 'ok' : 'empty', method: o.kind === 'pdf' ? 'pdfjs' : o.kind, pages: o.pages.length, chars: text.length, langs: ['en', ...(/[ఀ-౿]/.test(text) ? ['te'] : []), ...(/[ऀ-ॿ]/.test(text) ? ['hi'] : [])], error: null },
    scan: { ok: true, notes: [] }, channels: o.channels, centre: o.centre, topic: o.topic, access: o.access, sensitivity: o.sens, ownerId: CONTENT, reviewBy: o.reviewBy ?? day(200),
    status: o.status, sample: o.sample, department: o.dept ?? null, campus: null, uploadedBy: CONTENT, publishedAt: o.status === 'published' ? at : null, approvedBy: o.status === 'published' ? PRINCIPAL : null, rejectReason: null,
  }, o.centre, sha, at, at);
  rec('kb_file_text', `${id}:1`, { fileId: id, version: 1, pages: o.pages, pageLabel: o.label ?? 'page' }, id, '0001', at);
  rec('kb_queue', `demo-kb-q-${fn}`, { kind: 'ingest', targetId: id, status: 'done', attempts: 1, error: null, at, doneAt: at, ms: 120 + fn * 37 }, 'done', at, at);
}

const enc = (s: string) => new TextEncoder().encode(s);
const brochure = path.join(ROOT, 'public', 'docs', 'BJC-Brochure-2027-28.pdf');
if (existsSync(brochure)) {
  const bytes = new Uint8Array(readFileSync(brochure));
  let pages: string[] = [];
  try {
    const { extractText } = await import('unpdf');
    // pass a copy: pdf.js detaches the buffer it is given
    pages = ((await extractText(bytes.slice(), { mergePages: false })).text as string[]).map((t) => t.replace(/[ \t]+/g, ' ').trim());
  } catch (e) {
    console.warn('Brochure text extraction failed:', (e as Error).message);
  }
  await doc({ name: 'BJC-Brochure-2027-28.pdf', title: 'Official brochure 2027-28', mime: 'application/pdf', kind: 'pdf', bytes, pages, centre: 'admission', topic: 'guidelines', access: 'public', sens: 'public', channels: PUB, status: 'published', sample: false, reviewBy: day(240) });
}
const calendar = 'Academic calendar 2027-28 (sample)\nJune: classes begin; orientation week\nAugust: first unit test\nOctober: Dasara holidays\nDecember: half-yearly exams\nJanuary: Sankranti holidays; pre-final exams\nFebruary: board practicals\nMarch: TS Intermediate public examinations';
await doc({ name: 'academic-calendar-2027-28-sample.txt', title: 'Academic calendar 2027-28 (sample)', mime: 'text/plain', kind: 'text', bytes: enc(calendar), pages: [calendar], label: 'part', centre: 'student', topic: 'exam_process', access: 'student', sens: 'internal', channels: APP, status: 'published', sample: true });
const lab = 'item,qty,condition\nVernier callipers,30,good\nScrew gauge,30,good\nSimple pendulum set,15,needs repair\nMeter bridge,10,good\nPotentiometer,8,broken';
await doc({ name: 'physics-lab-inventory-sample.csv', title: 'Physics lab inventory (sample)', mime: 'text/csv', kind: 'csv', bytes: enc(lab), pages: [lab.replace(/,/g, '\t')], label: 'part', centre: 'departments', topic: 'lab', access: 'faculty', sens: 'internal', channels: STAFF, status: 'published', sample: true, dept: 'physics' });
const evac = 'Evacuation plan (sample)\nBoys Residential Campus, Kuntloor: assembly point - main ground.\nGirls Residential Campus, Bairamalguda: assembly point - front lawn.\nDay Scholar Campus, LB Nagar: assembly point - parking area.\nWardens carry the night register at all times.';
await doc({ name: 'evacuation-plan-sample.txt', title: 'Campus evacuation plan (sample)', mime: 'text/plain', kind: 'text', bytes: enc(evac), pages: [evac], label: 'part', centre: 'admin_ops', topic: 'emergency', access: 'admin', sens: 'confidential', channels: STAFF, status: 'review', sample: true });
const tel = 'హాజరు నియమాలు (నమూనా)\nప్రతి విద్యార్థి కనీసం 75% హాజరు కలిగి ఉండాలి.\nసెలవు కోసం తల్లిదండ్రులు యాప్‌లో దరఖాస్తు చేయాలి.';
await doc({ name: 'attendance-rules-telugu-sample.txt', title: 'Attendance rules in Telugu (sample)', mime: 'text/plain', kind: 'text', bytes: enc(tel), pages: [tel], label: 'part', centre: 'student', topic: 'attendance_policy', access: 'student', sens: 'internal', channels: APP, status: 'published', sample: true });

// ------------------------------------------------------------------ other KB records
rec('kb_categories', 'demo-kb-c-1', { name: { en: 'Board exams', te: 'బోర్డు పరీక్షలు', hi: 'बोर्ड परीक्षाएँ' }, parentId: null, centre: 'exams', icon: '🧾', ownerId: COORD, reviewerRoles: ['academic_coordinator', 'principal'] }, 'exams', null);
rec('kb_categories', 'demo-kb-c-2', { name: { en: 'Revaluation', te: 'రీవాల్యుయేషన్', hi: 'पुनर्मूल्यांकन' }, parentId: 'demo-kb-c-1', centre: 'exams', icon: '🔁', ownerId: COORD, reviewerRoles: [] }, 'exams', 'demo-kb-c-1');
rec('kb_categories', 'demo-kb-c-3', { name: { en: 'Hostel life', te: 'హాస్టల్ జీవితం', hi: 'छात्रावास जीवन' }, parentId: null, centre: 'parent', icon: '🏠', ownerId: PRINCIPAL, reviewerRoles: ['principal'] }, 'parent', null);
rec('notify_rules', 'demo-kb-r-1', { name: 'Absent today → parents', trigger: 'attendance_absent', audience: 'parents', channels: ['whatsapp'], template: { en: 'Dear parent, {name} was absent today. Please reply or call the office.', te: 'ప్రియమైన తల్లిదండ్రులకు, {name} ఈ రోజు గైర్హాజరయ్యారు.', hi: 'प्रिय अभिभावक, {name} आज अनुपस्थित थे।' }, schedule: 'immediate', active: true, createdBy: PRINCIPAL }, 'attendance_absent', null);
rec('notify_rules', 'demo-kb-r-2', { name: 'Review date coming up → owners', trigger: 'document_review', audience: 'owners', channels: ['email', 'whatsapp'], template: { en: 'Hello {name}, these Knowledge Hub items need your review: {items}' }, schedule: 'daily_8am', active: true, createdBy: PRINCIPAL }, 'document_review', null);
rec('notify_rules', 'demo-kb-r-3', { name: 'JEE Main registration → students', trigger: 'exam_registration', audience: 'students', channels: ['push', 'sms'], template: { en: 'JEE Main registration is open. Meet the office for help with the form by {date}.' }, schedule: 'immediate', active: false, createdBy: COORD }, 'exam_registration', null);
rec('kb_licences', 'demo-kb-l-1', { name: 'Fire NOC', campus: 'boys_kuntloor', kind: 'fire', number: 'SAMPLE-FIRE-001', validTo: day(40), fileId: null, sample: true }, 'fire', day(40));
rec('kb_licences', 'demo-kb-l-2', { name: 'Hostel licence', campus: 'girls_bairamalguda', kind: 'hostel', number: 'SAMPLE-HOS-002', validTo: day(300), fileId: null, sample: true }, 'hostel', day(300));
rec('kb_licences', 'demo-kb-l-3', { name: 'Building safety certificate', campus: 'day_lb_nagar', kind: 'building', number: 'SAMPLE-BLD-003', validTo: day(-5), fileId: null, sample: true }, 'building', day(-5));
rec('kb_licences', 'demo-kb-l-4', { name: 'TSBIE recognition (College Code 58560)', campus: 'all', kind: 'tsbie', number: '58560', validTo: day(500), fileId: null, sample: true }, 'tsbie', day(500));
for (const [i, [item, qty, cond]] of ([['Vernier callipers', 30, 'good'], ['Simple pendulum set', 15, 'needs_repair'], ['Potentiometer', 8, 'broken']] as const).entries()) rec('dept_requests', `demo-kb-d-${i + 1}`, { department: 'physics', kind: 'equipment', item, qty, condition: cond, amount: 0, status: 'listed', by: FACULTY, at: iso(8), note: 'sample' }, 'physics', 'listed');
rec('dept_requests', 'demo-kb-d-9', { department: 'chemistry', kind: 'purchase', item: 'Burettes (50 ml)', qty: 20, condition: 'new_request', amount: 9000, status: 'requested', by: FACULTY, at: iso(3), note: 'sample: broken ones replaced' }, 'chemistry', 'requested');
const firstStudent = (db.students ?? [])[0];
if (firstStudent) rec('kb_grievances', 'demo-kb-g-1', { from: `student:${firstStudent.id}`, fromKind: 'student', studentId: firstStudent.id, category: 'hostel', text: 'Sample: the hot-water geyser on the 2nd floor has not worked for three days.', status: 'open', reply: null, handledBy: null, at: iso(2), updatedAt: iso(2) }, `student:${firstStudent.id}`, 'open');
rec('kb_gaps', 'demo-kb-q-1', { q: 'Is there a bus from Ibrahimpatnam?', norm: 'bus from ibrahimpatnam', lang: 'en', assistant: 'public', count: 3, firstAt: iso(6), lastAt: iso(1), status: 'open', articleId: null }, 'bus from ibrahimpatnam', 'open');
// the live sync record uses the fixed id "sync"; point it at the seed so indexes rebuild
(db.records.kb_settings ??= []).splice(0, db.records.kb_settings.length, ...db.records.kb_settings.filter((r: Any) => r.id !== 'sync'));
db.records.kb_settings.push({ id: 'sync', collection: 'kb_settings', k1: null, k2: null, data: { stamp: Date.now().toString(36), at: NOW.toISOString(), reason: 'demo seed' }, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() });

save();
const byCentre: Record<string, number> = {};
for (const { a } of articles) byCentre[a.centre] = (byCentre[a.centre] ?? 0) + 1;
console.log(`Knowledge Hub demo: ${articles.length} articles, ${fn} documents written to ${path.relative(ROOT, FILE)}`);
console.log(byCentre);
