/**
 * Demo data for local development: fills the local JSON store (.data/dev-db.json) so every CRM and app login
 * opens to believable work. Run: `npm run seed:demo` · `npm run seed:demo:reset` · `npm run seed:demo:clear`.
 *
 * Safety: refuses to run when NODE_ENV=production, or when .env.local / the environment has a Supabase
 * service-role key (the app would then be reading Supabase, possibly production, not this file).
 * Idempotent: every seeded row has an id starting with `demo-` (or `seedBatch: 'demo-2027'`); each run first
 * removes those rows, then writes them again. All dates are relative to the day it runs (India time).
 */
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
// @ts-ignore -- Node runs this file directly (type stripping), so the import needs the .ts extension.
import { QUESTIONS, chaptersOf } from '../lib/practice/bank.ts';

const SEED = 'demo-2027';
const ROOT = process.cwd();
/** DEMO_OUT: write to another file instead (used by seed-supabase.ts, which uploads that file). */
const FILE = process.env.DEMO_OUT ? path.resolve(process.env.DEMO_OUT) : path.join(ROOT, '.data', 'dev-db.json');
const mode = process.argv.includes('--clear') ? 'clear' : 'seed';

// ------------------------------------------------------------------ safety
function envLocal(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  const f = path.join(ROOT, '.env.local');
  if (!existsSync(f)) return '';
  const m = readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed: NODE_ENV=production.');
if (!process.env.DEMO_OUT && envLocal('SUPABASE_SERVICE_ROLE_KEY')) {
  throw new Error('Refusing to seed: a Supabase service-role key is set, so the app reads Supabase, not the local file. This seed only writes the local development store.');
}

// ------------------------------------------------------------------ helpers
let rnd = 20271;
const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
let seq = 0;
const did = (kind: string) => `demo-${kind}-${String(++seq).padStart(5, '0')}`;

const IST = 330 * 60_000;
const NOW = new Date();
const istNow = new Date(NOW.getTime() + IST);
const TODAY = istNow.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const day = (n: number) => addDays(TODAY, n);
/** ISO instant for an IST date + "HH:MM" */
const at = (d: string, hm: string) => new Date(Date.parse(`${d}T${hm}:00Z`) - IST).toISOString();
const atDay = (n: number, hm: string) => at(day(n), hm);
const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const randTime = () => hm(int(9, 18), int(0, 59));
/** an instant earlier today (before now) */
const earlierToday = (i: number) => new Date(Math.max(Date.parse(at(TODAY, '00:05')), NOW.getTime() - (i + 1) * 9 * 60_000)).toISOString();
const minsFromNow = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();
const SEASON = '2026-09-01';
const seasonDays = Math.max(1, Math.round((Date.parse(TODAY) - Date.parse(SEASON)) / 86_400_000));
const pastDay = (minAgo = 1, maxAgo = seasonDays) => -int(minAgo, Math.max(minAgo, maxAgo));
const phone = (n: number) => `+91${9000000000 + n}`;
const daysBack = (iso: string) => Math.round((Date.parse(TODAY) - Date.parse(iso.slice(0, 10))) / 86_400_000);

// ------------------------------------------------------------------ data pools
const FIRST_M = ['Rahul', 'Sai Kiran', 'Arjun', 'Karthik', 'Vikram', 'Harsha', 'Pranav', 'Rohith', 'Nikhil', 'Abhinav', 'Charan', 'Teja', 'Vamshi', 'Akhil', 'Srikar', 'Manish', 'Varun', 'Yashwanth', 'Sathvik', 'Bharath', 'Rakesh', 'Naveen', 'Ganesh', 'Lokesh'];
const FIRST_F = ['Sneha', 'Meghana', 'Ananya', 'Harika', 'Sravya', 'Keerthi', 'Divya', 'Pooja', 'Sahithi', 'Lasya', 'Bhavana', 'Navya', 'Tejaswini', 'Akshaya', 'Varshitha', 'Sindhu', 'Mounika', 'Spandana', 'Deepika', 'Manasa'];
const SURNAMES = ['Reddy', 'Rao', 'Goud', 'Varma', 'Naidu', 'Chowdary', 'Yadav', 'Sharma', 'Kumar', 'Prasad', 'Murthy', 'Achary', 'Chary', 'Patel', 'Gupta', 'Shetty'];
const FATHERS = ['Srinivas', 'Ramesh', 'Suresh', 'Venkatesh', 'Mahesh', 'Ravi', 'Krishna', 'Narasimha', 'Prakash', 'Satyanarayana', 'Raju', 'Anjaneyulu', 'Madhav', 'Shankar'];
const MOTHERS = ['Lakshmi', 'Padma', 'Sunitha', 'Kavitha', 'Swapna', 'Radha', 'Jyothi', 'Anitha', 'Sujatha', 'Vani', 'Rajeshwari', 'Saritha', 'Madhavi', 'Hymavathi'];
const AREAS = ['Saroornagar', 'LB Nagar', 'Dilsukhnagar', 'Vanasthalipuram', 'Hayathnagar', 'Kothapet'];
const SCHOOLS = [
  ['Green Valley High School', 'Saroornagar'], ['Sri Sai Vidyalaya', 'LB Nagar'], ['Little Flower EM School', 'Dilsukhnagar'], ['Sunrise Model School', 'Vanasthalipuram'],
  ['Vignan Bharathi High School', 'Hayathnagar'], ['Saraswathi Shishu Mandir EM', 'Kothapet'], ['Bright Future Public School', 'LB Nagar'], ['Gowtham Concept School', 'Dilsukhnagar'],
  ['St. Joseph Grammar School', 'Saroornagar'], ['Navodaya Talent School', 'Vanasthalipuram'], ['Krishnaveni Techno School', 'Hayathnagar'], ['Oxford Pearls High School', 'Kothapet'],
].map(([name, area]) => ({ name, area }));
const PROGRAMS = ['iit-jee', 'neet'] as const;
const COMPETITORS = ['Narayana Junior College', 'Sri Chaitanya Junior College', 'Local junior college'];

// ------------------------------------------------------------------ load
type Any = Record<string, any>;
mkdirSync(path.dirname(FILE), { recursive: true });
const db: Any = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8').replace(/^﻿/, '')) : {};
for (const k of ['leads', 'touchpoints', 'visits', 'bsat', 'otps', 'staff', 'calls', 'audit', 'importBatches', 'signOffs', 'documents', 'payments', 'students', 'reversals', 'waMessages', 'waInbound', 'waOptOuts', 'conversations', 'convMessages', 'assistantTurns', 'dailyReports', 'guardians', 'hostelEvents', 'staffAuth', 'loginAudit']) db[k] ??= [];
db.records ??= {};
db.counters ??= {};
db.seq ??= { bsat: 0 };

// ------------------------------------------------------------------ clear previous demo rows
const isDemo = (v: unknown) => typeof v === 'string' && v.startsWith('demo-');
const demoRow = (r: Any) => isDemo(r.id) || r.seedBatch === SEED || isDemo(r.leadId) || isDemo(r.studentId) || isDemo(r.conversationId);
for (const k of Object.keys(db)) if (Array.isArray(db[k])) db[k] = db[k].filter((r: Any) => !(r && typeof r === 'object' && demoRow(r)));
for (const c of Object.keys(db.records)) db.records[c] = db.records[c].filter((r: Any) => !isDemo(r.id) && r.seedBatch !== SEED);
for (const k of Object.keys(db.counters)) if (k.startsWith('college_id:2027:') || k.startsWith('receipt:2027')) delete db.counters[k];

function save() {
  const tmp = `${FILE}.seed.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE);
}
if (mode === 'clear') {
  save();
  console.log('Demo data cleared.');
  process.exit(0);
}

// ------------------------------------------------------------------ staff (22 built-in + 2 sample)
const ensureStaff = (id: string, fullName: string, roles: string[]) => {
  if (!db.staff.some((s: Any) => s.id === id)) db.staff.push({ id, fullName, roles, email: null, phone: null, active: true });
};
ensureStaff('demo-staff-english', 'M. Sujatha (English)', ['faculty']);
ensureStaff('demo-staff-librarian', 'G. Ramana (Librarian)', ['admin_office']);
const TELECALLERS = ['staff-priya', 'staff-ramesh', 'staff-divya'];
const ANIL = 'staff-anil';

// ------------------------------------------------------------------ record helper
function rec(collection: string, data: Any, k1: string | null, k2: string | null, createdAt = NOW.toISOString()) {
  const r = { id: did(collection.replace(/_/g, '')), collection, k1, k2, data, createdAt, updatedAt: createdAt, seedBatch: SEED };
  (db.records[collection] ??= []).push(r);
  return r;
}

// ------------------------------------------------------------------ leads
interface L extends Any { id: string }
const leads: L[] = [];
const audit = (leadId: string, action: string, iso: string, actorId: string | null, extra: Any = {}) =>
  db.audit.push({ id: did('audit'), leadId, actorId, action, field: extra.field ?? null, oldValue: extra.oldValue ?? null, newValue: extra.newValue ?? null, reason: extra.reason ?? null, at: iso, seedBatch: SEED });

function makeLead(o: Any): L {
  const created = o.createdAt as string;
  const l: L = {
    id: did('lead'), phone: o.phone, contactName: o.parentName, parentName: o.parentName, studentName: o.studentName, studentPhone: o.studentPhone ?? null,
    studentClass: 'Class 10', program: o.program, firstSource: o.source, lastSource: o.source, stage: o.stage ?? 'enquiry', status: o.status ?? 'open',
    consentAt: created, createdAt: created, updatedAt: created, school: o.school, board: 'SSC', area: o.area, category: o.category ?? null,
    ownerId: o.ownerId ?? null, assignedAt: null, nextFollowUpAt: o.nextFollowUpAt ?? null, lastContactAt: null, lostReason: o.lostReason ?? null,
    lostCompetitor: o.lostCompetitor ?? null, siblingOf: o.siblingOf ?? null, seedBatch: SEED,
  };
  leads.push(l);
  db.leads.push(l);
  db.touchpoints.push({ id: did('tp'), leadId: l.id, source: o.source, program: o.program, note: 'Sample data', utmSource: null, utmCampaign: null, page: null, device: null, createdAt: created, seedBatch: SEED });
  audit(l.id, 'created', created, null, { newValue: o.source });
  if (l.category) audit(l.id, 'qualified', o.qualifiedAt ?? new Date(Date.parse(created) + 3_600_000).toISOString(), 'staff-manager', { field: 'category', newValue: l.category });
  if (l.ownerId) {
    l.assignedAt = o.assignedAt ?? new Date(Date.parse(created) + 2 * 3_600_000).toISOString();
    audit(l.id, 'assigned', l.assignedAt, 'staff-manager', { field: 'owner', newValue: l.ownerId });
  }
  return l;
}
const stageChange = (l: L, stage: string, iso: string, actor: string) => {
  audit(l.id, 'stage_changed', iso, actor, { field: 'stage', oldValue: l.stage, newValue: stage });
  l.stage = stage;
};

// Source list: School data 120, Website 45, Chat 20, BSAT 25, Walk-in 15, Referral 10, WhatsApp 5 (240)
const SOURCES: string[] = [];
for (const [s, n] of [['school_data', 120], ['website', 45], ['chat', 20], ['bsat', 25], ['walk_in', 15], ['referral', 10], ['whatsapp', 5]] as const) for (let i = 0; i < n; i++) SOURCES.push(s);
// shuffle
for (let i = SOURCES.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [SOURCES[i], SOURCES[j]] = [SOURCES[j], SOURCES[i]]; }
let srcI = 0;
const nextSource = (prefer?: string) => {
  if (prefer) { const j = SOURCES.indexOf(prefer, srcI); if (j >= 0) { [SOURCES[srcI], SOURCES[j]] = [SOURCES[j], SOURCES[srcI]]; } }
  return SOURCES[srcI++];
};

let generic = 0;
function person(gender?: 'm' | 'f') {
  const g = gender ?? (rand() < 0.55 ? 'm' : 'f');
  const sur = pick(SURNAMES);
  const school = pick(SCHOOLS);
  generic++;
  return { gender: g, studentName: `${pick(g === 'm' ? FIRST_M : FIRST_F)} ${sur}`, parentName: `${pick(FATHERS)} ${sur}`, mother: `${pick(MOTHERS)} ${sur}`, phone: phone(1000 + generic), school: school.name, area: school.area };
}
const createdPast = (minAgo = 2) => atDay(pastDay(minAgo, seasonDays), randTime());

// ---- core story leads -------------------------------------------------------
const rahulLead = makeLead({ phone: phone(1), parentName: 'K. Srinivas', studentName: 'Rahul Kumar K.', studentPhone: phone(101), program: 'iit-jee', source: nextSource('school_data'), school: 'Green Valley High School', area: 'Saroornagar', category: 'hot', ownerId: 'staff-priya', createdAt: atDay(-62, '10:20') });
const ananyaLead = makeLead({ phone: phone(1), parentName: 'K. Srinivas', studentName: 'Ananya Kumar K.', studentPhone: phone(102), program: 'neet', source: nextSource('referral'), school: 'Green Valley High School', area: 'Saroornagar', category: 'hot', ownerId: 'staff-priya', createdAt: atDay(-60, '11:00'), siblingOf: rahulLead.id });
const sneha = makeLead({ phone: phone(201), parentName: 'Venkat Reddy', studentName: 'Sneha Reddy', program: 'neet', source: nextSource('bsat'), school: 'Sri Sai Vidyalaya', area: 'LB Nagar', category: 'hot', ownerId: 'staff-priya', createdAt: atDay(-12, '16:40'), status: 'visit_scheduled' });
const arjun = makeLead({ phone: phone(305), parentName: 'Prasad Varma', studentName: 'Arjun Varma', program: 'iit-jee', source: nextSource('website'), school: 'Little Flower EM School', area: 'Dilsukhnagar', category: 'warm', ownerId: 'staff-ramesh', createdAt: atDay(-30, '12:15') });
const meghana = makeLead({ phone: phone(412), parentName: 'Ravi P.', studentName: 'Meghana P.', program: 'neet', source: nextSource('website'), school: 'Sunrise Model School', area: 'Vanasthalipuram', category: 'hot', ownerId: 'staff-divya', createdAt: atDay(-20, '09:45') });
const karthik = makeLead({ phone: phone(519), parentName: 'Naresh N.', studentName: 'Karthik N.', program: 'iit-jee', source: nextSource('school_data'), school: 'Vignan Bharathi High School', area: 'Hayathnagar', category: 'hot', ownerId: 'staff-divya', createdAt: atDay(-25, '14:30') });
const vikram = makeLead({ phone: phone(627), parentName: 'Suresh S.', studentName: 'Vikram S.', program: 'iit-jee', source: nextSource('website'), school: 'Bright Future Public School', area: 'LB Nagar', category: 'warm', ownerId: 'staff-ramesh', createdAt: atDay(-9, '15:10'), nextFollowUpAt: atDay(-3, '11:00') });

// ---- 40 admitted students (Rahul + Ananya + 38) ----------------------------
const admittedLeads: L[] = [rahulLead, ananyaLead];
for (let i = 0; i < 38; i++) {
  const p = person(i < 22 ? 'm' : 'f');
  admittedLeads.push(makeLead({ ...p, program: null, source: nextSource(), category: rand() < 0.6 ? 'hot' : 'warm', ownerId: TELECALLERS[i % 3], createdAt: atDay(pastDay(25, seasonDays), randTime()) }));
}
// programs: 20 JEE (Rahul first), 20 NEET (Ananya = NEET #4)
const jeeLeads = [rahulLead, ...admittedLeads.slice(2, 21)];
const neetLeads = [...admittedLeads.slice(21, 24), ananyaLead, ...admittedLeads.slice(24)];
for (const l of jeeLeads) l.program = 'iit-jee';
for (const l of neetLeads) l.program = 'neet';

// ---- 6 in verification (Karthik + 2 confirmed today + 3) -------------------
const verifyLeads: L[] = [karthik];
for (let i = 0; i < 5; i++) { const p = person(); verifyLeads.push(makeLead({ ...p, program: pick(PROGRAMS), source: nextSource(), category: 'hot', ownerId: TELECALLERS[i % 3], createdAt: atDay(pastDay(15, 50), randTime()) })); }

// ---- 22 lost (Arjun + 21), reasons fees 7, distance 5, competitor 4, hostel 3, results 2, other 1
const LOST_PLAN = ['fees', 'fees', 'fees', 'fees', 'fees', 'fees', 'distance', 'distance', 'distance', 'distance', 'distance', 'competitor', 'competitor', 'competitor', 'competitor', 'hostel', 'hostel', 'hostel', 'results_doubt', 'results_doubt', 'other'];
const lostLeads: L[] = [arjun];
for (let i = 0; i < 21; i++) { const p = person(); lostLeads.push(makeLead({ ...p, program: pick(PROGRAMS), source: nextSource(), category: pick(['warm', 'cold', 'warm']), ownerId: TELECALLERS[i % 3], createdAt: atDay(pastDay(6, seasonDays), randTime()) })); }

// ---- 9 pending decisions (Meghana + 8), owner Anil
const pendingLeads: L[] = [meghana];
for (let i = 0; i < 8; i++) { const p = person(); pendingLeads.push(makeLead({ ...p, program: pick(PROGRAMS), source: nextSource(), category: pick(['hot', 'warm']), ownerId: TELECALLERS[i % 3], createdAt: atDay(pastDay(8, 50), randTime()) })); }

// ---- 15 invalid
const invalidLeads: L[] = [];
for (let i = 0; i < 15; i++) { const p = person(); invalidLeads.push(makeLead({ ...p, program: pick(PROGRAMS), source: nextSource(), category: 'invalid', status: 'invalid', ownerId: null, createdAt: createdPast(3) })); }

// ---- today's 12 leads: 10 qualified + allocated (4 hot, 4 warm, 2 cold), 2 unqualified unassigned
const todayLeads: L[] = [];
const TODAY_CATS = ['hot', 'hot', 'hot', 'hot', 'warm', 'warm', 'warm', 'warm', 'cold', 'cold', null, null];
TODAY_CATS.forEach((cat, i) => {
  const p = person();
  const created = earlierToday(40 + i * 2);
  const src = cat ? nextSource() : 'school_data';
  if (!cat) { const j = SOURCES.indexOf('school_data', srcI); if (j >= 0) SOURCES.splice(j, 1); }
  todayLeads.push(makeLead({ ...p, program: pick(PROGRAMS), source: src, category: cat, ownerId: cat ? TELECALLERS[i % 3] : null, createdAt: created, qualifiedAt: new Date(Date.parse(created) + 5 * 60_000).toISOString(), assignedAt: new Date(Date.parse(created) + 10 * 60_000).toISOString() }));
});

// ---- 23 more unqualified (25 total), school_data, unassigned (awaiting: imported, not yet classified)
const unqualified: L[] = [];
for (let i = 0; i < 23; i++) { const p = person(); const j = SOURCES.indexOf('school_data', srcI); if (j >= 0) SOURCES.splice(j, 1); unqualified.push(makeLead({ ...p, program: pick(PROGRAMS), source: 'school_data', category: null, ownerId: null, createdAt: atDay(pastDay(1, 6), randTime()) })); }
// ---- 6 classified but not yet allocated (imported)
const unassigned: L[] = [];
for (let i = 0; i < 6; i++) { const p = person(); const j = SOURCES.indexOf('school_data', srcI); if (j >= 0) SOURCES.splice(j, 1); unassigned.push(makeLead({ ...p, program: pick(PROGRAMS), source: 'school_data', category: pick(['warm', 'cold']), ownerId: null, createdAt: atDay(pastDay(1, 4), randTime()) })); }

// ---- the rest: open, assigned leads → 240 total
const openLeads: L[] = [vikram];
const CAT_LEFT = { hot: 50, warm: 80, cold: 70 } as Record<string, number>;
for (const l of leads) if (l.category && CAT_LEFT[l.category] !== undefined) CAT_LEFT[l.category]--;
while (leads.length < 240) {
  const p = person();
  const cat = CAT_LEFT.cold > 0 && rand() < 0.45 ? 'cold' : CAT_LEFT.warm > 0 ? 'warm' : CAT_LEFT.hot > 0 ? 'hot' : 'cold';
  CAT_LEFT[cat]--;
  openLeads.push(makeLead({ ...p, program: pick(PROGRAMS), source: SOURCES[srcI++] ?? 'website', category: cat, ownerId: TELECALLERS[openLeads.length % 3], createdAt: createdPast(2) }));
}

// ------------------------------------------------------------------ follow-ups (open leads)
const ownerOf = (l: L) => l.ownerId as string;
const dueToday = (i: number) => {
  const left = Math.max(15, Math.floor((Date.parse(at(TODAY, '23:50')) - NOW.getTime()) / 60_000));
  return minsFromNow(Math.min(left, 10 + i * Math.max(1, Math.floor(left / 16))));
};
const openAssigned = openLeads.filter((l) => l !== vikram);
const plan: Record<string, { today: number; overdue: number[] }> = {
  'staff-priya': { today: 7, overdue: [5, 30, 52] },
  'staff-ramesh': { today: 3, overdue: [6, 50, 20] },
  'staff-divya': { today: 4, overdue: [3, 8] },
};
let dt = 0;
for (const [owner, p] of Object.entries(plan)) {
  const mine = openAssigned.filter((l) => l.ownerId === owner && !todayLeads.includes(l));
  let k = 0;
  for (let i = 0; i < p.today; i++) mine[k++].nextFollowUpAt = dueToday(dt++);
  for (const h of p.overdue) mine[k++].nextFollowUpAt = new Date(NOW.getTime() - h * 3_600_000).toISOString();
  for (; k < mine.length; k++) mine[k].nextFollowUpAt = atDay(int(1, 10), hm(int(10, 18), 0));
}
for (const l of todayLeads) if (l.ownerId) l.nextFollowUpAt = atDay(int(1, 3), '11:00');

// ------------------------------------------------------------------ calls (600 total, 26 today)
const OUTCOMES: string[] = [];
for (const [o, n] of [['connected', 55], ['not_answered', 25], ['busy', 8], ['switched_off', 7], ['wrong_number', 5]] as const) for (let i = 0; i < n; i++) OUTCOMES.push(o);
const NOTES = ['Parent asked about hostel fees', 'Interested in BSAT scholarship', 'Will discuss with family and call back', 'Asked for campus visit slots', 'Comparing with another college', 'Wants details of JEE results', 'Asked about transport route', 'Call back in the evening'];
function addCall(l: L, iso: string, actor: string, outcome: string, interest: string | null) {
  db.calls.push({ id: did('call'), leadId: l.id, actorId: actor, outcome, interest, notes: outcome === 'connected' ? pick(NOTES) : null, nextFollowUpAt: l.nextFollowUpAt, createdAt: iso, seedBatch: SEED });
  audit(l.id, 'call_logged', iso, actor, { newValue: outcome });
  if (!l.lastContactAt || l.lastContactAt < iso) l.lastContactAt = iso;
}
// today: 26 calls; hot/warm interest only on the 8 qualified-today hot/warm leads
const interestedToday = todayLeads.filter((l) => l.category === 'hot' || l.category === 'warm');
const otherToday = [...todayLeads.filter((l) => l.category === 'cold'), ...openAssigned.filter((l) => !todayLeads.includes(l)).slice(0, 30)];
for (let i = 0; i < 26; i++) {
  const iso = earlierToday(i);
  if (i < 8) addCall(interestedToday[i], iso, ownerOf(interestedToday[i]), 'connected', interestedToday[i].category);
  else { const l = otherToday[i - 8]; const o = pick(OUTCOMES.filter((x) => x !== 'wrong_number')); addCall(l, iso, ownerOf(l), o, null); }
}
// past: 574 calls
const callable = leads.filter((l) => l.ownerId && !todayLeads.includes(l) && l.status !== 'invalid');
for (let i = 0; i < 574; i++) {
  const l = callable[i % callable.length];
  const ago = daysBack(l.createdAt);
  if (ago < 1) continue;
  const d = -int(1, Math.max(1, ago - 1 > 0 ? ago - 1 : 1));
  const o = pick(OUTCOMES);
  addCall(l, atDay(d, randTime()), ownerOf(l), o === 'wrong_number' && l.status !== 'invalid' ? 'busy' : o, o === 'connected' ? l.category : null);
}
// top up to exactly 600 if any were skipped
while (db.calls.filter((c: Any) => c.seedBatch === SEED).length < 600) { const l = callable[int(0, callable.length - 1)]; addCall(l, atDay(-1, randTime()), ownerOf(l), 'connected', l.category); }

// ------------------------------------------------------------------ visits, counselling, decisions
const SLOTS = ['10:00', '11:30', '14:00', '15:30'];
function addVisit(l: L, date: string, slot: string, status: string, createdAt: string) {
  const v = { id: did('visit'), leadId: l.id, date, slot, familySize: int(2, 4), program: l.program, status, outcome: null as string | null, outcomeAt: null as string | null, outcomeBy: null as string | null, createdAt, seedBatch: SEED };
  db.visits.push(v);
  audit(l.id, 'visit_booked', createdAt, l.ownerId, { newValue: `${date} ${slot}` });
  return v;
}
const counsellingRecs: { lead: L; decision: string; at: string }[] = [];
function counsel(l: L, iso: string, decision: 'confirmed' | 'pending' | 'lost') {
  audit(l.id, 'counselled', iso, ANIL);
  stageChange(l, 'counselling', iso, ANIL);
  counsellingRecs.push({ lead: l, decision, at: iso });
}
function decide(l: L, iso: string, decision: 'confirmed' | 'lost' | 'decision_pending', reason?: string) {
  audit(l.id, 'decision', iso, ANIL, { field: 'status', oldValue: l.status, newValue: decision === 'decision_pending' ? 'decision_pending' : decision, reason: reason ?? null });
  l.status = decision;
  if (decision === 'lost') { l.lostReason = reason; if (reason === 'competitor') l.lostCompetitor = pick(COMPETITORS); l.nextFollowUpAt = null; }
}
function pastVisit(l: L, dAgo: number, outcome: 'completed' | 'no_show') {
  const date = day(-dAgo);
  const v = addVisit(l, date, pick(SLOTS), outcome, atDay(-dAgo - int(2, 5), randTime()));
  if (outcome === 'completed') {
    audit(l.id, 'visit_arrived', at(date, v.slot), 'staff-frontdesk');
    v.outcome = 'Family toured campus and met faculty'; v.outcomeAt = at(date, '17:00'); v.outcomeBy = 'staff-frontdesk';
    audit(l.id, 'visit_completed', v.outcomeAt, 'staff-frontdesk');
    stageChange(l, 'visit', at(date, v.slot), 'staff-frontdesk');
  } else {
    v.outcome = 'Did not arrive'; v.outcomeAt = at(date, '18:00'); v.outcomeBy = 'staff-frontdesk';
    audit(l.id, 'visit_no_show', v.outcomeAt, 'staff-frontdesk');
  }
  return v;
}
const ago = (l: L, minDays: number) => Math.max(minDays, Math.min(daysBack(l.createdAt) - 1, minDays + 20));

// 48 completed past visits: 9 pending + 6 verification + 12 lost + 21 admitted
for (const l of pendingLeads) { const d = ago(l, 3); pastVisit(l, d, 'completed'); counsel(l, atDay(-d, '16:00'), 'pending'); decide(l, atDay(-d, '16:30'), 'decision_pending'); l.ownerId = ANIL; audit(l.id, 'reassigned', atDay(-d, '16:31'), 'staff-manager', { field: 'owner', newValue: ANIL }); l.nextFollowUpAt = atDay(int(1, 4), '11:00'); }
meghana.nextFollowUpAt = atDay(1, '11:00');
const todayConfirmed = verifyLeads.slice(1, 3);
for (const l of verifyLeads) {
  const d = ago(l, 6);
  pastVisit(l, d, 'completed');
  counsel(l, atDay(-d, '16:00'), 'confirmed');
  if (todayConfirmed.includes(l)) { decide(l, atDay(-d, '16:30'), 'decision_pending'); decide(l, earlierToday(3 + todayConfirmed.indexOf(l)), 'confirmed'); }
  else decide(l, atDay(-d + 1, '12:00'), 'confirmed');
  l.ownerId = ANIL; l.nextFollowUpAt = atDay(int(1, 3), '12:00');
}
const lostToday = lostLeads[1];
lostLeads.forEach((l, i) => {
  const reason = i === 0 ? 'fees' : LOST_PLAN[i - 1];
  if (i < 13) { const d = ago(l, 3); pastVisit(l, d, 'completed'); counsel(l, atDay(-d, '16:00'), 'lost'); }
  if (l === lostToday) decide(l, earlierToday(6), 'lost', reason);
  else decide(l, atDay(-int(2, Math.max(2, Math.min(40, daysBack(l.createdAt) - 1))), '17:30'), 'lost', reason);
});
arjun.lostCompetitor = 'Narayana Junior College';
admittedLeads.forEach((l, i) => {
  const d = Math.max(20, Math.min(daysBack(l.createdAt) - 2, 45));
  if (i < 21) pastVisit(l, d, 'completed');
  counsel(l, atDay(-d, '16:00'), 'confirmed');
  decide(l, atDay(-d, '16:40'), 'confirmed');
});
// 7 no-shows on open leads (follow-up kept)
openAssigned.slice(40, 47).forEach((l) => pastVisit(l, int(2, 20), 'no_show'));

// today's 5 visits (booked today): 3 arrived (Sneha + 2) and counselled, 2 still expected
const todayVisitLeads = [sneha, ...openAssigned.filter((l) => l.category === 'hot' && !todayLeads.includes(l) && l.nextFollowUpAt! > atDay(1, '00:00')).slice(0, 4)];
todayVisitLeads.forEach((l, i) => {
  const slot = i === 0 ? '11:30' : SLOTS[i % SLOTS.length];
  const v = addVisit(l, TODAY, slot, i < 3 ? 'arrived' : 'scheduled', earlierToday(20 + i));
  l.status = 'visit_scheduled';
  if (i < 3) {
    const arr = earlierToday(10 + i);
    audit(l.id, 'visit_arrived', arr, 'staff-frontdesk');
    stageChange(l, 'visit', arr, 'staff-frontdesk');
    counsel(l, earlierToday(7 + i), 'pending');
    l.status = 'counselled';
  }
  l.nextFollowUpAt = atDay(1, '12:00');
  void v;
});
// 10 upcoming visits
openAssigned.filter((l) => !todayVisitLeads.includes(l) && !todayLeads.includes(l) && !db.visits.some((v: Any) => v.leadId === l.id)).slice(0, 10).forEach((l, i) => { addVisit(l, day(1 + (i % 6)), SLOTS[i % 4], 'scheduled', atDay(-int(1, 4), randTime())); l.status = 'visit_scheduled'; });

// ------------------------------------------------------------------ verification, students, fees
const SIGN_ACTORS: Record<string, string> = { application: ANIL, documents: 'staff-office', fee: 'staff-accounts', receipt: 'staff-accounts', student_record: 'staff-adminoffice', college_id: 'staff-adminoffice' };
const DOCS = ['ssc_memo', 'tc', 'study_certificate', 'aadhaar', 'photos'];
const signOff = (l: L, stage: string, iso: string) => { db.signOffs.push({ leadId: l.id, stage, signedOffBy: SIGN_ACTORS[stage], at: iso, note: 'Sample data', seedBatch: SEED }); stageChange(l, stage, iso, SIGN_ACTORS[stage]); };
const docs = (l: L, iso: string, status: string) => {
  for (const k of DOCS) db.documents.push({ leadId: l.id, key: k, status, note: null, updatedBy: 'staff-office', updatedAt: iso, seedBatch: SEED });
  db.documents.push({ leadId: l.id, key: 'caste_income', status: 'not_applicable', note: null, updatedBy: 'staff-office', updatedAt: iso, seedBatch: SEED });
};
let receiptSeq = 0;
const receipt = () => `BJC/2027-28/${String(++receiptSeq).padStart(5, '0')}`;
function pay(l: L, amount: number, iso: string, status: 'approved' | 'pending_approval', mode = 'upi', withReceipt = true) {
  const p = { id: did('pay'), leadId: l.id, amount, mode, reference: mode === 'cash' ? null : `UTR${int(100000000, 999999999)}`, paidOn: iso.slice(0, 10), status, recordedBy: 'staff-accounts', recordedAt: iso, approvedBy: status === 'approved' ? 'staff-accounts' : null, approvedAt: status === 'approved' ? iso : null, receiptNo: status === 'approved' && withReceipt ? receipt() : null, receiptAt: status === 'approved' && withReceipt ? iso : null, seedBatch: SEED };
  db.payments.push(p);
  return p;
}

// Verification queue: different steps. Karthik = application + documents done, fee not confirmed.
verifyLeads.forEach((l, i) => {
  const base = -5;
  if (i === 0) { signOff(l, 'application', atDay(base, '11:00')); docs(l, atDay(base + 1, '12:00'), 'verified'); signOff(l, 'documents', atDay(base + 1, '12:30')); pay(l, 75000, atDay(-1, '15:00'), 'pending_approval', 'cash'); }
  else if (i === 1 || i === 2) { /* confirmed today, nothing signed yet */ }
  else if (i === 3) { signOff(l, 'application', atDay(base, '11:00')); docs(l, atDay(base, '12:00'), 'received'); }
  else if (i === 4) { signOff(l, 'application', atDay(base, '11:00')); docs(l, atDay(base, '12:00'), 'verified'); signOff(l, 'documents', atDay(base, '13:00')); pay(l, 80000, atDay(-1, '16:20'), 'pending_approval', 'cheque'); }
  else { signOff(l, 'application', atDay(base, '11:00')); docs(l, atDay(base, '12:00'), 'verified'); signOff(l, 'documents', atDay(base, '13:00')); pay(l, 75000, atDay(-3, '10:00'), 'approved'); signOff(l, 'fee', atDay(-3, '10:30')); signOff(l, 'receipt', atDay(-3, '10:31')); }
});

// Students
const students: Any[] = [];
const FEE_TOTAL = { hostel: 234500, day: 165000 };
const BOYS_HOSTEL = 16, GIRLS_HOSTEL = 8;
let bh = 0, gh = 0;
const allStudents = [...jeeLeads, ...neetLeads];
const gender = (l: L) => (FIRST_F.some((f) => (l.studentName as string).startsWith(f)) ? 'female' : 'male');
let jSeq = 0, nSeq = 0;
allStudents.forEach((l, idx) => {
  const g = l === ananyaLead ? 'female' : l === rahulLead ? 'male' : gender(l);
  let stay: 'hostel' | 'day' = 'day';
  if (l === rahulLead) { stay = 'hostel'; bh++; }
  else if (l !== ananyaLead) { if (g === 'male' && bh < BOYS_HOSTEL) { stay = 'hostel'; bh++; } else if (g === 'female' && gh < GIRLS_HOSTEL) { stay = 'hostel'; gh++; } }
  const isJ = l.program === 'iit-jee';
  const n = isJ ? ++jSeq : ++nSeq;
  const collegeId = `BJC-2027-${isJ ? 'JEE' : 'NEET'}-${String(n).padStart(4, '0')}`;
  const d0 = -Math.max(15, Math.min(daysBack(l.createdAt) - 3, 40));
  signOff(l, 'application', atDay(d0, '11:00'));
  docs(l, atDay(d0, '12:00'), 'verified');
  signOff(l, 'documents', atDay(d0, '12:30'));
  pay(l, 75000, atDay(d0, '13:00'), 'approved');
  signOff(l, 'fee', atDay(d0, '13:30'));
  signOff(l, 'receipt', atDay(d0, '13:31'));
  const s = { id: did('stu'), leadId: l.id, fullName: l.studentName, dob: `2010-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`, gender: g, program: l.program, stay, guardianName: l.parentName, guardianPhone: l.phone, loginPhone: l === rahulLead ? phone(101) : l === ananyaLead ? phone(102) : phone(3000 + idx), collegeId, createdBy: 'staff-adminoffice', createdAt: atDay(d0 + 1, '10:00'), seedBatch: SEED };
  signOff(l, 'student_record', atDay(d0 + 1, '10:00'));
  signOff(l, 'college_id', atDay(d0 + 1, '10:05'));
  audit(l.id, 'status_changed', atDay(d0 + 1, '10:05'), 'staff-adminoffice', { field: 'status', oldValue: 'confirmed', newValue: 'admitted' });
  l.status = 'admitted'; l.nextFollowUpAt = null;
  db.students.push(s);
  students.push({ ...s, lead: l, d0 });
});
db.counters['college_id:2027:JEE'] = 20;
db.counters['college_id:2027:NEET'] = 20;
const rahul = students[0];
const ananya = students.find((s) => s.lead === ananyaLead)!;
ananya.stay = 'day';

// Guardians: father + mother each (Rahul & Ananya share parents)
for (const s of students) {
  const sur = (s.fullName as string).split(' ').slice(1).join(' ') || 'Rao';
  const mother = s.lead === rahulLead || s.lead === ananyaLead ? { name: 'K. Lakshmi', phone: phone(11) } : { name: `${pick(MOTHERS)} ${sur}`, phone: phone(2000 + students.indexOf(s)) };
  db.guardians.push({ studentId: s.id, phone: s.guardianPhone, name: s.guardianName, relation: 'father', addedBy: 'staff-adminoffice', addedAt: s.createdAt, seedBatch: SEED });
  db.guardians.push({ studentId: s.id, phone: mother.phone, name: mother.name, relation: 'mother', addedBy: 'staff-adminoffice', addedAt: s.createdAt, seedBatch: SEED });
}

// Fees: schedules + further payments; 3 approvals today = ₹2,45,000; 6 defaulters
const todayPayers = students.slice(5, 8);
const TODAY_AMOUNTS = [95000, 75000, 75000];
const defaulters = students.slice(10, 16);
students.forEach((s, i) => {
  const total = s === rahul ? 234500 : FEE_TOTAL[s.stay as 'hostel' | 'day'];
  const second = s === rahul ? 114500 : todayPayers.includes(s) ? TODAY_AMOUNTS[todayPayers.indexOf(s)] : Math.round((total - 75000) * 0.6 / 500) * 500;
  const third = total - 75000 - second;
  const items = [
    { due: day(s.d0), amount: 75000, label: 'Admission & first term' },
    { due: defaulters.includes(s) ? day(-int(5, 20)) : todayPayers.includes(s) ? TODAY : day(-int(5, 12)), amount: second, label: 'Second instalment' },
    { due: s === rahul ? '2026-12-10' : day(int(25, 40)), amount: third, label: 'Third instalment' },
  ];
  rec('fee_schedules', { studentId: s.id, leadId: s.leadId, items, createdBy: 'staff-accounts' }, s.id, s.leadId, s.createdAt);
  if (todayPayers.includes(s)) pay(s.lead, second, earlierToday(12 + i), 'approved', 'upi');
  else if (!defaulters.includes(s)) pay(s.lead, second, atDay(-int(2, 12), '12:00'), 'approved', pick(['upi', 'card', 'netbanking']));
});
if (rahul.d0) { /* Rahul paid 75,000 + 1,14,500 = 1,89,500; due 45,000 on 10 Dec */ }

// Scholarships (BSAT slabs) for 18 students
students.slice(0, 18).forEach((s, i) => {
  const pct = [10, 15, 25, 45][i % 4];
  rec('fee_requests', { kind: 'concession', leadId: s.leadId, amount: Math.round(60000 * pct / 100), percentOfTuition: pct, reason: `BSAT scholarship slab ${pct}% (sample data)`, status: 'approved', level: 'slab', requestedBy: ANIL, decidedBy: 'staff-accounts', decidedAt: atDay(s.d0, '15:00'), note: null }, 'approved', s.leadId);
});

// BSAT: Sneha hall ticket + result
db.bsat.push({ id: did('bsat'), leadId: sneha.id, sessionId: 'bsat-2026-11-16', stream: 'neet', hallTicket: 'BSAT-27-1042', createdAt: atDay(-12, '16:45'), seedBatch: SEED });
rec('applications', { leadId: sneha.id, studentName: 'Sneha Reddy', dob: '2010-04-12', gender: 'female', program: 'neet', stay: 'hostel', school: 'Sri Sai Vidyalaya', board: 'SSC', sscMarks: 'BSAT 82% · 45% scholarship', parentName: 'Venkat Reddy', parentPhone: sneha.phone, address: 'Plot 12, Karmanghat, LB Nagar, Hyderabad' , submittedAt: atDay(-2, '19:00') }, sneha.id, 'submitted');

// Import history (2 past CSV imports)
db.importBatches.push({ id: did('import'), fileName: 'green-valley-class10.csv', source: 'school_data', actorId: 'staff-manager', totalRows: 64, invalid: 3, duplicatesInFile: 2, created: 59, merged: 0, createdAt: atDay(-40, '11:00'), seedBatch: SEED });
db.importBatches.push({ id: did('import'), fileName: 'school-drive-november.csv', source: 'school_data', actorId: 'staff-manager', totalRows: 33, invalid: 2, duplicatesInFile: 2, created: 29, merged: 0, createdAt: atDay(-3, '10:15'), seedBatch: SEED });

// Counselling records (48 + today's 3), 10 with parent counselling guide answers
counsellingRecs.slice(0, 51).forEach((c, i) => {
  rec('counselling', { leadId: c.lead.id, counsellorId: ANIL, programDiscussed: c.lead.program ?? 'iit-jee', feesExplained: true, scholarshipExplained: true, concerns: pick(['Hostel food and safety', 'Fees in instalments', 'Distance from home', 'Past JEE/NEET results', null]), decision: c.decision, notes: 'Sample data — counselling with parents.' }, c.lead.id, ANIL, c.at);
  void i;
});

// ------------------------------------------------------------------ academics
const byProgram = (p: string) => students.filter((s) => s.program === p);
const jee = byProgram('iit-jee'), neet = byProgram('neet');
const BATCHES = [
  { name: 'JEE-A', program: 'iit-jee', section: 'A', teacher: 'staff-naresh', studs: jee.slice(0, 10) },
  { name: 'JEE-B', program: 'iit-jee', section: 'B', teacher: 'staff-krishna', studs: jee.slice(10) },
  { name: 'NEET-A', program: 'neet', section: 'A', teacher: 'staff-swathi', studs: neet.slice(0, 10) },
  { name: 'NEET-B', program: 'neet', section: 'B', teacher: 'staff-radhika', studs: neet.slice(10) },
].map((b) => ({ ...b, rec: rec('batches', { name: b.name, program: b.program, year: 1, section: b.section, capacity: 40, classTeacherId: b.teacher, studentIds: b.studs.map((s) => s.id), active: true }, b.program, b.teacher, atDay(-45, '09:00')) }));
const [JA, JB, NA, NB] = BATCHES;
for (const b of BATCHES) for (const s of b.studs) s.batchId = b.rec.id;
const FAC = { Physics: 'staff-krishna', Chemistry: 'staff-radhika', Mathematics: 'staff-naresh', Biology: 'staff-swathi' } as Record<string, string>;
const PERIODS: [string, string, [typeof JA, string][]][] = [
  ['08:30', '09:30', [[JA, 'Physics'], [JB, 'Chemistry'], [NA, 'Biology']]],
  ['09:30', '10:30', [[JA, 'Mathematics'], [JB, 'Physics'], [NA, 'Chemistry'], [NB, 'Biology']]],
  ['10:45', '11:45', [[JA, 'Chemistry'], [JB, 'Mathematics'], [NA, 'Physics'], [NB, 'Biology']]],
  ['11:45', '12:45', [[JA, 'Mathematics'], [JB, 'Chemistry'], [NA, 'Biology'], [NB, 'Physics']]],
  ['14:00', '15:00', [[JA, 'Physics'], [JB, 'Mathematics'], [NA, 'Biology'], [NB, 'Chemistry']]],
];
for (let d = 1; d <= 6; d++) for (const [start, end, rows] of PERIODS) for (const [b, subject] of rows) rec('timetable', { batchId: b.rec.id, day: d, start, end, subject, facultyId: FAC[subject], room: `R-${b.name}` }, b.rec.id, FAC[subject]);

// Attendance: 50 school days (Mon–Sat). Rahul 47/50 = 94%; 5 students below 75%.
const schoolDays: string[] = [];
for (let n = 0; schoolDays.length < 50; n++) { const d = day(-n); if (new Date(d + 'T00:00:00Z').getUTCDay() !== 0) schoolDays.push(d); }
const lowAttendance = [jee[3], jee[12], neet[2], neet[11], neet[16]];
const absences = new Map<string, Set<string>>();
for (const s of students) {
  const n = s === rahul ? 3 : lowAttendance.includes(s) ? 14 : int(1, 6);
  const set = new Set<string>();
  while (set.size < n) set.add(schoolDays[int(1, schoolDays.length - 1)]);
  absences.set(s.id, set);
}
for (const b of BATCHES) for (const d of schoolDays) {
  if (d === TODAY && b === NB) continue; // NEET-B not marked yet today (shows as a task)
  const marks: Record<string, string> = {};
  for (const s of b.studs) marks[s.id] = absences.get(s.id)!.has(d) ? 'absent' : 'present';
  rec('attendance', { batchId: b.rec.id, date: d, period: 'day', marks, markedBy: b.teacher, notifiedAbsent: Object.keys(marks).filter((k) => marks[k] === 'absent') }, b.rec.id, d, at(d, '09:05'));
}

// Tests: 6 weekly + 1 mock per batch (published), 3 upcoming
const subjectsOf = (p: string) => (p === 'iit-jee' ? ['Physics', 'Chemistry', 'Mathematics'] : ['Physics', 'Chemistry', 'Biology']);
for (const b of BATCHES) {
  const subs = subjectsOf(b.program);
  for (let t = 1; t <= 7; t++) {
    const mock = t === 7;
    const date = mock ? day(-3) : day(-7 * (7 - t) - 4);
    const max = mock && b.program === 'neet' ? 720 : 300;
    const test = rec('tests', { batchId: b.rec.id, title: mock ? `${b.program === 'neet' ? 'NEET' : 'JEE Main'} Mock Test 1` : `Weekly Test ${t}`, date, mode: 'offline', durationMin: 180, maxMarks: max, subjects: subs, questions: [], published: true, createdBy: 'staff-exam' }, b.rec.id, date, at(date, '08:00'));
    const per = max / subs.length;
    for (const s of b.studs) {
      const bySubject: Record<string, number> = {};
      const skill = s === rahul ? 0.83 : lowAttendance.includes(s) ? 0.45 : 0.55 + ((students.indexOf(s) * 37) % 30) / 100;
      for (const sub of subs) bySubject[sub] = Math.round(per * Math.min(0.98, skill + (rand() - 0.5) * 0.12));
      if (s === rahul && !mock) {
        const phys = [80, 84, 86, 85, 78, 72][t - 1];
        bySubject.Physics = phys; bySubject.Chemistry = [78, 80, 82, 83, 84, 86][t - 1]; bySubject.Mathematics = t === 6 ? 248 - phys - 86 : [82, 84, 85, 86, 88, 90][t - 1];
      }
      const score = Object.values(bySubject).reduce((a, x) => a + x, 0);
      const byChapter: Record<string, { right: number; wrong: number; skipped: number }> = {};
      if (s === rahul) byChapter['Rotational motion'] = { right: 3, wrong: 6, skipped: 1 };
      for (const sub of subs) { const ch = chaptersOf(sub as never)[t % chaptersOf(sub as never).length]; byChapter[ch] = { right: int(4, 9), wrong: int(1, 4), skipped: int(0, 2) }; }
      rec('test_results', { testId: test.id, studentId: s.id, score, max, bySubject, byChapter, answers: {}, secondsPerQuestion: {}, startedAt: null, submittedAt: at(date, '11:30'), enteredBy: 'staff-exam' }, test.id, s.id, at(date, '15:00'));
    }
  }
}
for (const [b, n, title] of [[JA, 4, 'Weekly Test 7'], [NA, 6, 'Weekly Test 7'], [JB, 11, 'JEE Main Mock Test 2']] as const) {
  rec('tests', { batchId: b.rec.id, title, date: day(n), mode: 'online', durationMin: 180, maxMarks: 300, subjects: subjectsOf(b.program), questions: [], published: false, createdBy: 'staff-exam' }, b.rec.id, day(n));
}

// Practice: 2,500 attempts over the bank, XP; 3 weekly goals per student
const weekStart = (d: string) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, -((w + 6) % 7)); };
for (let i = 0; i < 2500; i++) {
  const s = students[i % students.length];
  const subs = subjectsOf(s.program);
  const pool = QUESTIONS.filter((q) => subs.includes(q.subject));
  const q = pool[int(0, pool.length - 1)];
  const correct = rand() < (s === rahul ? 0.8 : 0.65);
  const chosen = correct ? q.answer : (q.answer + 1) % 4;
  const date = day(-int(0, 27));
  rec('practice_attempts', { studentId: s.id, batchId: s.batchId, questionId: q.id, chosen, correct, subject: q.subject, chapter: q.chapter, difficulty: q.difficulty, misconception: correct ? null : (q.misconceptions?.[chosen] ?? null), xp: correct ? ({ easy: 10, medium: 15, hard: 20 } as Any)[q.difficulty] : 2, date, setId: null }, s.id, s.batchId, at(date, hm(int(17, 21), int(0, 59))));
}
for (const s of students) for (let w = 0; w < 3; w++) { const ws = weekStart(day(-7 * w)); rec('practice_goals', { studentId: s.id, weekStart: ws, questions: 40, accuracy: 70, chapters: [] }, s.id, ws); }

// Syllabus coverage
const coverage: Record<string, Record<string, number>> = { 'JEE-A': { Physics: 0.62, Chemistry: 0.58, Mathematics: 0.65 }, 'JEE-B': { Physics: 0.54, Chemistry: 0.5, Mathematics: 0.57 }, 'NEET-A': { Biology: 0.55, Physics: 0.5, Chemistry: 0.52 }, 'NEET-B': { Biology: 0.47, Physics: 0.48, Chemistry: 0.5 } };
for (const b of BATCHES) for (const sub of subjectsOf(b.program)) {
  const chs = chaptersOf(sub as never);
  const target = coverage[b.name][sub] * chs.length;
  chs.forEach((ch, i) => {
    const status = i + 1 <= Math.floor(target) ? 'done' : i < Math.ceil(target) ? 'in_progress' : 'not_started';
    if (status !== 'not_started') rec('syllabus_progress', { batchId: b.rec.id, subject: sub, chapter: ch, status, updatedBy: FAC[sub], date: day(-int(1, 30)) }, b.rec.id, `${sub}|${ch}`);
  });
}

// Homework: 25
for (let i = 0; i < 25; i++) {
  const b = BATCHES[i % 4];
  const sub = subjectsOf(b.program)[i % 3];
  const set = day(-int(1, 20));
  rec('homework', { batchId: b.rec.id, subject: sub, title: `${sub} DPP ${i + 1}`, details: 'Solve all questions; show working. (Sample data)', dueOn: addDays(set, 3), setBy: FAC[sub], setOn: set }, b.rec.id, addDays(set, 3), at(set, '15:00'));
}

// Doubts: 60 (12 open; 5 open Physics incl. Rahul's; 2 older than 24h)
for (let i = 0; i < 60; i++) {
  const open = i < 12;
  const s = i === 0 ? rahul : students[(i * 7) % students.length];
  const sub = open && i < 5 ? 'Physics' : subjectsOf(s.program)[i % 3];
  const created = open ? (i < 2 ? atDay(-2, '18:00') : new Date(NOW.getTime() - int(1, 10) * 3_600_000).toISOString()) : atDay(-int(1, 30), '18:30');
  rec('doubts', { studentId: s.id, batchId: s.batchId, subject: sub, text: i === 0 ? 'In rotational motion, why is the moment of inertia of a ring MR² but a disc MR²/2?' : `Doubt in ${sub}: please explain question ${int(1, 30)} of today's DPP.`, imageUrl: null, status: open ? 'open' : 'answered', answer: open ? null : 'Explained with a worked example — see the steps in class notes.', answeredBy: open ? null : FAC[sub], answeredAt: open ? null : new Date(Date.parse(created) + 6 * 3_600_000).toISOString(), channel: 'app', loggedBy: null }, s.id, sub, created);
}

// Mentoring
for (const s of students) {
  const mentor = s === rahul || (s.program === 'neet' && s !== neet[19]) ? 'staff-swathi' : 'staff-naresh';
  rec('mentorships', { mentorId: mentor, studentId: s.id }, mentor, s.id);
  rec('mentor_notes', { studentId: s.id, mentorId: mentor, date: day(-int(1, 20)), kind: pick(['one_to_one', 'note', 'parent_call']), note: s === rahul ? 'Physics down 2 tests — revise Rotational motion; extra DPP set.' : 'Settling in well; regular with DPPs. (Sample data)', shareWithParent: s === rahul }, s.id, day(-2));
}
const month = TODAY.slice(0, 7);
for (const s of [jee[5], jee[14], neet[7], neet[13]]) rec('wellbeing', { studentId: s.id, month, stress: 2, sleep: 2, note: 'Feeling exam pressure (sample data)', recordedBy: 'staff-swathi', followUp: 'parent_call' }, s.id, month);
for (let i = 0; i < 6; i++) { const s = students[i * 3]; rec('ptm_slots', { staffId: i % 2 ? 'staff-naresh' : 'staff-swathi', date: day(5), time: hm(10, i * 10), minutes: 10, bookedBy: s.guardianPhone, studentId: s.id }, i % 2 ? 'staff-naresh' : 'staff-swathi', day(5)); }

// ------------------------------------------------------------------ hostel
const hostellers = students.filter((s) => s.stay === 'hostel');
const boys: Any[] = hostellers.filter((s) => s.gender === 'male'), girls: Any[] = hostellers.filter((s) => s.gender === 'female');
const [boy3, girl0, girl1] = [boys[3]!, girls[0]!, girls[1]!];
const others = boys.filter((s) => s !== rahul);
for (let r = 0; r < 20; r++) {
  const room = r === 3 ? 'B-204' : `B-${100 * (1 + Math.floor(r / 10)) + (r % 10) + 1}`;
  const ids = room === 'B-204' ? [rahul.id, ...others.splice(0, 1).map((s) => s.id)] : others.splice(0, r < 10 ? 2 : 0).map((s) => s.id);
  rec('hostel_rooms', { block: 'boys', room, ac: r % 3 === 0, capacity: 3, studentIds: ids }, 'boys', room);
}
const girlsLeft = [...girls];
for (let r = 0; r < 10; r++) rec('hostel_rooms', { block: 'girls', room: `G-${101 + r}`, ac: r % 2 === 0, capacity: 3, studentIds: girlsLeft.splice(0, 2).map((s) => s.id) }, 'girls', `G-${101 + r}`);
for (let i = 0; i < 40; i++) {
  const s = hostellers[i % hostellers.length];
  const d = -int(0, 6);
  db.hostelEvents.push({ id: did('hev'), studentId: s.id, direction: i % 2 ? 'in' : 'out', at: atDay(d, hm(int(7, 20), int(0, 59))), device: 'gate-1', deviceEventId: `demo-${i}`, alerted: 1, seedBatch: SEED });
}
rec('outpasses', { studentId: rahul.id, from: atDay(5, '16:00'), to: atDay(7, '18:00'), reason: 'Weekend at home (sample data)', status: 'parent_approved', parentPhone: rahul.guardianPhone, parentAt: atDay(0, '08:00'), wardenId: null, wardenAt: null, note: null }, rahul.id, 'parent_approved');
rec('outpasses', { studentId: boy3.id, from: atDay(-6, '16:00'), to: atDay(-5, '18:00'), reason: 'Family function', status: 'returned', parentPhone: boy3.guardianPhone, parentAt: atDay(-7, '09:00'), wardenId: 'staff-naresh', wardenAt: atDay(-7, '10:00'), note: null }, boy3.id, 'returned');
rec('outpasses', { studentId: girl1.id, from: atDay(-2, '16:00'), to: atDay(-1, '18:00'), reason: 'Medical check-up', status: 'returned', parentPhone: girl1.guardianPhone, parentAt: atDay(-3, '09:00'), wardenId: 'staff-warden', wardenAt: atDay(-3, '10:00'), note: null }, girl1.id, 'returned');
rec('sick_room', { studentId: girl0.id, at: atDay(0, '07:30'), complaint: 'Mild fever and headache', action: 'Paracetamol given; resting in sick room', doctorCalled: false, parentInformed: true, recordedBy: 'staff-warden' }, girl0.id, TODAY);
for (const blk of ['boys', 'girls'] as const) for (let d = 1; d <= 6; d++) { const list = blk === 'boys' ? boys : girls; rec('night_attendance', { block: blk, date: day(-d), present: list.map((s) => s.id), absent: [], markedBy: blk === 'boys' ? 'staff-naresh' : 'staff-warden' }, blk, day(-d)); }
rec('hostel_complaints', { studentId: null, category: 'food', text: 'Mess menu: Mon idli-sambar/rice-dal/chapati-paneer · Tue pongal/veg biryani/dosa · Wed upma/rice-sambar/chapati · Thu poori/curd rice/fried rice · Fri vada/rice-rasam/chapati-dal · Sat dosa/rice-dal/pulao · Sun puri/veg biryani/chapati (sample weekly mess menu)', status: 'resolved', resolution: 'Menu displayed in the mess', by: 'staff-warden' }, 'resolved', 'food');

// ------------------------------------------------------------------ transport
const dayScholars = students.filter((s) => s.stay === 'day');
const ROUTES = [
  ['Route 1 · Hayathnagar – Vanasthalipuram – LB Nagar – Campus', 'TS09-UA-1101', 'Ramulu'],
  ['Route 2 · Kothapet – Dilsukhnagar – Campus', 'TS09-UA-1102', 'Yadagiri'],
  ['Route 3 · Saroornagar – Karmanghat – Campus', 'TS09-UA-1103', 'Mallesh'],
];
const routeStudents = [dayScholars.filter((_, i) => i % 3 === 0), dayScholars.filter((_, i) => i % 3 === 1), dayScholars.filter((_, i) => i % 3 === 2)];
if (!routeStudents[2].includes(ananya)) { for (const r of routeStudents) { const i = r.indexOf(ananya); if (i >= 0) r.splice(i, 1); } routeStudents[2].push(ananya); }
ROUTES.forEach(([route, busNo, driver], i) => {
  const bus = rec('buses', { route, busNo, driverName: driver, driverPhone: phone(9001 + i), studentIds: routeStudents[i].map((s) => s.id), location: null }, route, busNo);
  rec('bus_attendance', { busId: bus.id, date: TODAY, trip: 'pickup', present: routeStudents[i].map((s) => s.id), markedBy: 'staff-transport' }, bus.id, TODAY);
});

// ------------------------------------------------------------------ notices, events, leave, library, alumni
const NOTICES = [
  ['Route 3 bus delayed by 15 minutes today', 'Due to road work near Karmanghat, the Route 3 bus will reach stops about 15 minutes late this morning.', 'parents', 0],
  ['BSAT on 16 November', 'Bhargava Scholarship & Aptitude Test on Sunday 16 November, 10:00 AM. Hall tickets on the app.', 'all', -2],
  ['Parent–Teacher Meeting', 'PTM for all first-year batches. Book a 10-minute slot with the mentor in the app.', 'parents', -1],
  ['Weekly Test 7 schedule', 'Weekly Test 7 for JEE-A and NEET-A this week. Syllabus: chapters covered till date.', 'students', -1],
  ['Diwali holidays', 'College remains closed for Diwali as per the calendar. Hostel students may go home with an outpass.', 'all', -12],
  ['Staff meeting on Saturday', 'All faculty: review of syllabus coverage at 3:00 PM in the seminar hall.', 'staff', -3],
  ['Library timings extended', 'The library is open until 8:00 PM on weekdays for hostel students.', 'students', -6],
  ['Fee instalment reminder', 'Second instalment is due. Pay online in the app or at the Accounts counter.', 'parents', -5],
  ['Sports day practice', 'Practice for sports day every evening 5–6 PM on the ground.', 'students', -4],
  ['Mock test results published', 'Mock Test 1 results are available in the app with subject-wise analysis.', 'all', -2],
  ['Hostel visiting hours', 'Parents may visit hostel students on Sundays between 10 AM and 1 PM.', 'parents', -15],
  ['Exam cell: online exam practice', 'Students can try online exam practice papers from this week.', 'students', -7],
] as const;
NOTICES.forEach(([title, body, audience, d]) => rec('notices', { title: `${title}`, body: `${body} (Sample data)`, audience, date: day(d), publishedBy: audience === 'staff' ? 'staff-principal' : 'staff-exam', attachmentUrl: null, pinned: d === 0 || title.startsWith('BSAT') }, audience, day(d), atDay(d, '08:00')));
const nextDate = (mmdd: string) => { const y = TODAY.slice(0, 4); const d = `${y}-${mmdd}`; return d >= TODAY ? d : `${Number(y) + 1}-${mmdd}`; };
const EVENTS: [string, string, string, string][] = [
  ['BSAT – Scholarship & Aptitude Test', nextDate('11-16'), 'exam', 'all'], ['Parent–Teacher Meeting', day(5), 'ptm', 'parents'], ['Diwali holiday', day(-12), 'holiday', 'all'],
  ['JEE Main Mock Test 2', day(11), 'exam', 'students'], ['Sports Day', day(19), 'event', 'all'], ['Weekly Test 7', day(4), 'exam', 'students'],
  ['Second instalment last date', day(10), 'deadline', 'parents'], ['Science exhibition', day(26), 'event', 'all'], ['NEET Mock Test 2', day(18), 'exam', 'students'], ['Christmas holiday', nextDate('12-25'), 'holiday', 'all'],
];
EVENTS.forEach(([title, date, kind, audience]) => rec('events', { title, date, endDate: null, kind, audience, location: 'Campus', note: 'Sample data', createdBy: 'staff-principal' }, kind, date));
for (let i = 0; i < 8; i++) { const s = dayScholars[i]; rec('student_leave', { studentId: s.id, from: day(i < 2 ? 1 : -int(3, 20)), to: day(i < 2 ? 2 : -int(1, 2)), reason: pick(['Fever', 'Family function', 'Hospital visit']), requestedBy: 'parent', status: i < 2 ? 'pending' : 'approved', decidedBy: i < 2 ? null : 'staff-principal', note: null }, s.id, i < 2 ? 'pending' : 'approved'); }
[['staff-krishna', 'pending'], ['staff-radhika', 'approved'], ['staff-frontdesk', 'rejected']].forEach(([sid, status], i) => rec('leave_requests', { staffId: sid, from: day(3 + i), to: day(3 + i), reason: 'Personal work (sample data)', status, decidedBy: status === 'pending' ? null : 'staff-principal' }, sid, status));
const BOOK_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'General'];
const books = Array.from({ length: 400 }, (_, i) => rec('library_books', { title: `${BOOK_SUBJECTS[i % 6]} ${['Concepts', 'Problems', 'Handbook', 'Objective Guide', 'Practice Book'][i % 5]} Vol ${1 + (i % 4)} (#${i + 1})`, author: `${pick(FATHERS)} ${pick(SURNAMES)}`, subject: BOOK_SUBJECTS[i % 6], isbn: `97881${String(1000000 + i)}`, shelf: `S-${1 + (i % 20)}`, copies: int(1, 5) }, BOOK_SUBJECTS[i % 6], `97881${String(1000000 + i)}`));
for (let i = 0; i < 35; i++) { const s = students[i]; const issued = day(-int(3, 20)); const overdue = i < 4; rec('library_loans', { bookId: books[i * 9].id, studentId: s.id, issuedOn: overdue ? day(-25) : issued, dueOn: overdue ? day(-int(2, 8)) : day(int(2, 14)), returnedOn: null, issuedBy: 'demo-staff-librarian' }, books[i * 9].id, s.id); }
for (let i = 0; i < 15; i++) { const g = i % 2 ? 'f' : 'm'; const name = `${pick(g === 'm' ? FIRST_M : FIRST_F)} ${pick(SURNAMES)}`; rec('alumni', { studentId: null, name, phone: phone(5000 + i), passedOut: 2021 + (i % 5), nowAt: pick(['IIT Hyderabad', 'NIT Warangal', 'Osmania Medical College', 'Gandhi Medical College', 'IIIT Hyderabad', 'JNTU Hyderabad']), course: pick(['B.Tech CSE', 'MBBS', 'B.Tech ECE', 'B.Tech Mechanical']), mentorWilling: i < 2, story: 'Sample alumni story.', approved: true }, phone(5000 + i), String(2021 + (i % 5))); }

