/**
 * SAMPLE DATA for build and demo (brief §3). Every block carries `sample: true`, which renders a
 * "Sample data" badge. Replace with real data (and set sample: false) before launch.
 * Phase 2 moves all of this into the headless CMS so admins can edit it without code changes.
 */

export type ResultType = 'jee' | 'neet' | 'board';

export const results = {
  sample: true,
  items: [
    { name: 'A. Sai Charan', exam: 'JEE Advanced', type: 'jee' as ResultType, year: 2026, score: 'AIR 412', verifyUrl: null as string | null },
    { name: 'K. Harshitha', exam: 'NEET UG', type: 'neet' as ResultType, year: 2026, score: '686 / 720', verifyUrl: null as string | null },
    { name: 'M. Rohith', exam: 'JEE Main', type: 'jee' as ResultType, year: 2026, score: '99.82 percentile', verifyUrl: null as string | null },
    { name: 'P. Sri Vaishnavi', exam: 'NEET UG', type: 'neet' as ResultType, year: 2026, score: '671 / 720', verifyUrl: null as string | null },
    { name: 'T. Varun Teja', exam: 'JEE Advanced', type: 'jee' as ResultType, year: 2026, score: 'AIR 1,208', verifyUrl: null as string | null },
    { name: 'S. Keerthana', exam: 'TS Inter MPC', type: 'board' as ResultType, year: 2026, score: '992 / 1000', verifyUrl: null as string | null },
  ],
  aggregates: [
    { value: '38', label: 'IIT / NIT selections' },
    { value: '112', label: 'NEET qualifiers' },
    { value: '96%', label: 'Inter first class' },
    { value: '14', label: 'ranks under AIR 5,000' },
  ],
};

export const fees = {
  sample: true,
  academicYear: '2027–28',
  twoYear: { tuition: 135000, material: 15000, admission: 5000 },
  longTerm: { tuition: 110000, material: 15000, admission: 5000 },
  hostelNonAc: 120000,
  hostelAc: 150000,
  transport: 18000,
  instalmentOptions: [1, 3, 10],
  paymentModes: ['UPI', 'Debit / credit cards', 'Net banking', 'Bank transfer', 'UPI AutoPay (monthly plans)'],
};
export type FeeData = typeof fees;

export const bsat = {
  sample: true,
  name: 'BSAT — Bhargava Scholarship & Admission Test',
  durationMin: 90,
  sections: ['Mathematics / Biology', 'Physics', 'Chemistry', 'Mental Ability'],
  eligibility: 'Class 10 students',
  resultsWithin: '48 hours',
  sessions: [
    { id: '2026-11-16-campus', date: '2026-11-16', mode: 'campus' as const },
    { id: '2026-11-30-online', date: '2026-11-30', mode: 'online' as const },
    { id: '2026-12-14-campus', date: '2026-12-14', mode: 'campus' as const },
  ],
  /** Sorted high → low. Score is the BSAT percentage. */
  slabs: [
    { min: 90, label: '90% and above', pct: 60 },
    { min: 80, label: '80 – 89%', pct: 45 },
    { min: 70, label: '70 – 79%', pct: 30 },
    { min: 60, label: '60 – 69%', pct: 20 },
    { min: 50, label: '50 – 59%', pct: 10 },
  ],
  gpaBonus: 10,
  cap: 60,
};
export type BsatData = typeof bsat;

export const hostel = {
  sample: true,
  blocks: 'Separate blocks for boys and girls',
  rooms: ['3-sharing AC rooms', '4-sharing non-AC rooms', 'Attached bathrooms in every room'],
  safety: [
    'Resident warden on every floor; lady warden for the girls’ block',
    '24×7 CCTV in common areas',
    'Biometric entry and exit, with a WhatsApp alert to parents on every check-in and check-out',
  ],
  health: ['Doctor on call', 'Sick room on campus', 'Tie-up with a nearby hospital'],
  amenities: ['RO drinking water', 'Laundry twice a week', 'Wi-Fi in the study hall only'],
  food: 'Vegetarian kitchen, with egg on alternate days. The weekly mess menu is published in the parent app.',
  schedule: [
    { time: '05:30', activity: 'Wake up' },
    { time: '06:00', activity: 'Morning study' },
    { time: '07:30', activity: 'Breakfast' },
    { time: '08:30', activity: 'Classes' },
    { time: '13:00', activity: 'Lunch' },
    { time: '14:00', activity: 'Classes and doubt clinic' },
    { time: '17:30', activity: 'Games / yoga' },
    { time: '19:30', activity: 'Supervised night study' },
    { time: '22:15', activity: 'Lights out' },
  ],
};

