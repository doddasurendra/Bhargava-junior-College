'use server';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/app/crm/actions';
import { requireAppUser } from '@/lib/app/service';
import { kbGrievances } from '@/lib/kb/collections';
import { audit } from '@/lib/kb/service';
import { getRecordStore } from '@/lib/records';

const CATS = ['academics', 'hostel', 'transport', 'fees', 'staff', 'facilities', 'safety', 'other'] as const;

/** A student or parent raises a grievance (§3, §5). Only for the active profile's own child. */
export async function raiseGrievanceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireAppUser();
  const p = u.active;
  if (!p || (p.kind !== 'student' && p.kind !== 'parent')) return { error: 'Only students and parents can raise a grievance here.' };
  const text = String(fd.get('text') ?? '').trim();
  const category = String(fd.get('category') ?? 'other');
  if (text.length < 5) return { error: 'Please describe the problem (at least a few words).' };
  const now = new Date().toISOString();
  const rec = await kbGrievances.put(getRecordStore(), { from: p.kind === 'parent' ? `parent:${u.phone}` : `student:${p.studentId}`, fromKind: p.kind, studentId: p.studentId, category: (CATS as readonly string[]).includes(category) ? category : 'other', text: text.slice(0, 3000), status: 'open', reply: null, handledBy: null, at: now, updatedAt: now });
  await audit(p.kind === 'parent' ? { kind: 'parent', studentIds: [p.studentId], phone: u.phone } : { kind: 'student', studentId: p.studentId }, 'grievance', 'grievance', rec.id, category);
  revalidatePath('/app/knowledge');
  return { ok: true, message: 'Sent. The college will reply here; you can follow its status below.' };
}