// ------------------------------------------------------------------ marketing, chat, WhatsApp, assistant log
for (const [source, amounts] of [['google_ads', [40000, 55000, 20000]], ['meta_ads', [25000, 30000, 12000]], ['school_events', [15000, 10000, 5000]]] as const) ['2026-09', '2026-10', '2026-11'].forEach((m, i) => rec('marketing_spend', { source, month: m, amount: amounts[i], note: 'Sample data', enteredBy: 'staff-marketing' }, m, source));
const chatLeads = leads.filter((l) => l.firstSource === 'chat' || l.firstSource === 'website').slice(0, 20);
for (let i = 0; i < 90; i++) {
  const created = atDay(-int(0, 40), randTime());
  const lead = i < 20 ? chatLeads[i] : null;
  const handoff = i >= 20 && i < 28;
  const id = did('conv');
  db.conversations.push({ id, channel: i % 6 === 0 ? 'whatsapp' : 'web', contactPhone: lead?.phone ?? null, contactName: lead?.parentName ?? null, leadId: lead?.id ?? null, status: handoff ? (i < 23 ? 'waiting' : 'assigned') : 'closed', assigneeId: handoff ? ANIL : null, handoffReason: handoff ? 'Parent asked to talk to a counsellor' : null, handoffAt: handoff ? created : null, visitorTokenHash: createHash('sha256').update(id).digest('hex'), createdAt: created, lastMessageAt: created, lastInboundAt: created, unread: handoff ? 1 : 0, closedAt: handoff ? null : created, closeNote: handoff ? null : 'Sample data', seedBatch: SEED });
  const msgs: [string, string][] = [['contact', pick(['What are the hostel fees?', 'Is BSAT scholarship available for NEET?', 'Can we visit the campus on Saturday?', 'What is the JEE batch timing?'])], ['bot', 'Thanks for asking! Here are the details from our admissions team…'], ...(i < 6 ? [['bot', 'Your campus visit is booked. We will send a WhatsApp confirmation.'] as [string, string]] : [])];
  msgs.forEach(([author, text], j) => db.convMessages.push({ id: did('msg'), conversationId: id, author, staffId: null, text, waMessageId: null, createdAt: new Date(Date.parse(created) + j * 30_000).toISOString(), seedBatch: SEED }));
}
const TEMPLATES = ['bjc_enquiry_ack', 'bjc_visit_confirm', 'bjc_visit_reminder', 'bjc_fee_receipt', 'bjc_fee_reminder'];
for (let i = 0; i < 300; i++) {
  const l = leads[i % leads.length];
  const t = TEMPLATES[i % TEMPLATES.length];
  const created = atDay(-int(0, 50), randTime());
  db.waMessages.push({ id: did('wa'), leadId: l.id, to: l.phone, template: t, body: `Sample ${t.replace('bjc_', '').replace(/_/g, ' ')} message for ${l.parentName}.`, providerId: `dev-demo-${i}`, error: null, dedupeKey: `demo:${t}:${l.id}:${i}`, createdBy: null, status: pick(['sent', 'delivered', 'read']), createdAt: created, seedBatch: SEED });
}
const QUERIES: [string, string, string][] = [['BJC-2027-JEE-0001', 'principal', 'staff-principal'], ['students below 75% attendance', 'principal', 'staff-principal'], ['fee defaulters this month', 'accounts', 'staff-accounts'], ['list all Hot leads not called today', 'admission_manager', 'staff-manager'], ['hostel students out this weekend', 'hostel_warden', 'staff-naresh']];
for (let i = 0; i < 25; i++) { const [q, role, actor] = QUERIES[i % QUERIES.length]; const iso = atDay(-int(1, 20), randTime()); rec('ai_query_audit', { actorId: actor, role, query: q, intent: 'lookup', resultCount: int(1, 12), studentIds: [], at: iso }, actor, iso, iso); }

