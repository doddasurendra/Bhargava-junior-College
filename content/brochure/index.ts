/**
 * The official 2027-28 brochure: text (en / te / hi), photos, faculty, campuses and addresses.
 * Source: docs/brochure-source.pdf ("Final Version 2027 v3.2 - 29 oct"). Photos: public/images/brochure
 * (WebP, made by scripts/brochure-images.mjs; originals in assets/brochure-images).
 * This is REAL college content, so nothing here carries a "Sample data" badge.
 */
import type { Lang } from '@/lib/i18n';
import { en, type BrochureText } from './en';
import { hi } from './hi';
import manifest from './images.json';
import { te } from './te';

export type { BrochureText };
export const BROCHURE: Record<Lang, BrochureText> = { en, te, hi };
export const brochureText = (lang: Lang) => BROCHURE[lang] ?? en;

export interface Photo {
  src: string;
  w: number;
  h: number;
  alt: string;
}
type Key = keyof typeof manifest;
export function photo(key: Key, alt: string): Photo {
  const m = manifest[key];
  return { src: m.src, w: m.w, h: m.h, alt };
}

/** The compressed brochure PDF served by the site (source PDF is not committed). */
export const BROCHURE_PDF = '/docs/BJC-Brochure-2027-28.pdf';
/** Where the printed QR code should take people once the site is live on the college domain. */
export const BROCHURE_PUBLIC_URL = `https://www.bhargavajuniorcollege.com${BROCHURE_PDF}`;
export const COLLEGE_CODE = '58560';
export const WEBSITE = 'www.bhargavajuniorcollege.com';

export const media = {
  hero: { building: photo('hero/campus-building', 'Bhargava Junior College campus building'), student: photo('hero/student', 'A Bhargava Junior College student') },
  chairman: photo('leadership/chairman-venugopal-gattu', 'Venugopal Gattu, Chairman & Co-founder, Bhargava Junior College'),
  /** page 3 photos, in order: one per differentiator card, the ninth for Beyond Academics */
  different: (['photo-01', 'photo-02', 'photo-03', 'photo-04', 'photo-05', 'photo-06', 'photo-07', 'photo-08', 'photo-09'] as const).map((p, i) => photo(`what-makes-different/${p}`, i < 8 ? `${en.different.items[i].title} at Bhargava Junior College` : 'Students beyond academics at Bhargava Junior College')),
  /** page 4 photos, two per parent question (security staff for the safety question) */
  parents: [
    ['classroom-01', 'classroom-02'],
    ['classroom-03', 'classroom-04'],
    ['classroom-05', 'classroom-06'],
    ['security-staff-1', 'security-staff-2'],
    ['classroom-07', 'classroom-08'],
    ['classroom-09', 'classroom-10'],
  ].map((pair, i) => pair.map((p) => photo(`parents-care/${p}` as Key, p.startsWith('security') ? 'Security staff on a Bhargava Junior College campus' : `Classroom at Bhargava Junior College (${en.parents.items[i].q.replace(/\?$/, '')})`))),
  parentsExtra: [photo('parents-care/classroom-11', 'Students in a Bhargava Junior College classroom'), photo('parents-care/classroom-12', 'Faculty teaching a Bhargava Junior College class'), photo('parents-care/security-staff-3', 'Security staff on a Bhargava Junior College campus')],
  courses: { jee: photo('courses/engineering-jee', 'Engineering (JEE Main, JEE Advanced) students at Bhargava Junior College'), neet: photo('courses/medical-neet', 'Medical (NEET-UG) students at Bhargava Junior College') },
  /** page 6, in block order: two photos per campus-life block */
  campusLife: [
    ['chemistry-lab', 'physics-lab'],
    ['digital-classroom', 'spacious-classroom'],
    ['boys-hostel', 'girls-hostel'],
    ['dining-hall', 'nutritious-meals'],
    ['playground', 'basketball-court'],
    ['environment-yoga-1', 'environment-yoga-2'],
  ].map((pair, i) => pair.map((p, j) => photo(`campus-life/${p}` as Key, `${en.campusLife.blocks[i].captions[j]}, Bhargava Junior College`))),
  campusBuilding: photo('campus-life/campus-building', 'Bhargava Junior College campus'),
  campuses: [
    photo('campuses/girls-residential-bairamalguda', 'Girls Residential Campus, Bairamalguda'),
    photo('campuses/boys-residential-kuntloor', 'Boys Residential Campus, Kuntloor'),
    photo('campuses/day-scholar-lb-nagar', 'Day Scholar Campus, LB Nagar, Hyderabad'),
  ],
  qrPrinted: photo('contact/brochure-download-qr', 'QR code printed in the brochure (opens www.bhargavajuniorcollege.com)'),
};

// ---------------------------------------------------------------- faculty (page 4)

