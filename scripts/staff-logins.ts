/**
 * Local development only: gives every staff account in the local store (.data/dev-db.json) a sign-in email
 * and a random password, so each role signs in manually with email + password like production.
 *
 *   npm run staff:logins            accounts without a password get one (existing passwords are kept)
 *   npm run staff:logins -- --reset every account gets a new random password
 *
 * The emails use the reserved `.test` domain. The list is written to .data/staff-logins.txt (gitignored, like
 * the rest of .data) and is never printed to the console. Refuses to run against Supabase or in production.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomInt, scryptSync } from 'node:crypto';

const ROOT = process.cwd();
const FILE = path.join(ROOT, '.data', 'dev-db.json');
const OUT = path.join(ROOT, '.data', 'staff-logins.txt');
const reset = process.argv.includes('--reset');

function envLocal(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  const f = path.join(ROOT, '.env.local');
  if (!existsSync(f)) return '';
  const m = readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}
if (process.env.NODE_ENV === 'production') throw new Error('Refusing: NODE_ENV=production.');
if (envLocal('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Refusing: a Supabase service-role key is set. Staff on Supabase are invited from Staff accounts (or register and get approved).');
if (!existsSync(FILE)) throw new Error('No local store yet. Run `npm run dev` once (or `npm run seed:demo`) first.');

/** Same format as lib/auth/service.ts hashPassword. */
const hash = (pw: string) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${scryptSync(pw, salt, 32).toString('base64url')}`;
};
const WORDS = ['river', 'mango', 'orbit', 'lotus', 'cedar', 'prism', 'amber', 'delta', 'falcon', 'harbor', 'ivory', 'jasmine', 'kite', 'lunar', 'maple', 'nectar', 'opal', 'quartz', 'saffron', 'tulip'];
const password = () => `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 9999)}`;
const slug = (id: string, name: string) => (id.replace(/^(demo-)?staff-/, '') || name).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

type Any = Record<string, any>;
const db: Any = JSON.parse(readFileSync(FILE, 'utf8'));
db.staff ??= [];
db.staffAuth ??= [];
const lines: string[] = [];
let changed = 0;
for (const s of db.staff as Any[]) {
  if (!s.active) continue;
  if (!s.email) {
    s.email = `${slug(s.id, s.fullName)}@staff.bjc.test`;
    changed++;
  }
  let a = (db.staffAuth as Any[]).find((x) => x.staffId === s.id);
  if (!a) db.staffAuth.push((a = { staffId: s.id, totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: 0, recoveryHashes: [], failedCount: 0, lockedUntil: null, sessionVersion: 0 }));
  if (a.passwordHash && !reset) {
    lines.push(`${s.fullName.padEnd(34)} ${(s.roles as string[]).join(', ').padEnd(40)} ${s.email.padEnd(36)} (password unchanged)`);
    continue;
  }
  const pw = password();
  a.passwordHash = hash(pw);
  a.sessionVersion = (a.sessionVersion ?? 0) + 1; // a new password signs the old sessions out
  a.failedCount = 0;
  a.lockedUntil = null;
  changed++;
  lines.push(`${s.fullName.padEnd(34)} ${(s.roles as string[]).join(', ').padEnd(40)} ${s.email.padEnd(36)} ${pw}`);
}
writeFileSync(FILE + '.tmp', JSON.stringify(db, null, 2));
renameSync(FILE + '.tmp', FILE);
writeFileSync(OUT, `Local development staff sign-ins (generated ${new Date().toISOString()}). Do not share; regenerate with npm run staff:logins -- --reset\n\n${lines.join('\n')}\n`);
console.log(`${changed} change(s). ${lines.length} staff sign-ins listed in ${path.relative(ROOT, OUT)} (gitignored). Restart nothing: the app reads the store on each request.`);