// ------------------------------------------------------------------ student life: sports, speaker sessions, wellbeing, open-book
ensureStaff('staff-coach', 'Coach Ravi', ['sports_coach']);
ensureStaff('staff-counsellor', 'Ms. Deepa, Student Counsellor', ['student_counsellor']);
const COACH = 'staff-coach';
const COUNSELLOR = 'staff-counsellor';

// Houses: students split round-robin (Rahul = Godavari, its captain)
const HOUSE_DEF = [['godavari', 'Godavari', '#1D2A5E'], ['krishna', 'Krishna', '#7D1F2C'], ['tungabhadra', 'Tungabhadra', '#C9A24A'], ['manjeera', 'Manjeera', '#2F7A4F']] as const;
const houseMembers: Any[][] = HOUSE_DEF.map(() => []);
students.forEach((s, i) => houseMembers[i % 4].push(s));
HOUSE_DEF.forEach(([key, name, color], i) => rec('sports_houses', { key, name, color, captainId: houseMembers[i][0].id, studentIds: houseMembers[i].map((s) => s.id) }, key, null, atDay(-40, '09:00')));
const HN = HOUSE_DEF.map((h) => h[1]);

// Fixtures: 8 played inter-house (points: Godavari 10, Krishna 6, Tungabhadra 4, Manjeera 3) + 5 upcoming
const fixture = (o: Any) => rec('sports_fixtures', { time: '16:30', venue: 'College ground', homeScore: null, awayScore: null, winner: null, teamIds: [], createdBy: COACH, ...o }, o.kind, o.date, at(o.date, '09:00'));
const PLAYED: [string, number, number, string, string, 'home' | 'away' | 'draw', number][] = [
  ['Cricket', 0, 1, '142/6', '128/9', 'home', -30], ['Volleyball', 2, 3, '2', '1', 'home', -28], ['Kabaddi', 0, 2, '31', '31', 'draw', -21], ['Badminton', 1, 3, '2', '0', 'home', -20],
  ['Cricket', 2, 0, '110/8', '114/4', 'away', -14], ['Chess', 1, 2, '2.5', '1.5', 'home', -13], ['Volleyball', 3, 0, '1', '2', 'away', -7], ['Kabaddi', 1, 3, '28', '35', 'away', -6],
];
PLAYED.forEach(([sport, h, a, hs, as, winner, d]) => fixture({ title: `Inter-house ${sport}: ${HN[h]} vs ${HN[a]}`, sport, kind: 'inter_house', date: day(d), venue: sport === 'Chess' ? 'Seminar hall' : 'College ground', home: HN[h], away: HN[a], status: 'played', homeScore: hs, awayScore: as, winner }));
fixture({ title: `Inter-house Badminton: ${HN[0]} vs ${HN[3]}`, sport: 'Badminton', kind: 'inter_house', date: day(3), venue: 'Indoor court', home: HN[0], away: HN[3], status: 'scheduled' });
fixture({ title: `Inter-house Kabaddi: ${HN[1]} vs ${HN[2]}`, sport: 'Kabaddi', kind: 'inter_house', date: day(5), home: HN[1], away: HN[2], status: 'scheduled' });
fixture({ title: 'Inter-college Cricket: BJC XI vs Hayathnagar JC XI (sample)', sport: 'Cricket', kind: 'inter_college', date: day(9), time: '09:00', home: 'BJC XI', away: 'Hayathnagar JC XI', status: 'scheduled', teamIds: jee.slice(0, 11).map((s: Any) => s.id) });
fixture({ title: 'Annual Sports Day: track & field, relays, tug of war', sport: 'Athletics', kind: 'sports_day', date: day(19), time: '08:00', home: 'All houses', away: 'Track & field', status: 'scheduled' });
fixture({ title: `Inter-house Chess: ${HN[3]} vs ${HN[0]}`, sport: 'Chess', kind: 'inter_house', date: day(12), venue: 'Seminar hall', home: HN[3], away: HN[0], status: 'scheduled' });