export type FacultyGroup = 'maths' | 'physics' | 'chemistry' | 'biology';
export const FACULTY_GROUPS: { key: FacultyGroup; subject: string; color: string; icon: string }[] = [
  { key: 'maths', subject: 'Mathematics', color: '#1f2a5a', icon: 'M5 12h14M12 5v14M5 5l14 14' },
  { key: 'physics', subject: 'Physics', color: '#5b2a86', icon: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 12c0-3 3.6-5 8-5s8 2 8 5-3.6 5-8 5-8-2-8-5Z' },
  { key: 'chemistry', subject: 'Chemistry', color: '#1d6b45', icon: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3' },
  { key: 'biology', subject: 'Botany & Zoology', color: '#5f6b1f', icon: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14Zm0 0 7-7' },
];

const prof = (group: FacultyGroup, name: string, years: number, expertise: string, file: string) => ({ group, name, qualification: 'M.Sc.', years, expertise, photo: photo(`faculty/${file}` as Key, `${name}, ${FACULTY_GROUPS.find((g) => g.key === group)!.subject}, ${years}+ years experience`) });

export const FACULTY = [
  prof('maths', 'Prof. RVR', 22, 'Expert in Concept Clarity', 'prof-rvr'),
  prof('maths', 'Prof. Rajashekar', 23, 'Expert in Problem Solving', 'prof-rajashekar'),
  prof('maths', 'Prof. Srihari Rao', 24, 'Expert in Concept Clarity', 'prof-srihari-rao'),
  prof('maths', 'Prof. Tharaphanindri', 18, 'Expert in Concept Clarity', 'prof-tharaphanindri'),
  prof('physics', 'Prof. Kalyan', 20, 'Expert in Concept Building', 'prof-kalyan'),
  prof('physics', 'Prof. Rangaraju', 21, 'Expert in Applications', 'prof-rangaraju'),
  prof('physics', 'Prof. Chandra Shekar', 20, 'Expert in Concept Clarity', 'prof-chandra-shekar'),
  prof('physics', 'Prof. Gopinath', 22, 'Expert in Concept Clarity', 'prof-gopinath'),
  prof('chemistry', 'Prof. Madhukar', 22, 'Expert in Concept Clarity', 'prof-madhukar'),
  prof('chemistry', 'Prof. Ramesh', 22, 'Expert in Problem Solving', 'prof-ramesh'),
  prof('chemistry', 'Prof. Krishna', 22, 'Expert in Concept Clarity', 'prof-krishna'),
  // Spelling as printed in the brochure (the photo file says "narayana"). TODO(college): confirm.
  prof('chemistry', 'Prof. Adhi Naryana', 16, 'Expert in Concept Clarity', 'prof-adhi-narayana'),
  prof('biology', 'Prof. Nalini', 16, 'Expert in Plant Sciences', 'prof-nalini'),
  prof('biology', 'Prof. Venkat', 21, 'Expert in Concept Clarity', 'prof-venkat'),
  prof('biology', 'Prof. Rama Krishna', 22, 'Expert in Zoology Concepts', 'prof-rama-krishna'),
  prof('biology', 'Prof. Murali Krishna', 20, 'Expert in Applications', 'prof-murali-krishna'),
];
export type FacultyMember = (typeof FACULTY)[number];

// ---------------------------------------------------------------- campuses and addresses (pages 7-8)

export type CampusKey = 'girls_bairamalguda' | 'boys_kuntloor' | 'day_lb_nagar';
const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const CAMPUSES: { key: CampusKey; label: string; mapsUrl: string }[] = [
  { key: 'girls_bairamalguda', label: 'Girls Residential – Bairamalguda', mapsUrl: maps('H.No 7-2-113, Sri Lakshmi Ganesh Nagar Colony, Sagar Road, Bairamalguda, Hyderabad 500079') },
  { key: 'boys_kuntloor', label: 'Boys Residential – Kuntloor', mapsUrl: maps('Kuntloor village, Pedda Amberpet Mandal, Ranga Reddy District 501513') },
  { key: 'day_lb_nagar', label: 'Day Scholar – LB Nagar', mapsUrl: maps('Bhargava Junior College, LB Nagar, Hyderabad') },
];
export const CAMPUS_KEYS = CAMPUSES.map((c) => c.key) as [CampusKey, ...CampusKey[]];
export const campusLabel = (k: string | null | undefined) => CAMPUSES.find((c) => c.key === k)?.label ?? null;

/** The three addresses printed on the back cover, in brochure order (labels are translated in the text files). */
export const ADDRESSES = [
  { address: 'House No 3-2-22, Nagarjuna Sagar Ring Road, Sathavahana Nagar, Saroornagar, Hyderabad 500035', mapsUrl: maps('3-2-22, Nagarjuna Sagar Ring Road, Sathavahana Nagar, Saroornagar, Hyderabad 500035') },
  { address: 'Plot number 17, 18, Survey number 108 & 109, Kuntloor village, Pedda Amberpet Mandal, RangaReddy District 501513', mapsUrl: CAMPUSES[1].mapsUrl },
  { address: 'H.No: 7-2-113, 4 Sri Lakshmi Ganesh Nagar Colony, Sagar Road, Bairamalguda, Saroornagar Mandal, Hyderabad 500079', mapsUrl: CAMPUSES[0].mapsUrl },
];
/** Map pins on the back cover: Bairamalguda, LB Nagar, Kuntloor (matching contact.pins). */
export const MAP_PINS = [CAMPUSES[0].mapsUrl, CAMPUSES[2].mapsUrl, CAMPUSES[1].mapsUrl];
