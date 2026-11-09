/**
 * Demo data for a TEST / STAGING Supabase project: `npm run seed:supabase` (or `npm run seed:supabase -- --clear`).
 *
 * 1. Generates the same demo data as `npm run seed:demo` (scripts/seed-demo.ts) into .data/demo-supabase.json.
 * 2. Creates the 24 demo staff as Supabase Auth users (emails @bjc.demo, one random password kept in .env.local
 *    as DEMO_STAFF_PASSWORD), with profiles and roles.
 * 3. Removes the previous demo upload (listed in the `demo_seed` manifest record), then uploads everything
 *    in the order the database rules need (sign-offs before College IDs).
 *
 * Safety: needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local, refuses NODE_ENV=production, and only
 * runs against a project listed in DEMO_SUPABASE_PROJECTS (comma-separated project refs) in .env.local.
 */
import { existsSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type Any = Record<string, any>;
const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env.local');
const envText = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
const env = (k: string) => process.env[k] || (envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim();

const URL_ = env('SUPABASE_URL');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const ref = URL_.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? '';
const allowed = env('DEMO_SUPABASE_PROJECTS').split(',').map((s) => s.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production') throw new Error('Refusing: NODE_ENV=production.');
if (!URL_ || !KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
if (!ref || !allowed.includes(ref)) throw new Error(`Refusing: project "${ref}" is not listed in DEMO_SUPABASE_PROJECTS (test/staging projects only).`);
const clearOnly = process.argv.includes('--clear');

const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const check = (r: { data: any; error: { message: string } | null }, what: string): any => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const uuid = (s: string) => {
  const h = createHash('sha1').update(`bjc-demo-2027:${s}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ------------------------------------------------------------------ 1. remove the previous upload
const MANIFEST = { collection: 'demo_seed', id: 'demo-2027' };
async function clearPrevious() {
  const prev = check(await sb.from('records').select('data').eq('collection', MANIFEST.collection).eq('id', MANIFEST.id).maybeSingle(), 'read manifest');
  if (!prev) return;
  const m = prev.data as Any;
  const del = async (table: string, col: string, ids: string[]) => {
    for (const c of chunks(ids, 150)) check(await sb.from(table).delete().in(col, c), `delete ${table}`);
  };
  await del('conversations', 'id', m.conversations ?? []);
  await del('wa_messages', 'id', m.waMessages ?? []);
  await del('students', 'id', m.students ?? []);
  for (const t of ['payments', 'admission_stage_events', 'visits', 'bsat_registrations', 'verification_reversals']) await del(t, 'lead_id', m.leads ?? []);
  // siblings first (sibling_of references the primary lead)
  const leads: string[] = m.leads ?? [];
  await del('leads', 'id', leads.filter((id: string) => (m.siblings ?? []).includes(id)));
  await del('leads', 'id', leads.filter((id: string) => !(m.siblings ?? []).includes(id)));
  await del('import_batches', 'id', m.importBatches ?? []);
  for (const [collection, ids] of Object.entries((m.records ?? {}) as Record<string, string[]>)) for (const c of chunks(ids, 150)) check(await sb.from('records').delete().eq('collection', collection).in('id', c), `delete records ${collection}`);
  for (const k of m.counters ?? []) check(await sb.from('id_counters').delete().eq('key', k), 'delete counter');
  check(await sb.from('records').delete().eq('collection', MANIFEST.collection).eq('id', MANIFEST.id), 'delete manifest');
  console.log(`Removed previous demo upload (${leads.length} leads, ${(m.students ?? []).length} students).`);
}

// ------------------------------------------------------------------ 2. staff as Supabase Auth users
const STAFF: [string, string, string[]][] = [
  ['staff-developer', 'Developer', ['developer']], ['staff-admin', 'Super Admin', ['super_admin']], ['staff-manager', 'Admission Manager', ['admission_manager']],
  ['staff-priya', 'Priya', ['telecaller']], ['staff-ramesh', 'Ramesh', ['telecaller']], ['staff-divya', 'Divya', ['telecaller']], ['staff-anil', 'Anil', ['admission_counsellor']],
  ['staff-frontdesk', 'Front Desk', ['front_desk']], ['staff-office', 'Admission Office', ['admission_office']], ['staff-accounts', 'Accounts', ['accounts']],
  ['staff-adminoffice', 'Admin Office', ['admin_office']], ['staff-kavya', 'Kavya', ['front_desk', 'admission_office']], ['staff-chairman', 'Management', ['management']],
  ['staff-principal', 'Principal', ['principal']], ['staff-exam', 'Exam Cell', ['academic_coordinator']], ['staff-krishna', 'S. Krishna Murthy', ['faculty']],
  ['staff-radhika', 'P. Radhika', ['faculty']], ['staff-naresh', 'V. Naresh', ['faculty', 'class_teacher', 'hostel_warden']], ['staff-swathi', 'A. Swathi', ['faculty', 'class_teacher']],
  ['staff-warden', 'Lady Warden', ['hostel_warden']], ['staff-transport', 'Transport In-charge', ['transport_incharge']], ['staff-marketing', 'Content & Marketing', ['data_executive']],
  ['demo-staff-english', 'M. Sujatha (English)', ['faculty']], ['demo-staff-librarian', 'G. Ramana (Librarian)', ['admin_office']],
];
const emailOf = (id: string) => `${id.replace(/^(demo-)?staff-/, '')}@bjc.demo`;

async function ensureStaff(): Promise<Map<string, string>> {
  let password = env('DEMO_STAFF_PASSWORD');
  if (!password) {
    password = `Bjc-${randomBytes(9).toString('base64url')}`;
    appendFileSync(ENV_FILE, `\n# Demo staff password for the test Supabase project (npm run seed:supabase). Never commit.\nDEMO_STAFF_PASSWORD=${password}\n`);
    console.log('Saved a new DEMO_STAFF_PASSWORD in .env.local.');
  }
  const existing = new Map<string, string>();
  for (let page = 1; page < 20; page++) {
    const r = check(await sb.auth.admin.listUsers({ page, perPage: 200 }), 'list users');
    for (const u of r.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
    if (r.users.length < 200) break;
  }
  const map = new Map<string, string>();
  for (const [id, fullName, roles] of STAFF) {
    const email = emailOf(id);
    let uid: string = existing.get(email) ?? '';
    if (!uid) uid = check(await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, demo: true } }), `create ${email}`).user!.id;
    else check(await sb.auth.admin.updateUserById(uid, { password }), `update ${email}`);
    check(await sb.from('profiles').upsert({ id: uid, full_name: fullName, email, active: true }), 'upsert profile');
    check(await sb.from('user_roles').delete().eq('user_id', uid), 'reset roles');
    check(await sb.from('user_roles').insert(roles.map((role) => ({ user_id: uid, role }))), 'insert roles');
    map.set(id, uid);
  }
  console.log(`Staff ready: ${map.size} users (emails like priya@bjc.demo).`);
  return map;
}

// ------------------------------------------------------------------ 3. upload
async function main() {
  await clearPrevious();
  if (clearOnly) return console.log('Demo data cleared from Supabase.');
  const staff = await ensureStaff();

  const out = path.join(ROOT, '.data', 'demo-supabase.json');
  if (existsSync(out)) rmSync(out);
  execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/seed-demo.ts'], { env: { ...process.env, DEMO_OUT: out }, stdio: 'ignore' });
  const db = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(out);

  // every demo-… and staff-… id becomes a uuid (staff → their auth user id)
  const id = (v: string | null | undefined): string | null => (v == null ? null : staff.get(v) ?? (v.startsWith('demo-') ? uuid(v) : v));
  const deep = (v: unknown): unknown =>
    typeof v === 'string' ? (staff.get(v) ?? (v.startsWith('demo-') ? uuid(v) : v)) : Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [staff.has(k) || k.startsWith('demo-') ? (id(k) as string) : k, deep(x)])) : v;
  const demo = (r: Any) => r.seedBatch === 'demo-2027';
  const ins = async (table: string, rows: Any[], size = 400) => {
    for (const c of chunks(rows, size)) check(await sb.from(table).insert(c), `insert ${table}`);
    console.log(`  ${table}: ${rows.length}`);
  };

  const leads = db.leads.filter(demo);
  const admitted = new Set(db.students.filter(demo).map((s: Any) => s.leadId));
  const studentByLead = new Map(db.students.filter(demo).map((s: Any) => [s.leadId, s]));
  const manifest: Any = { leads: leads.map((l: Any) => id(l.id)), siblings: leads.filter((l: Any) => l.siblingOf).map((l: Any) => id(l.id)), students: [], conversations: [], waMessages: [], importBatches: [], records: {}, counters: [] };
  // write the manifest first so a failed upload can still be cleared
  const saveManifest = async () => check(await sb.from('records').upsert({ ...MANIFEST, k1: null, k2: null, data: manifest, updated_at: new Date().toISOString() }, { onConflict: 'collection,id' }), 'save manifest');
  manifest.students = db.students.filter(demo).map((s: Any) => id(s.id));
  manifest.conversations = db.conversations.filter(demo).map((c: Any) => id(c.id));
  manifest.waMessages = db.waMessages.filter(demo).map((w: Any) => id(w.id));
  manifest.importBatches = db.importBatches.filter(demo).map((b: Any) => id(b.id));
  for (const [c, rows] of Object.entries(db.records as Record<string, Any[]>)) { const ids = rows.filter(demo).map((r) => id(r.id)); if (ids.length) manifest.records[c] = ids; }
  manifest.counters = ['college_id:2027:JEE', 'college_id:2027:NEET', 'receipt:2027-28'];
  await saveManifest();

  console.log('Uploading…');
  await ins('import_batches', db.importBatches.filter(demo).map((b: Any) => ({ id: id(b.id), file_name: b.fileName, source: b.source, actor_id: id(b.actorId), total_rows: b.totalRows, invalid: b.invalid, duplicates_in_file: b.duplicatesInFile, created: b.created, merged: b.merged, created_at: b.createdAt })));
  const leadRow = (l: Any) => ({
    id: id(l.id), phone: l.phone, contact_name: l.contactName, parent_name: l.parentName, student_name: l.studentName, student_phone: l.studentPhone, school: l.school, class_level: l.studentClass, board: l.board, area: l.area,
    program: l.program, category: l.category, status: l.status, stage: l.stage, owner_id: id(l.ownerId), first_source: l.firstSource, last_source: l.lastSource, consent: true, consent_at: l.consentAt,
    next_follow_up_at: l.nextFollowUpAt, last_contact_at: l.lastContactAt, lost_reason: l.lostReason, lost_competitor: l.lostCompetitor, created_at: l.createdAt, updated_at: l.updatedAt, assigned_at: l.assignedAt, sibling_of: id(l.siblingOf),
  });
  await ins('leads', leads.filter((l: Any) => !l.siblingOf).map(leadRow));
  await ins('leads', leads.filter((l: Any) => l.siblingOf).map(leadRow));
  await ins('lead_touchpoints', db.touchpoints.filter(demo).map((t: Any) => ({ id: id(t.id), lead_id: id(t.leadId), source: t.source, program: t.program, note: t.note, created_at: t.createdAt })));
  await ins('lead_audit', db.audit.filter(demo).map((a: Any) => ({ lead_id: id(a.leadId), actor_id: id(a.actorId), action: a.action, field: a.field, old_value: a.oldValue, new_value: a.newValue, reason: a.reason, at: a.at })), 1000);
  await ins('call_logs', db.calls.filter(demo).map((c: Any) => ({ id: id(c.id), lead_id: id(c.leadId), actor_id: id(c.actorId), outcome: c.outcome, interest: c.interest, notes: c.notes, next_follow_up_at: c.nextFollowUpAt, created_at: c.createdAt })));
  await ins('visits', db.visits.filter(demo).map((v: Any) => ({ id: id(v.id), lead_id: id(v.leadId), visit_date: v.date, slot: v.slot, family_size: v.familySize, program: v.program, status: v.status, outcome: v.outcome, outcome_at: v.outcomeAt, outcome_by: id(v.outcomeBy), created_at: v.createdAt })));
  await ins('bsat_registrations', db.bsat.filter(demo).map((b: Any) => ({ id: id(b.id), lead_id: id(b.leadId), session_id: '2026-11-16-campus', stream: b.stream, hall_ticket: b.hallTicket, score_pct: 82, created_at: b.createdAt })));
  await ins('admission_stage_events', db.signOffs.filter(demo).map((s: Any) => ({ lead_id: id(s.leadId), stage: s.stage, owner_id: id(s.signedOffBy), signed_off_by: id(s.signedOffBy), completed_at: s.at, note: s.note })));
  await ins('lead_documents', db.documents.filter(demo).map((d: Any) => ({ lead_id: id(d.leadId), doc_key: d.key, status: d.status, note: d.note, updated_by: id(d.updatedBy), updated_at: d.updatedAt })));
  await ins('payments', db.payments.filter(demo).map((p: Any) => ({ id: id(p.id), lead_id: id(p.leadId), amount: p.amount, mode: p.mode, reference: p.reference, paid_on: p.paidOn, status: p.status, recorded_by: id(p.recordedBy), recorded_at: p.recordedAt, approved_by: id(p.approvedBy), approved_at: p.approvedAt, receipt_no: p.receiptNo, receipt_at: p.receiptAt })));
  // College IDs only after all five sign-offs exist (database gate)
  await ins('students', db.students.filter(demo).map((s: Any) => ({ id: id(s.id), lead_id: id(s.leadId), full_name: s.fullName, dob: s.dob, gender: s.gender, program: s.program, stay: s.stay, guardian_name: s.guardianName, guardian_phone: s.guardianPhone, college_id: s.collegeId, created_by: id(s.createdBy), created_at: s.createdAt, login_phone: s.loginPhone })));
  for (const l of leads.filter((x: Any) => admitted.has(x.id))) check(await sb.from('leads').update({ college_id: (studentByLead.get(l.id) as Any).collegeId }).eq('id', id(l.id)), 'set lead college_id');
  await ins('student_guardians', db.guardians.filter(demo).map((g: Any) => ({ student_id: id(g.studentId), phone: g.phone, name: g.name, relation: g.relation, added_by: id(g.addedBy), added_at: g.addedAt })));
  await ins('hostel_events', db.hostelEvents.filter(demo).map((e: Any) => ({ id: id(e.id), student_id: id(e.studentId), direction: e.direction, at: e.at, device: e.device, device_event_id: `bjc-demo-${e.deviceEventId}`, alerted: e.alerted })));
  await ins('wa_messages', db.waMessages.filter(demo).map((w: Any) => ({ id: id(w.id), lead_id: id(w.leadId), to_phone: w.to, template: w.template, body: w.body, status: w.status, provider_message_id: w.providerId, error: w.error, dedupe_key: w.dedupeKey, created_by: id(w.createdBy), created_at: w.createdAt, updated_at: w.createdAt })));
  await ins('conversations', db.conversations.filter(demo).map((c: Any) => ({ id: id(c.id), channel: c.channel, contact_phone: c.contactPhone, contact_name: c.contactName, lead_id: id(c.leadId), status: c.status, assignee_id: id(c.assigneeId), handoff_reason: c.handoffReason, handoff_at: c.handoffAt, last_message_at: c.lastMessageAt, last_inbound_at: c.lastInboundAt, unread: c.unread, visitor_token_hash: c.visitorTokenHash, created_at: c.createdAt, closed_at: c.closedAt, close_note: c.closeNote })));
  await ins('conversation_messages', db.convMessages.filter(demo).map((m: Any) => ({ id: id(m.id), conversation_id: id(m.conversationId), author: m.author, staff_id: id(m.staffId), text: m.text, created_at: m.createdAt })));
  const recRows: Any[] = [];
  for (const [collection, rows] of Object.entries(db.records as Record<string, Any[]>)) for (const r of rows.filter(demo)) recRows.push({ collection, id: id(r.id), k1: deep(r.k1), k2: deep(r.k2), data: deep(r.data), created_at: r.createdAt, updated_at: r.updatedAt });
  await ins('records', recRows, 500);
  for (const [key, value] of Object.entries(db.counters as Record<string, number>)) if (manifest.counters.includes(key)) check(await sb.from('id_counters').upsert({ key, value }), 'counter');
  check(await sb.from('id_counters').upsert({ key: 'receipt:2027-28', value: db.payments.filter((p: Any) => demo(p) && p.receiptNo).length }), 'receipt counter');
  console.log(`Done: ${leads.length} leads, ${manifest.students.length} students uploaded to ${ref}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