// Games-period attendance: last 20 school days; 4 students have never come (coach's "never played" list)
const GAMES = ['Cricket', 'Volleyball', 'Badminton', 'Kabaddi', 'Athletics', 'Yoga'];
const neverPlayed = new Set([students[37], students[38], students[39], lowAttendance[2]].map((s) => s.id));
schoolDays.slice(0, 20).forEach((d, i) => {
  const present = students.filter((s) => !neverPlayed.has(s.id) && (s === rahul ? i % 5 !== 4 : rand() < 0.65)).map((s) => s.id);
  rec('sports_attendance', { date: d, sport: GAMES[i % GAMES.length], present, markedBy: COACH }, d, GAMES[i % GAMES.length], at(d, '17:15'));
});
for (const s of students) {
  const mine = s === rahul ? ['Cricket', 'Chess'] : [...new Set([pick(GAMES), pick(['Cricket', 'Volleyball', 'Badminton', 'Kabaddi', 'Chess', 'Table tennis', 'Athletics', 'Yoga'])])];
  if (neverPlayed.has(s.id)) continue;
  for (const sp of mine) rec('sports_signups', { studentId: s.id, sport: sp }, s.id, sp, atDay(-35, '12:00'));
  rec('fitness_checks', { studentId: s.id, date: day(-20), run600mSec: s === rahul ? 148 : int(125, 220), sitReachCm: int(2, 28), bmi: rand() < 0.5 ? Math.round((17 + rand() * 8) * 10) / 10 : null, recordedBy: COACH }, s.id, day(-20), atDay(-20, '10:00'));
}
const ACH: [Any, string, string, string, number][] = [
  [rahul, 'Runner-up, chess (U-17)', 'silver', 'Inter-college Chess Meet, Hyderabad (sample)', -16],
  [students[4], 'Best raider', 'gold', 'Inter-house Kabaddi', -6], [students[9], '100 m sprint', 'bronze', 'District Athletics Meet (sample)', -25],
  [students[14], 'Volleyball team', 'certificate', 'Inter-college Volleyball (sample)', -18], [ananya, 'Yoga demonstration', 'participation', 'Inter-house Yoga', -10],
];
for (const [s, title, medal, event, d] of ACH) rec('sports_achievements', { studentId: s.id, title, medal, event, date: day(d), recordedBy: COACH }, s.id, day(d), atDay(d, '18:00'));