export const faculty = {
  sample: true,
  items: [
    { name: 'S. Krishna Murthy', subject: 'Physics', years: 14 },
    { name: 'P. Radhika', subject: 'Chemistry', years: 12 },
    { name: 'V. Naresh', subject: 'Mathematics', years: 15 },
    { name: 'A. Swathi', subject: 'Biology', years: 11 },
  ],
};

/**
 * Sample staff for the local development store only (brief §3.6). Real staff are created as
 * Supabase Auth users + profiles + user_roles.
 */
export const devStaff = {
  sample: true,
  items: [
    { id: 'staff-admin', fullName: 'Super Admin', roles: ['super_admin' as const] },
    { id: 'staff-manager', fullName: 'Admission Manager', roles: ['admission_manager' as const] },
    { id: 'staff-priya', fullName: 'Priya', roles: ['telecaller' as const] },
    { id: 'staff-ramesh', fullName: 'Ramesh', roles: ['telecaller' as const] },
    { id: 'staff-divya', fullName: 'Divya', roles: ['telecaller' as const] },
    { id: 'staff-anil', fullName: 'Anil', roles: ['admission_counsellor' as const] },
    { id: 'staff-frontdesk', fullName: 'Front Desk', roles: ['front_desk' as const] },
    { id: 'staff-office', fullName: 'Admission Office', roles: ['admission_office' as const] },
    { id: 'staff-accounts', fullName: 'Accounts', roles: ['accounts' as const] },
    { id: 'staff-adminoffice', fullName: 'Admin Office', roles: ['admin_office' as const] },
  ],
};

/** Campus visit slots. Mirrors supabase/seed.sql (visit_slots) — keep both in sync until the CMS owns it. */
export const visitSlots = {
  sample: true,
  slots: [
    { slot: '10:00', label: '10:00 AM', capacity: 5, saturday: true },
    { slot: '11:30', label: '11:30 AM', capacity: 5, saturday: true },
    { slot: '14:00', label: '2:00 PM', capacity: 5, saturday: true },
    { slot: '15:30', label: '3:30 PM', capacity: 5, saturday: false },
  ],
  maxDaysAhead: 30,
};

/**
 * Document checklist for the admission verification checkpoint (brief §7.4). `required: false` means
 * "if applicable": it must be verified or marked not applicable. Override per program in `byProgram`.
 */
export const documentChecklist = {
  sample: true,
  default: [
    { key: 'ssc_memo', label: 'SSC / Class 10 marks memo', required: true },
    { key: 'tc', label: 'Transfer certificate (TC)', required: true },
    { key: 'study_certificate', label: 'Study certificate', required: true },
    { key: 'aadhaar', label: 'Aadhaar card (student)', required: true },
    { key: 'photos', label: 'Passport-size photographs', required: true },
    { key: 'caste_income', label: 'Caste / income certificate (if applicable)', required: false },
  ],
  byProgram: {} as Partial<Record<string, { key: string; label: string; required: boolean }[]>>,
};
export type ChecklistItem = (typeof documentChecklist.default)[number];

export const admissionDocuments = documentChecklist.default.map((d) => d.label);

/** College ID and receipt numbering (brief §7.4). Format is configurable; sequences are per year + program. */
export const numbering = {
  sample: true,
  collegeId: {
    template: 'BJC-{YEAR}-{PROGRAM}-{SEQ}',
    year: 2027,
    seqDigits: 4,
    programCodes: { 'iit-jee': 'JEE', neet: 'NEET', 'long-term-jee': 'LTJ', 'long-term-neet': 'LTN' } as Record<string, string>,
  },
  receipt: { prefix: 'BJC', academicYear: '2027-28', seqDigits: 5 },
};

