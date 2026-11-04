'use server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthStore } from '@/lib/auth/store';
import { listSessions, revokeSession } from '@/lib/auth/sessions';
import { currentSid, getRealStaff, requestCtx, requireStaff, startViewAs } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { RbacError, saveRbac, slugRole, type CustomRole } from '@/lib/crm/rbac';
import { getCrmRepo, usingSupabase } from '@/lib/crm/repo';
import { canSeeLead } from '@/lib/crm/permissions';
import { getRecordStore } from '@/lib/records';
import { placeCall } from '@/lib/telephony';
import type { ActionState } from './actions';

const log = async (staffId: string | null, actorId: string, reason: string) => {
  const ctx = requestCtx();
  await getAuthStore().logEvent({ staffId, actorId, email: null, success: true, method: 'admin', reason, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null });
};

// ---------------------------------------------------------------- permission matrix & custom roles

export async function saveRbacAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('rbac.manage');
  let body: { grants: Record<string, string[]>; customRoles: CustomRole[]; newRole?: { label: string; description: string } | null; removeRole?: string | null };
  try {
    body = JSON.parse(String(fd.get('payload') ?? ''));
  } catch {
    return { error: 'The form could not be read. Reload and try again.' };
  }
  let customRoles = body.customRoles ?? [];
  if (body.newRole?.label?.trim()) {
    const key = slugRole(body.newRole.label);
    if (key.length < 9) return { error: 'Give the role a name of at least 2 letters.' };
    customRoles = [...customRoles, { key, label: body.newRole.label.trim().slice(0, 60), description: body.newRole.description?.trim().slice(0, 200) || null }];
  }
  if (body.removeRole) {
    const holders = (await getCrmRepo().listAllStaff()).filter((s) => s.roles.includes(body.removeRole as never));
    if (holders.length) return { error: `Remove this role from ${holders.map((h) => h.fullName).join(', ')} first.` };
    customRoles = customRoles.filter((r) => r.key !== body.removeRole);
  }
  try {
    const saved = await saveRbac(getRecordStore(), user, { grants: body.grants ?? {}, customRoles });
    // Supabase: user_roles.role references roles(key), so custom roles must exist there too.
    if (usingSupabase()) {
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      if (saved.customRoles.length) {
        const { error } = await sb.from('roles').upsert(saved.customRoles.map((r) => ({ key: r.key, label: r.label, is_staff: true })));
        if (error) return { error: `Saved, but the role list could not be synced: ${error.message}` };
      }
    }
    await log(null, user.id, `permission matrix saved (${saved.customRoles.length} custom roles)`);
    revalidatePath('/crm', 'layout');
    return { ok: true, message: 'Permissions saved. They apply from each person’s next page load.' };
  } catch (e) {
    if (e instanceof RbacError) return { error: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------- "view as" (support, read-only)

export async function startViewAsAction(fd: FormData) {
  const me = await requireStaff('impersonate');
  const target = await getCrmRepo().getStaff(String(fd.get('staffId') ?? ''));
  if (!target || !target.active || target.id === me.id) redirect('/crm/staff');
  startViewAs(target.id);
  await log(target.id, me.id, 'view-as started (read-only)');
  redirect('/crm');
}

// ---------------------------------------------------------------- sessions & devices

/** Sign out one device. Your own sessions from My account; anyone's from Security (Super Admin). */
export async function revokeSessionAction(fd: FormData) {
  const me = await getRealStaff();
  if (!me) redirect('/crm/login');
  const id = String(fd.get('sessionId') ?? '');
  const owner = String(fd.get('staffId') ?? me.id);
  const store = getRecordStore();
  const mine = (await listSessions(store, 'staff', owner)).some((s) => s.id === id);
  if (!mine) return;
  if (owner !== me.id && !can(me, 'security.manage')) return;
  if (id === currentSid()) return; // use Sign out for this device
  await revokeSession(store, id, owner === me.id ? 'signed out remotely by the user' : `signed out by ${me.fullName}`);
  await log(owner, me.id, 'device signed out remotely');
  revalidatePath('/crm/account');
  revalidatePath('/crm/security');
}

// ---------------------------------------------------------------- click-to-call (field masking)

export interface CallState {
  error?: string;
  tel?: string;
  message?: string;
}

/**
 * §9A.1: telecallers don't see raw numbers; they call through click-to-call. With cloud telephony configured
 * the call is bridged to the telecaller's phone and the number never reaches the browser; without it, the
 * number is revealed once for dialling and the reveal is written to the lead's audit trail.
 */
export async function callLeadAction(_: CallState, fd: FormData): Promise<CallState> {
  const user = await requireStaff('lead.call');
  const repo = getCrmRepo();
  const lead = await repo.getLead(String(fd.get('leadId') ?? ''));
  if (!lead || !canSeeLead(user, lead)) return { error: 'Lead not found.' };
  const r = await placeCall({ agent: user, to: lead.phone, leadId: lead.id });
  await repo.updateLead(lead.id, {}, [{ action: r.kind === 'bridged' ? 'call_started' : 'phone_revealed', actorId: user.id, field: 'phone', newValue: r.kind === 'bridged' ? 'cloud telephony' : 'click-to-call', reason: null }]);
  if (r.kind === 'bridged') return { message: 'Calling: your phone will ring first, then the parent.' };
  if (r.kind === 'error') return { error: r.message };
  return { tel: lead.phone };
}