// Speaker sessions: 3 sample speakers, 2 past sessions (attendance + feedback), 3 upcoming
const speaker = (name: string, background: string, topic: string, fee: number | null) => rec('speakers', { name, background, topic, contact: null, fee, sample: true }, null, null, atDay(-50, '10:00'));
const spk = [
  speaker('Dr. K. Anand (sample speaker)', 'Psychologist, 15 years with exam-going students', 'Handling exam pressure and building focus', 15000),
  speaker('S. Pavani (sample alumna)', 'BJC 2022, now at a top engineering college', 'How I planned my JEE preparation', null),
  speaker('R. Mohan (sample speaker)', 'Career counsellor', 'Careers after JEE and NEET: beyond the obvious', 10000),
];
const session = (o: Any) => rec('speaker_sessions', { venue: 'Seminar hall', onlineUrl: null, summary: null, recordingPath: null, alumniId: null, sample: true, createdBy: 'staff-principal', ...o }, o.audience, o.date, atDay(-30, '10:00'));
const sMot = session({ title: 'Beat exam stress, build focus', type: 'motivational', speakerId: spk[0].id, date: day(-10), time: '14:30', audience: 'all_students', capacity: 300, summary: 'Practical routines for sleep, revision and staying calm in the exam hall.' });
const sAlu = session({ title: 'Alumni talk: my JEE year', type: 'alumni', speakerId: spk[1].id, date: day(-24), time: '15:00', audience: `batch:${JA.rec.id}`, capacity: 40, summary: 'A BJC alumna on daily planning, mock-test review and handling a bad week.' });
const sTop = session({ title: 'Toppers interaction: ask the 2026 rank holders', type: 'toppers', speakerId: null, date: day(6), time: '15:00', audience: 'all_students', capacity: 120, summary: 'Q&A with last year’s toppers. Bring your questions.' });
const sPar = session({ title: 'Supporting your child through JEE/NEET', type: 'parent_seminar', speakerId: spk[0].id, date: day(8), time: '10:30', audience: 'parents', capacity: 100, summary: 'What helps and what adds pressure at home. Tea and Q&A after the talk.' });
const sExm = session({ title: 'NEET exam-strategy workshop', type: 'exam_strategy', speakerId: spk[2].id, date: day(12), time: '14:00', audience: `batch:${NA.rec.id}`, capacity: 40, summary: 'Time management, negative marking and OMR practice.' });
const reg = (sid: string, who: string, kind: 'student' | 'parent', studentId: string, attended: boolean) => rec('session_registrations', { sessionId: sid, who, kind, studentId, attended }, sid, who);
const fb = (sid: string, who: string, rating: number, comment: string | null) => rec('session_feedback', { sessionId: sid, who, rating, comment }, sid, who);
const COMMENTS = ['The 50/10 study routine is useful.', 'Liked the breathing exercise before tests.', 'Very practical, please invite again.', 'Helped me stop comparing ranks.', null, null];
students.slice(0, 34).forEach((s, i) => {
  const attended = s === rahul || i % 9 !== 8;
  reg(sMot.id, s.id, 'student', s.id, attended);
  if (attended && s !== rahul && i < 25) fb(sMot.id, s.id, i % 7 === 0 ? 3 : i % 3 === 0 ? 4 : 5, COMMENTS[i % COMMENTS.length]); // Rahul has not given feedback yet
});
JA.studs.forEach((s: Any, i: number) => { reg(sAlu.id, s.id, 'student', s.id, i !== 7); if (i !== 7 && i % 2 === 0) fb(sAlu.id, s.id, 5, i === 0 ? 'Now I review every mock test the same day.' : null); });
students.slice(5, 23).forEach((s) => reg(sTop.id, s.id, 'student', s.id, false));
students.slice(10, 22).forEach((s) => reg(sPar.id, s.guardianPhone, 'parent', s.id, false));
NA.studs.slice(0, 9).forEach((s: Any) => reg(sExm.id, s.id, 'student', s.id, false));
for (const [s, aud] of [[sTop, 'students'], [sPar, 'parents'], [sExm, 'students']] as const) rec('events', { title: s.data.title, date: s.data.date, endDate: null, kind: 'event', audience: aud, location: s.data.venue, note: `${s.data.time} · register in the app. Session id ${s.id} (sample data)`, createdBy: 'staff-principal' }, 'event', s.data.date);

