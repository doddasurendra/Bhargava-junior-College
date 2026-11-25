/**
 * QA test accounts for the Supabase project: one staff login per role (`node scripts/qa-accounts.mjs`).
 *
 * Writes two files into .data/ (gitignored, never commit):
 *   - qa-accounts.sql  — idempotent SQL to run on the Supabase project (SQL editor or the Supabase MCP)
 *   - qa-accounts.md   — the developer credential sheet (email, temporary password, login and dashboard URLs)
 *
 * The SQL creates real Supabase Auth users (bcrypt password, confirmed email identity, the same rows GoTrue
 * writes) plus the app's profile and role rows. Sign-in then goes through Supabase Auth's normal password API.
 * Re-running keeps each account's uuid and resets its password (new sheet). All emails end in @bjc.demo and
 * every account is marked qa_test in its user metadata, so they are easy to find and remove:
 *   delete from auth.users where email like 'qa.%@bjc.demo';   (profiles/roles cascade)
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SITE = process.env.QA_SITE_URL || 'https://bhargava-junior-college.vercel.app';
const OUT = path.join(process.cwd(), '.data');

/** role, label, home dashboard (lib/crm/home.ts) */
export const QA_STAFF = [
  ['developer', 'Developer', '/crm/developer'],
  ['super_admin', 'Super Admin', '/crm'],
  ['management', 'Management / Director / Chairman', '/crm/dashboard'],
  ['principal', 'Principal', '/crm/academics/overview'],
  ['faculty', 'Faculty / Teacher', '/crm/academics/my-classes'],
  ['class_teacher', 'Class Teacher / Mentor', '/crm/mentor'],
  ['academic_coordinator', 'Academic Coordinator / Exam Cell', '/crm/academics'],
  ['admission_manager', 'Admission Manager', '/crm'],
  ['telecaller', 'Telecaller', '/crm'],
  ['admission_counsellor', 'Admission Counsellor', '/crm'],
  ['front_desk', 'Front Desk / Reception', '/crm/front-desk'],
  ['admission_office', 'Admission Office', '/crm/verification'],
  ['accounts', 'Accounts', '/crm/accounts'],
  ['admin_office', 'Admin Office', '/crm/students'],
  ['hostel_warden', 'Hostel Warden', '/crm/hostel'],
  ['transport_incharge', 'Transport In-charge', '/crm/transport'],
  ['data_executive', 'Content & Marketing', '/crm/cms'],
  ['sports_coach', 'Sports Coach', '/crm/sports'],
  ['student_counsellor', 'Student Counsellor', '/crm/wellbeing'],
];

const uuid = (s) => {
  const h = createHash('sha1').update(`bjc-qa:${s}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const qaEmail = (role) => `qa.${role.replace(/_/g, '-')}@bjc.demo`;
export const qaStaffId = (role) => uuid(`staff:${role}`);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
// 16 random characters + a fixed suffix so every password meets the app's rules (lib/auth/staffAdmin.ts)
const newPassword = () => `Qa-${randomBytes(12).toString('base64url')}-7`;

function main() {
  mkdirSync(OUT, { recursive: true });
  const rows = QA_STAFF.map(([role, label, home]) => ({ role, label, home, id: qaStaffId(role), email: qaEmail(role), name: `QA ${label}`, password: newPassword() }));
  const sql = [
    '-- QA staff accounts (scripts/qa-accounts.mjs). Contains passwords: do not commit.',
    'begin;',
    ...rows.flatMap((r) => [
      `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
values ('00000000-0000-0000-0000-000000000000',${q(r.id)},'authenticated','authenticated',${q(r.email)},extensions.crypt(${q(r.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',${q(JSON.stringify({ full_name: r.name, qa_test: true }))},now(),now(),'','','','','','','','')
on conflict (id) do update set encrypted_password = excluded.encrypted_password, email = excluded.email, updated_at = now(), banned_until = null;`,
      `insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values (${q(uuid(`identity:${r.role}`))},${q(r.id)},${q(r.id)},jsonb_build_object('sub',${q(r.id)},'email',${q(r.email)},'email_verified',true),'email',null,now(),now())
on conflict (provider_id, provider) do nothing;`,
      `insert into public.profiles (id,full_name,email,phone,active) values (${q(r.id)},${q(r.name)},${q(r.email)},null,true) on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, active = true;`,
      `delete from public.user_roles where user_id = ${q(r.id)};`,
      `insert into public.user_roles (user_id, role) values (${q(r.id)}, ${q(r.role)});`,
      `update public.staff_auth set failed_count = 0, locked_until = null where profile_id = ${q(r.id)};`,
    ]),
    'commit;',
  ].join('\n');
  writeFileSync(path.join(OUT, 'qa-accounts.sql'), sql + '\n');

  const md = [
    '# Bhargava Junior College: QA staff test accounts (DEVELOPER ONLY, do not share or commit)',
    '',
    `Generated ${new Date().toISOString()} by scripts/qa-accounts.mjs. Login page for every staff role: ${SITE}/crm/login`,
    '',
    '| # | Role | Name | Email | Temporary password | Dashboard |',
    '|---|------|------|-------|--------------------|-----------|',
    ...rows.map((r, i) => `| ${i + 1} | ${r.label} (\`${r.role}\`) | ${r.name} | ${r.email} | \`${r.password}\` | ${SITE}${r.home} |`),
    '',
  ].join('\n');
  writeFileSync(path.join(OUT, 'qa-accounts.md'), md);
  writeFileSync(path.join(OUT, 'qa-accounts.json'), JSON.stringify(rows, null, 2));
  console.log(`Wrote .data/qa-accounts.sql, .data/qa-accounts.md and .data/qa-accounts.json (${rows.length} staff accounts).`);
}

main();