/**
 * Weekly mess menu shown in the parent app (brief §3.4: vegetarian kitchen, egg on alternate days).
 * SAMPLE — the hostel office replaces it each week.
 */
export const messMenu = {
  sample: true,
  weekOf: '2026-11-02',
  days: [
    { day: 'Monday', breakfast: 'Idli, sambar, chutney', lunch: 'Rice, dal, mixed veg curry, curd', snacks: 'Sprouts chaat', dinner: 'Chapati, paneer curry, rice, rasam' },
    { day: 'Tuesday', breakfast: 'Upma, boiled egg / banana', lunch: 'Rice, sambar, beans fry, curd', snacks: 'Biscuits, tea', dinner: 'Chapati, egg curry / veg kurma, rice' },
    { day: 'Wednesday', breakfast: 'Pongal, chutney', lunch: 'Rice, tomato dal, cabbage fry, curd', snacks: 'Fruit', dinner: 'Veg biryani, raita' },
    { day: 'Thursday', breakfast: 'Poori, potato curry, boiled egg / banana', lunch: 'Rice, rasam, brinjal curry, curd', snacks: 'Groundnut chikki', dinner: 'Chapati, dal fry, rice' },
    { day: 'Friday', breakfast: 'Dosa, chutney', lunch: 'Rice, sambar, aloo fry, curd', snacks: 'Bajji, tea', dinner: 'Chapati, chana masala, rice' },
    { day: 'Saturday', breakfast: 'Vada, sambar, boiled egg / banana', lunch: 'Lemon rice, dal, papad, curd', snacks: 'Fruit', dinner: 'Chapati, mixed veg, rice' },
    { day: 'Sunday', breakfast: 'Masala dosa', lunch: 'Veg pulao, paneer curry, curd', snacks: 'Cake, milk', dinner: 'Chapati, dal, rice, sweet' },
  ],
};

/** Admissions season for "season to date" on the management dashboard. */
export const admissionsSeason = { sample: true, label: '2027–29 intake', start: '2026-09-01' };

/** Public URLs of the program brochure PDFs, sent as the WhatsApp document header. null = not available yet. */
export const brochures = {
  sample: true,
  urls: { 'iit-jee': null, neet: null, 'long-term-jee': null, 'long-term-neet': null } as Record<string, string | null>,
};

export const PAYMENT_MODES = [
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Net banking' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque / DD' },
  { value: 'cash', label: 'Cash' },
] as const;

export const faqs = {
  sample: true,
  items: [
    {
      q: 'Which programs does Bhargava Junior College offer?',
      a: 'Four programs: IIT-JEE Integrated and NEET UG Integrated (2 years, with the TS Intermediate Board), and one-year Long Term repeater programs for JEE and NEET.',
    },
    {
      q: 'Are the fees published?',
      a: 'Yes. The full fee table and a fee and scholarship calculator are on the Fees page. You do not need to fill a form to see them.',
    },
    {
      q: 'How does the BSAT scholarship work?',
      a: 'BSAT is a 90-minute test for Class 10 students. Your score sets a tuition scholarship of up to 60%, with an extra 10% for a 10 GPA in SSC (total capped at 60%).',
    },
    {
      q: 'What is the batch size?',
      a: 'A maximum of 40 students per batch, and one mentor for every 20 students.',
    },
    {
      q: 'Is hostel accommodation available?',
      a: 'Yes. There are separate boys’ and girls’ blocks with wardens, CCTV in common areas, and biometric check-in and check-out with WhatsApp alerts to parents.',
    },
    {
      q: 'Can we visit the campus before deciding?',
      a: 'Yes. Book a campus visit slot online for Monday to Saturday. You will get a WhatsApp confirmation and a reminder before the visit.',
    },
    {
      q: 'Which documents are needed for admission?',
      a: 'SSC memo, transfer certificate, study certificate, Aadhaar, photographs, and a caste/income certificate if applicable.',
    },
  ],
};
