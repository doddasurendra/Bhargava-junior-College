/**
 * REAL college facts (from the brief). Do not add facts here that the college has not confirmed.
 * Everything editable/sample lives in ./sample.ts and is flagged `sample: true`.
 */
export const college = {
  name: 'Bhargava Junior College',
  // Spelling as on the official logo.
  motto: 'Vidhya Vruddhi Vikasam',
  society: 'Sri Vihana Educational Society',
  // Official logo from bhargavajuniorcollege.com (BHARGAVA-JUNIOR-COLLEGE-LOGO), trimmed to a 512 px square.
  logoSrc: '/logo.png',
  // Official brochure 2027-28: recognised by the Govt. of Telangana.
  collegeCode: '58560',
  recognition: 'Recognised by Govt. of Telangana, College Code: 58560',
  chairman: { name: 'Venugopal Gattu', role: 'Chairman & Co-founder' },
  quote: 'With the utmost personal care, we empower every student towards success.',
  lifeMotto: 'Balance is our mantra of life',
  website: 'www.bhargavajuniorcollege.com',
  // Central Administration Office, as printed on the brochure's back cover.
  address: {
    line1: 'House No 3-2-22',
    line2: 'Nagarjuna Sagar Ring Road, Sathavahana Nagar',
    locality: 'Saroornagar',
    city: 'Hyderabad',
    region: 'Telangana',
    pin: '500035',
    country: 'IN',
  },
  phones: [
    { display: '+91 81432 37575', tel: '+918143237575' },
    { display: '+91 81432 17575', tel: '+918143217575' },
  ],
  // TODO(college): confirm which number is on WhatsApp Business.
  whatsapp: '918143237575',
  email: 'office@bhargavajuniorcollege.com',
  hours: [
    { days: 'Monday – Friday', time: '7:00 AM – 5:00 PM' },
    { days: 'Saturday', time: '9:00 AM – 3:00 PM' },
    { days: 'Sunday', time: 'Closed' },
  ],
  hoursShort: 'Mon–Fri 7 AM–5 PM · Sat 9 AM–3 PM',
  leader: { name: 'Dr. G. V. Venkat Ramana', credentials: 'F.I.E., Ph.D. (Civil Engineering)' },
  // From bhargavajuniorcollege.com (Vision, Mission and About Us sections), checked 4 Nov 2026.
  leaderCredentialsFull: 'F.I.E. · Ph.D. (Civil Engg.), M.Tech (WRE), B.E. (Civil Engg.), D.C.E., B.Com., M.B.A. (H.R.M), M.A. (Sociology) and further postgraduate degrees, diplomas and certificates',
  tagline: 'Great education begins with great teaching — everything else follows',
  // Vision and mission word for word from the 2027-28 brochure (page 2); full text in content/brochure.
  vision: 'We envision being a beacon of academic excellence to help aspiring students excel in prestigious entrance examinations such as IIT-JEE & NEET',
  mission:
    'At Bhargava Junior College, we are committed to providing students with a transformative educational experience through redefined academic coaching methodologies and a meticulously designed curriculum. By staying at the forefront of educational innovation, we ensure that every student receives nothing short of the best. Our mission is to equip students with strong logical, analytical and technical skills, enabling them to excel in their chosen fields and achieve their goals in competitive examinations such as IIT-JEE & NEET. We are equally committed to nurturing intellectual growth, academic development and emotional well-being within a collaborative yet competitive learning environment, encouraging every student to explore and realise their maximum potential.',
  apart: 'What sets Bhargava Junior College apart is its relentless pursuit of academic perfection: structured programs designed for IIT-JEE and NEET, with support and guidance for students at every level.',
  // The 16 professors in the brochure average 20.7 years (16+ to 24+ years each).
  facultyAvgExperience: '20+ years',
  maxBatchSize: 40,
  mentorRatio: 20,
  admissionsOpen: '2027-28',
  mapsQuery: 'Bhargava Junior College, Saroornagar, Hyderabad 500035',
} as const;

export const fullAddress = `${college.address.line1}, ${college.address.line2}, ${college.address.locality}, ${college.address.city} – ${college.address.pin}`;

export const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(college.mapsQuery)}&output=embed`;
export const mapsLinkUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(college.mapsQuery)}`;

export function whatsappLink(text = 'Hello, I would like to know about admissions at Bhargava Junior College.') {
  return `https://wa.me/${college.whatsapp}?text=${encodeURIComponent(text)}`;
}

/** Parent testimonials — names/roles are real; quote text must come from the college (CMS). */
export const testimonials: { name: string; role: string; quote: string | null }[] = [
  { name: 'Siva RK', role: 'Senior Scientist, DRDL', quote: null },
  { name: 'Raj M', role: 'VP, MNC', quote: null },
  { name: 'Madhukar Reddy', role: 'Senior Lecturer', quote: null },
];