// Wellbeing (private): consent for 32 students (not Ananya, so her app shows the privacy note), 6 weeks of check-ins
const thisWeek = weekStart(TODAY);
const WEEKS = [5, 4, 3, 2, 1, 0].map((w) => addDays(thisWeek, -7 * w));
const highStress = [jee[5], neet[7]];
const consenting = students.filter((s) => s !== ananya).slice(0, 32);
consenting.forEach((s, i) => {
  rec('wellbeing_consent', { studentId: s.id, at: atDay(-42, '19:00'), shareWithParent: s === rahul || i % 4 === 0 }, s.id, null, atDay(-42, '19:00'));
  WEEKS.forEach((ws, w) => {
    if (w === 5 && i % 2 === 1) return; // half have checked in this week so far
    if (w < 5 && rand() < 0.12 && s !== rahul) return;
    const hi = highStress.includes(s) && w >= 4;
    const stress = s === rahul ? [2, 2, 3, 3, 4, 3][w] : hi ? (w === 4 ? 4 : 5) : int(2, 3) + (w === 4 && i % 5 === 0 ? 1 : 0);
    const note = s === rahul && w === 4 ? 'Worried about the Physics test results.' : hi && w === 5 ? 'Too much syllabus left, not sleeping well. (sample)' : null;
    rec('wellbeing_checkins', { studentId: s.id, weekStart: ws, mood: Math.max(1, Math.min(5, 6 - stress + int(-1, 0))), sleepHours: hi ? 5 : int(6, 8), stress, note, distress: false }, s.id, ws, at(ws, '20:30'));
  });
});
for (const s of highStress) {
  rec('wellbeing_flags', { studentId: s.id, status: 'needs_conversation', raisedBy: 'high stress 2+ weeks', date: day(-1) }, s.id, 'needs_conversation');
  rec('counsellor_notes', { studentId: s.id, note: 'Exam worry and short sleep. Agreed a sleep routine and a check-in next week. (sample data)', by: COUNSELLOR, date: day(-3) }, s.id, day(-3));
}
const booking = (s: Any, d: number, time: string, mode: string, status: string, topic: string | null) => rec('counsellor_bookings', { studentId: s.id, date: day(d), time, mode, status, topic }, s.id, day(d));
booking(highStress[0], 1, '11:00', 'in_person', 'requested', 'Exam stress');
booking(highStress[1], 2, '15:00', 'in_person', 'confirmed', null);
booking(students[20], -5, '12:00', 'call', 'done', 'Homesick in the hostel');
booking(students[26], -2, '14:00', 'in_person', 'cancelled', null);
const ANON: [string, string | null][] = [
  ['How do I stop comparing my rank with my friends?', 'Compare yourself with your own last test, not with others. Pick one chapter to improve each week and track only that. Come and talk any time.'],
  ['I get very nervous the night before a test and cannot sleep. What can I do?', 'Stop new topics by 8 PM, do a light revision of formulas, then 10 minutes of slow breathing. Many students feel this; it gets better with routine.'],
  ['Is it normal to feel homesick in the hostel in the first term?', null],
  ['My parents expect a top rank. How do I tell them I am trying my best?', null],
];
ANON.forEach(([text, answer], i) => rec('anon_questions', { text, answer, answeredAt: answer ? atDay(-i - 1, '17:00') : null, distress: false, ticket: createHash('sha256').update(`anon-${i}`).digest('hex').slice(0, 12) }, createHash('sha256').update(`anon-${i}`).digest('hex').slice(0, 12), answer ? 'answered' : 'open', atDay(-i - 3, '21:00')));

