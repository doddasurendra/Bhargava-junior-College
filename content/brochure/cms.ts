/**
 * CMS defaults built from the official brochure (English source). The CMS can still edit every block;
 * these are what the site shows until someone saves a change.
 */
import { college } from '../college';
import { en } from './en';
import { ADDRESSES, BROCHURE_PDF, CAMPUSES, COLLEGE_CODE, FACULTY, FACULTY_GROUPS, media, WEBSITE } from './index';

const subjectOf = (g: string) => FACULTY_GROUPS.find((x) => x.key === g)!.subject;
type Area = 'classrooms' | 'labs' | 'library' | 'hostel' | 'sports' | 'events' | 'other';
const CAMPUS_LIFE_AREAS: Area[] = ['labs', 'classrooms', 'hostel', 'hostel', 'sports', 'other'];

const phones = college.phones.map((p) => p.display).join(' / ');

export const brochureDefaults = {
  faculty: {
    sample: false,
    items: FACULTY.map((f) => ({ name: f.name, subject: subjectOf(f.group), years: f.years, qualification: f.qualification, photoUrl: f.photo.src, expertise: f.expertise })),
    leadershipMessage: null,
  },

  parentFaqs: en.parents.items.map((i) => ({ q: i.q, a: i.a })),

  brochures: {
    sample: false,
    // The official brochure covers the two integrated programmes. TODO(college): Long Term brochures.
    urls: { 'iit-jee': BROCHURE_PDF, neet: BROCHURE_PDF, 'long-term-jee': null, 'long-term-neet': null } as Record<string, string | null>,
    downloads: [{ title: 'Bhargava Junior College brochure 2027-28 (official)', kind: 'brochure' as const, url: BROCHURE_PDF, gated: false }],
  },

  gallery: {
    sample: false,
    tourUrl: null,
    items: [
      ...media.campusLife.flatMap((pair, i) => pair.map((p, j) => ({ title: en.campusLife.blocks[i].captions[j], area: CAMPUS_LIFE_AREAS[i], imageUrl: p.src }))),
      { title: 'Bhargava Junior College campus', area: 'other' as Area, imageUrl: media.campusBuilding.src },
      ...media.campuses.map((p, i) => ({ title: `${en.campuses.items[i].name}, ${en.campuses.items[i].location}`, area: 'hostel' as Area, imageUrl: p.src })),
      ...media.different.map((p, i) => ({ title: i < 8 ? en.different.items[i].title : en.different.beyondTitle, area: (i === 7 || i === 8 ? 'sports' : 'classrooms') as Area, imageUrl: p.src })),
      ...[...media.parents.flat(), ...media.parentsExtra].map((p) => ({ title: p.alt.startsWith('Security') ? 'Campus security staff' : 'Classroom', area: (p.alt.startsWith('Security') ? 'other' : 'classrooms') as Area, imageUrl: p.src })),
      { title: en.courses.jee.label + ': JEE Main · JEE Advanced', area: 'classrooms' as Area, imageUrl: media.courses.jee.src },
      { title: en.courses.neet.label + ': NEET-UG', area: 'classrooms' as Area, imageUrl: media.courses.neet.src },
    ],
  },

  knowledge: [
    { title: 'Who is the chairman of Bhargava Junior College?', category: 'other', body: `${en.leadership.name}, ${en.leadership.role}. ${en.leadership.message.slice(1).join(' ')} Also in the college leadership: ${college.leader.name}, ${college.leader.credentials}.` },
    { title: 'Vision and mission of Bhargava Junior College', category: 'other', body: `Vision: ${en.leadership.vision}\nMission: ${en.leadership.mission.join(' ')}\n${en.leadership.closing.join(' ')} Motto: ${college.motto}. "${en.leadership.motto}".` },
    { title: 'Is the college recognised? What is the college code?', category: 'admissions', body: `${college.name} (${en.cover.society}) is ${en.cover.recognised.replace(/^Recognised/, 'recognised')}. It prepares students for ${en.cover.exams}. ${en.cover.eyebrow}.` },
    { title: 'What makes Bhargava different?', category: 'academics', body: `${en.different.intro}\n${en.different.items.map((x, i) => `${i + 1}. ${x.title}: ${x.body}`).join('\n')}\nBeyond Academics: ${en.different.beyond.map((b) => `${b.title}: ${b.body}`).join(' ')}\n${en.different.differenceTitle}: ${en.different.difference}` },
    { title: 'How many students are there per class?', category: 'academics', body: `A maximum of 40 students per classroom. ${en.different.items[2].body}` },
    ...en.parents.items.map((i) => ({ title: i.q, category: 'parents', body: i.a })),
    { title: 'Who are the faculty? (The Power Houses — MPC & BiPC)', category: 'academics', body: FACULTY_GROUPS.map((g, gi) => `${en.faculty.groups[gi]}: ${FACULTY.filter((f) => f.group === g.key).map((f) => `${f.name} (${f.qualification}, ${f.years}+ years, ${f.expertise})`).join('; ')}.`).join('\n') },
    { title: 'Engineering course: IIT-JEE two-year integrated programme', category: 'academics', body: `${en.courses.jee.label} · ${en.courses.jee.exams} · ${en.courses.jee.kind}. ${en.courses.jee.body}\n${en.courses.highlightsLabel}: ${en.courses.jee.highlights.map((h) => `${h.t}: ${h.b}`).join(' ')}` },
    { title: 'Medical course: NEET-UG two-year integrated programme', category: 'academics', body: `${en.courses.neet.label} · ${en.courses.neet.exams} · ${en.courses.neet.kind}. ${en.courses.neet.body}\n${en.courses.highlightsLabel}: ${en.courses.neet.highlights.map((h) => `${h.t}: ${h.b}`).join(' ')}` },
    { title: 'What is EVOLVE, the Bhargava learning model?', category: 'academics', body: `${en.evolve.intro}\n${en.evolve.steps.map((s, i) => `${'EVOLVE'[i]}: ${s.t}. ${s.b}`).join('\n')}` },
    { title: 'Campus life: labs, classrooms, hostel, mess, sports and environment', category: 'campus', body: `${en.campusLife.intro}\n${en.campusLife.blocks.map((b) => `${b.title} (${b.tagline}): ${b.body}`).join('\n')}\n${en.campusLife.closing}` },
    { title: 'How many campuses does Bhargava have?', category: 'campus', body: `${en.campuses.title} ${en.campuses.intro}\n${en.campuses.items.map((c) => `${c.name}, ${c.location}: ${c.tagline}`).join('\n')}\n${en.campuses.standardTitle}: ${en.campuses.standard}` },
    { title: 'Where is the girls hostel? (Girls Residential Campus, Bairamalguda)', category: 'hostel', body: `The girls' hostel is the ${en.campuses.items[0].name} at ${en.campuses.items[0].location}. Address: ${ADDRESSES[2].address}. ${en.campuses.items[0].tagline} ${en.campuses.items[0].features.join('; ')}. Directions: ${CAMPUSES[0].mapsUrl}` },
    { title: 'Where is the boys hostel? (Boys Residential Campus, Kuntloor)', category: 'hostel', body: `The boys' hostel is the ${en.campuses.items[1].name} at ${en.campuses.items[1].location}. Address: ${ADDRESSES[1].address}. ${en.campuses.items[1].tagline} ${en.campuses.items[1].features.join('; ')}. Directions: ${CAMPUSES[1].mapsUrl}` },
    { title: 'Where is the day scholar campus? (LB Nagar)', category: 'campus', body: `The ${en.campuses.items[2].name} is at ${en.campuses.items[2].location}. ${en.campuses.items[2].tagline} ${en.campuses.items[2].features.join('; ')}.` },
    { title: 'Address, phone and email of the college', category: 'other', body: `${en.contact.offices[0]}: ${ADDRESSES[0].address}.\n${en.contact.offices[1]}: ${ADDRESSES[1].address}.\n${en.contact.offices[2]}: ${ADDRESSES[2].address}.\nCall: ${phones}. Email: ${college.email}. Website: ${WEBSITE}. College code: ${COLLEGE_CODE}.` },
    { title: 'Where can I get the brochure?', category: 'admissions', body: `Download the official 2027-28 brochure (PDF, 8 pages) from the Downloads page or directly at ${BROCHURE_PDF}. You can also ask for it on WhatsApp.` },
  ].map((a) => ({ ...a, category: a.category as 'admissions' | 'academics' | 'hostel' | 'parents' | 'campus' | 'other', audience: 'public' as const, published: true })),
};
