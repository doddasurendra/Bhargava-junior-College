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
  address: {
    line1: 'ACE DANA PEARL, H.No 3-2-22',
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
  vision: 'We envision being a beacon of academic excellence to help the aspiring students crack the prestigious entrance exams',
  mission:
    'To give every student a transformative education through refined coaching methods and a carefully designed curriculum; to build the logical, analytical and technical skills that competitive exams demand; and to support each student’s intellectual growth, academic development and emotional well-being so they can reach their full potential.',
  apart: 'What sets Bhargava Junior College apart is its relentless pursuit of academic perfection: structured programs designed for IIT-JEE and NEET, with support and guidance for students at every level.',
  facultyAvgExperience: '10+ years',
  maxBatchSize: 40,
  mentorRatio: 20,
  admissionsOpen: '2027–29',
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
