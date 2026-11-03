import 'server-only';
import { can, canSeeLead } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import { CrmError } from '../crm/service';
import type { Staff } from '../crm/types';
import { normalizeIndianMobile } from '../phone';
import { siteUrl } from '../seo';
import { sendTemplate } from '../whatsapp/service';
import { getAppStore } from './service';
import { RELATIONS, type Relation } from './types';

async function admittedStudent(user: Staff, leadId: string) {
  const lead = await getCrmRepo().getLead(leadId);
  if (!lead || !canSeeLead(user, lead)) throw new CrmError('Lead not found.');
  const student = (await getCrmRepo().getVerification(leadId)).student;
  if (!student?.collegeId) throw new CrmError('App access is available once the College ID is issued.');
  return student;
}

export async function guardiansFor(user: Staff, leadId: string) {
  const student = await admittedStudent(user, leadId);
  return { student, guardians: await getAppStore().guardiansOf(student.id), canManage: can(user, 'guardians.manage') };
}

/** Several guardians can sign in for the same student (acceptance criteria). */
export async function addGuardian(user: Staff, leadId: string, g: { name: string; phone: string; relation: string }) {
  if (!can(user, 'guardians.manage')) throw new CrmError('Only the admin office can change app access.');
  const student = await admittedStudent(user, leadId);
  const phone = normalizeIndianMobile(g.phone);
  if (!phone) throw new CrmError('Enter a valid 10-digit Indian mobile number.');
  if (g.name.trim().length < 2) throw new CrmError('Enter the guardian’s name.');
  if (!RELATIONS.includes(g.relation as Relation)) throw new CrmError('Choose the relation.');
  const r = await getAppStore().addGuardian({ studentId: student.id, phone, name: g.name.trim().slice(0, 80), relation: g.relation as Relation, addedBy: user.id });
  if (r === 'exists') throw new CrmError('This number already has app access for this student.');
  await sendTemplate({ template: 'app_welcome', to: phone, params: [student.fullName, student.collegeId!, `${siteUrl}/app`], leadId, dedupeKey: `app_welcome:${student.id}:${phone}` }).catch(() => undefined);
}

export async function removeGuardian(user: Staff, leadId: string, phone: string) {
  if (!can(user, 'guardians.manage')) throw new CrmError('Only the admin office can change app access.');
  const student = await admittedStudent(user, leadId);
  const all = await getAppStore().guardiansOf(student.id);
  if (all.length <= 1) throw new CrmError('Keep at least one guardian with app access. Add the new guardian first.');
  await getAppStore().removeGuardian(student.id, phone);
}
