/**
 * The platform at a glance: the bar across the top of the website and the "Explore" module buttons.
 * One list, so the bar, the home page and the Why Bhargava page always agree.
 */
export const PLATFORM_LINKS: { href: string; label: string; short: string }[] = [
  { href: '/', label: 'Website', short: 'Website' },
  { href: '/app/login', label: 'Student & Parent portal', short: 'Portal' },
  { href: '/crm/login', label: 'Staff CRM', short: 'Staff' },
  { href: '/track', label: 'Track admission', short: 'Track' },
  { href: '/why-bhargava', label: 'Why Bhargava', short: 'Why us' },
];

export type ModuleButton = { href: string; title: string; body: string; icon: string; group: 'Admissions' | 'Academics' | 'Campus' | 'Tools' };

export const MODULE_BUTTONS: ModuleButton[] = [
  { href: '/programs', title: 'Programs', body: 'IIT-JEE and NEET, two-year integrated and one-year long term.', icon: '🎯', group: 'Academics' },
  { href: '/course-finder', title: 'Course finder', body: 'Class and goal in, the right program out, in 30 seconds.', icon: '🧭', group: 'Tools' },
  { href: '/fees', title: 'Fees & calculator', body: 'Every fee published, with your scholarship and instalments.', icon: '💳', group: 'Admissions' },
  { href: '/scholarship', title: 'BSAT scholarship', body: 'Register, get a hall ticket, see the slab table.', icon: '🏅', group: 'Admissions' },
  { href: '/visit', title: 'Book a campus visit', body: 'Pick a slot, Monday to Saturday.', icon: '📅', group: 'Admissions' },
  { href: '/track', title: 'Track my admission', body: 'Every step, its owner and the date, by mobile number.', icon: '📍', group: 'Admissions' },
  { href: '/admission-system', title: 'Admission system', body: 'Ten tracked stages from enquiry to College ID.', icon: '🗂️', group: 'Admissions' },
  { href: '/results', title: 'Results & Hall of Fame', body: 'Toppers with verifiable scorecards.', icon: '🏆', group: 'Academics' },
  { href: '/mock-test', title: 'Free mock test', body: 'Timed, auto-marked, with your score at the end.', icon: '📝', group: 'Tools' },
  { href: '/predictor', title: 'Rank predictor', body: 'JEE percentile or NEET score to a rank band.', icon: '📈', group: 'Tools' },
  { href: '/resources', title: 'Free resources', body: 'NCERT solutions, previous papers, DPPs, formula sheets.', icon: '📚', group: 'Tools' },
  { href: '/hostel', title: 'Hostel', body: 'Rooms, mess menu, daily schedule and parent alerts.', icon: '🏠', group: 'Campus' },
  { href: '/campus', title: 'Campus & gallery', body: 'Classrooms, labs, library and campus life.', icon: '🏫', group: 'Campus' },
  { href: '/faculty', title: 'Faculty', body: 'Teachers with a decade and more of experience.', icon: '👩‍🏫', group: 'Academics' },
  { href: '/app/login', title: 'Student & Parent portal', body: 'Attendance, marks, practice, fees, PTM and more.', icon: '📱', group: 'Campus' },
  { href: '/why-bhargava', title: 'Why Bhargava', body: 'What we do that most coaching colleges don’t.', icon: '⭐', group: 'Admissions' },
];
