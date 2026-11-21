import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cronAuthorised } from '@/lib/cron';
import { getCrmRepo, usingSupabase } from '@/lib/crm/repo';

export const dynamic = 'force-dynamic';

/**
 * First Super Admin on a fresh Supabase project (no one can invite the first one). CRON_SECRET only, and it
 * refuses as soon as any active Super Admin exists. Creates the Supabase Auth user (no password), the staff
 * profile with the super_admin role, and returns a one-time "set your password" link for that person to open
 * (/crm/login/reset?token_hash=…&type=invite). Nobody else ever knows the password.
 */
const body = z.object({ email: z.string().trim().toLowerCase().email(), fullName: z.string().trim().min(2).max(80) });

export async function POST(req: Request) {
  if (!cronAuthorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!usingSupabase()) return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 400 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Give email and fullName.' }, { status: 400 });
  const repo = getCrmRepo();
  if ((await repo.listStaff()).some((s) => s.roles.includes('super_admin'))) return NextResponse.json({ ok: false, error: 'A Super Admin already exists. Use Staff accounts to add people.' }, { status: 409 });

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { email, fullName } = parsed.data;
  const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { full_name: fullName } } });
  if (error || !data.user || !data.properties?.hashed_token) return NextResponse.json({ ok: false, error: `Could not create the sign-in: ${error?.message ?? 'no link'}` }, { status: 500 });
  await repo.saveStaff({ id: data.user.id, fullName, email, phone: null, roles: ['super_admin'], active: true });
  const origin = new URL(req.url).origin;
  return NextResponse.json({ ok: true, staffId: data.user.id, setPasswordLink: `${origin}/crm/login/reset?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=invite`, note: 'One-time link, valid for about 24 hours. Then sign in at /crm/login and set up 2FA.' });
}