// Open-book: question bank, 3 assignments (1 closed + marked, 2 open now), weekly big questions
const RUBRIC = [{ criterion: 'Concept understanding', max: 4 }, { criterion: 'Method', max: 3 }, { criterion: 'Correct use of resources', max: 1 }, { criterion: 'Explanation', max: 2 }];
const obq = (subject: string, chapter: string, kind: string, answerType: string, text: string, modelAnswer: string, createdBy: string, options: string[] = []) => rec('openbook_questions', { subject, chapter, kind, answerType, text, options, modelAnswer, rubric: RUBRIC, openBookSuitable: true, createdBy }, subject, kind);
const qPhys = [
  obq('Physics', 'Rotational motion', 'application', 'short', 'A ring and a disc of the same mass and radius roll down the same incline from rest. Which reaches the bottom first? Use your notes to justify with the moment of inertia.', 'The disc. I(disc)=MR²/2 < I(ring)=MR², so a larger share of energy goes into translation; a = g sinθ/(1+I/MR²) is larger for the disc.', 'staff-krishna'),
  obq('Physics', 'Rotational motion', 'real_life', 'short', 'Why does a figure skater spin faster when she pulls her arms in? Explain with angular momentum.', 'No external torque, so L = Iω is conserved. Pulling arms in reduces I, so ω increases.', 'staff-krishna'),
  obq('Physics', 'Laws of motion', 'analysis', 'long', 'A lift accelerates up at 2 m/s², moves at constant speed, then decelerates. Sketch how a bathroom scale reading changes for a 60 kg person and explain each part.', 'N = m(g+a): 708 N while accelerating up, 588 N at constant speed, 468 N while decelerating (g = 9.8).', 'staff-krishna'),
  obq('Physics', 'Laws of motion', 'mcq_explain', 'mcq_explain', 'A block on a rough table does not move when pushed lightly. The friction force is: pick one and explain why.', 'B: equal to the applied force, because static friction adjusts up to its limit μsN.', 'staff-krishna', ['Zero', 'Equal to the applied force', 'Equal to μsN always', 'Greater than the applied force']),
];
const qChem = [
  obq('Chemistry', 'Chemical bonding', 'own_words', 'short', 'In your own words, explain why water is a bent molecule while CO₂ is linear.', 'O in water has two lone pairs (sp³, ~104.5°); C in CO₂ has no lone pairs, two double bonds, sp, 180°.', 'staff-radhika'),
  obq('Chemistry', 'Chemical bonding', 'case_data', 'short', 'Using the given boiling points of H₂O, H₂S, H₂Se and H₂Te, explain the trend and the exception.', 'Boiling point rises with molar mass from H₂S to H₂Te (van der Waals); H₂O is anomalously high due to hydrogen bonding.', 'staff-radhika'),
];
const qBio = [
  obq('Biology', 'Human physiology', 'real_life', 'short', 'Why do we feel thirsty after eating very salty food? Trace the path from the blood to the brain.', 'Higher plasma osmolality is sensed by hypothalamic osmoreceptors, which trigger thirst and ADH release so the kidneys keep more water.', 'staff-swathi'),
  obq('Biology', 'Human physiology', 'application', 'short', 'A person has damaged alveoli. Using Fick’s law, explain why their oxygen uptake falls.', 'Less surface area and thicker membrane reduce the diffusion rate (rate ∝ area × gradient / thickness).', 'staff-swathi'),
  obq('Biology', 'Human physiology', 'analysis', 'long', 'Compare how the heart rate and breathing rate change during a 600 m run, and explain why both change together.', 'Both rise: more CO₂ and lower pH stimulate the medulla; sympathetic stimulation raises heart rate to deliver O₂ and remove CO₂.', 'staff-swathi'),
];
const RES_PCF = { ownNotes: true, ncert: true, formulaSheet: true, calculator: true, internet: false };
const assignment = (b: Any, title: string, subject: string, qs: Any[], perStudent: number, opensAt: string, closesAt: string, by: string, resources = RES_PCF) => rec('openbook_assignments', { batchId: b.rec.id, title, subject, questionIds: qs.map((q) => q.id), perStudent, resources, durationMin: 45, opensAt, closesAt, createdBy: by }, b.rec.id, closesAt.slice(0, 10), opensAt);
const aChem = assignment(JA, 'Chemistry chapter assignment: Chemical bonding', 'Chemistry', qChem, 2, atDay(-9, '16:00'), atDay(-7, '21:00'), 'staff-radhika', { ownNotes: true, ncert: true, formulaSheet: false, calculator: false, internet: false });
const aPhys = assignment(JA, 'Physics open-book practice: Rotation and Laws of motion', 'Physics', qPhys, 2, minsFromNow(-180), atDay(3, '21:00'), 'staff-krishna');
const aBio = assignment(NA, 'Biology open-book practice: Human physiology', 'Biology', qBio, 2, minsFromNow(-120), atDay(4, '21:00'), 'staff-swathi');
const ANSWERS = ['Because the moment of inertia is smaller, more of the energy goes into moving forward, so it is faster. From my notes: a = g sinθ / (1 + I/MR²).', 'Angular momentum stays the same because there is no outside torque, so when I gets smaller ω must get bigger.', 'Using N = m(g + a) from the NCERT example, the reading goes up first, then normal, then down.', 'It is equal to the applied force, since static friction only becomes μsN at the limit.'];
const attempt = (a: Any, s: Any, qids: string[], pledged: string, submitted: string | null, marked: Record<string, number[]> | null, feedback: string | null) => {
  const marks = marked ? Object.fromEntries(qids.map((q, i) => [q, Object.fromEntries(RUBRIC.map((r, j) => [r.criterion, Math.min(r.max, marked[q]?.[j] ?? [3, 2, 1, 1][j] + (i % 2))]))])) : null;
  const total = marks ? Object.values(marks).reduce((t, m) => t + Object.values(m).reduce((x, y) => x + y, 0), 0) : null;
  rec('openbook_attempts', { assignmentId: a.id, studentId: s.id, questionIds: qids, pledgedAt: pledged, answers: submitted ? Object.fromEntries(qids.map((q, i) => [q, ANSWERS[(i + s.fullName.length) % ANSWERS.length]])) : {}, submittedAt: submitted, suggestion: marks, marks, feedback, total, max: marks ? qids.length * 10 : null, markedBy: marks ? a.data.createdBy : null, similarity: [] }, a.id, s.id, pledged);
};
JA.studs.forEach((s: Any, i: number) => {
  const qids = [qChem[i % 2].id, qChem[(i + 1) % 2].id];
  const scores = s === rahul ? { [qids[0]]: [4, 3, 1, 1], [qids[1]]: [3, 2, 1, 2] } : {};
  attempt(aChem, s, qids, atDay(-8, '18:00'), atDay(-8, '18:40'), scores, s === rahul ? 'Clear use of VSEPR; add the bond angle values next time. (Rubric-marked by Radhika)' : 'Good explanation in your own words. (sample)');
});
JA.studs.slice(1, 5).forEach((s: Any, i: number) => attempt(aPhys, s, [qPhys[i % 4].id, qPhys[(i + 1) % 4].id], minsFromNow(-150 + i * 10), minsFromNow(-110 + i * 10), i < 2 ? {} : null, i < 2 ? 'Concept is right; show the formula you used from the sheet. (sample)' : null));
NA.studs.slice(0, 3).forEach((s: Any, i: number) => attempt(aBio, s, [qBio[i % 3].id, qBio[(i + 1) % 3].id], minsFromNow(-100), minsFromNow(-60), null, null));
const bqP = rec('big_questions', { subject: 'Physics', weekStart: thisWeek, text: 'Why does a spinning top not fall over, but falls as soon as it slows down? Explain using torque and angular momentum.', createdBy: 'staff-krishna' }, 'Physics', thisWeek, atDay(-1, '08:00'));
const bqB = rec('big_questions', { subject: 'Biology', weekStart: thisWeek, text: 'Why do your fingers wrinkle in water, but not your arms? Suggest an explanation and how you would test it.', createdBy: 'staff-swathi' }, 'Biology', thisWeek, atDay(-1, '08:00'));
const bigA = (q: Any, s: Any, text: string, featured: boolean) => rec('big_answers', { questionId: q.id, studentId: s.id, text, featured }, q.id, s.id);
bigA(bqP, jee[2], 'The spinning top has a large angular momentum along its axis. Gravity gives a torque, but the torque only changes the direction of L slowly (precession) instead of tipping it. When the top slows, L becomes small and the same torque can tip it over.', true);
bigA(bqP, jee[7], 'Because when it spins fast it is stable like a cycle wheel. When it slows down it is not stable.', false);
bigA(bqP, jee[13], 'Torque from gravity makes L rotate sideways, so the top precesses. Precession needs enough L, so at low spin it falls.', false);
bigA(bqB, neet[3], 'Wrinkling is controlled by nerves: blood vessels in the fingertips narrow in water. It may give a better grip on wet things. Test: compare grip on wet objects with wrinkled and dry fingers.', true);
bigA(bqB, neet[9], 'The skin on fingers absorbs water and swells more than on the arm.', false);

// ------------------------------------------------------------------ write
for (const l of leads) l.updatedAt = l.lastContactAt && l.lastContactAt > l.createdAt ? l.lastContactAt : l.createdAt;
save();
const count = (k: string) => db[k].filter((r: Any) => r.seedBatch === SEED).length;
console.log(`Demo data written to ${path.relative(ROOT, FILE)} (today = ${TODAY} IST)`);
console.log({ leads: count('leads'), calls: count('calls'), visits: count('visits'), students: count('students'), guardians: count('guardians'), payments: count('payments'), conversations: count('conversations'), waMessages: count('waMessages') });
