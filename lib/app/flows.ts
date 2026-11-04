import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PROGRAM_SLUGS } from '@/content/programs';
import { getContent } from '../cms';
import { getCrmRepo } from '../crm/repo';
import { GATEWAY } from '../crm/verification';
import { todayIST } from '../dates';
import { normalizeIndianMobile } from '../phone';
import { alumni, applicantDocs, applications } from '../records/collections';
import { getRecordStore } from '../records';
import { SchoolError } from '../school/common';
import { putFile, sniffType, MAX_BYTES } from '../storage';
import { getStore } from '../store';
import { validateVisit } from '../visits';

// ---------------------------------------------------------------- online application (§4.2 row 15, §9A row 19)

export const applicationSchema = z.object({
  studentName: z.string().trim().min(2, 'Enter the student’s name').max(80),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth'),
  gender: z.enum(['female', 'male', 'other']),
  program: z.enum(PROGRAM_SLUGS),
  stay: z.enum(['day', 'hostel']),
  school: z.string().trim().min(2, 'Enter the current school').max(120),
  board: z.string().trim().min(2).max(40),
  sscMarks: z.string().trim().max(20).optional().nullable().transform((v) => v || null),
  parentName: z.string().trim().min(2, 'Enter the parent’s name').max(80),
  address: z.string().trim().min(10, 'Enter the full address').max(400),
});

export async function getApplication(leadId: string) {
  return (await applications.list(getRecordStore(), { k1: leadId }))[0] ?? null;
}

export async function saveApplication(leadId: string, parentPhone: string, input: unknown, submit: boolean) {
  const v = applicationSchema.parse(input);
  const prev = await getApplication(leadId);
  if (prev?.data.submittedAt) throw new SchoolError('This application has been submitted. Call the admission office to change it.');
  const rec = await applications.put(getRecordStore(), { leadId, ...v, parentPhone, submittedAt: submit ? new Date().toISOString() : null }, prev?.id);
  if (submit) {
    await getCrmRepo().updateLead(leadId, {}, [{ action: 'application_submitted', field: 'application', newValue: `${v.studentName} · ${v.program} · ${v.stay}`, reason: 'Online application from the app' }]);
  }
  return rec;
}

// ---------------------------------------------------------------- applicant document upload

export async function uploadDocument(leadId: string, key: string, file: File) {
  const { documentChecklist } = await getContent();
  const item = documentChecklist.default.find((d) => d.key === key);
  if (!item) throw new SchoolError('Pick a document from the list.');
  if (file.size === 0) throw new SchoolError('The file is empty.');
  if (file.size > MAX_BYTES) throw new SchoolError('Files must be under 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) throw new SchoolError('Upload a PDF, JPG, PNG or WebP file.');
  const storagePath = `${leadId}/${key}-${randomUUID().slice(0, 8)}`;
  await putFile(storagePath, bytes, type);
  const store = getRecordStore();
  const prev = (await applicantDocs.list(store, { k1: leadId, k2: key }))[0];
  await applicantDocs.put(store, { leadId, key, filename: file.name.slice(0, 200) || key, contentType: type, size: file.size, storagePath, uploadedAt: new Date().toISOString() }, prev?.id);
  await getCrmRepo().updateLead(leadId, {}, [{ action: 'document_uploaded', field: 'documents', newValue: item.label, reason: 'Uploaded by the family in the app' }]);
}

export async function documentsFor(leadId: string) {
  return (await applicantDocs.list(getRecordStore(), { k1: leadId })).map((d) => ({ id: d.id, ...d.data }));
}

// ---------------------------------------------------------------- visit reschedule (applicant)

export async function rescheduleVisit(leadId: string, name: string, phone: string, date: string, slot: string) {
  const { visitSlots } = await getContent();
  const invalid = validateVisit(date, slot, visitSlots);
  if (invalid) throw new SchoolError(invalid);
  const repo = getCrmRepo();
  const current = (await repo.getLeadHistory(leadId)).visits.find((v) => v.status === 'scheduled');
  const { visitId } = await getStore().createVisit({ name, phone, date, slot, familySize: current?.familySize ?? 2, program: (current?.program as never) ?? undefined, consent: true });
  if (current) await repo.updateVisit(current.id, { status: 'cancelled' }, [{ action: 'visit_rescheduled', field: 'visit', oldValue: `${current.date} ${current.slot}`, newValue: `${date} ${slot}`, reason: 'Rescheduled by the family in the app' }]);
  return visitId;
}

// ---------------------------------------------------------------- gateway payment (Razorpay)

/** Records a gateway-confirmed payment once (the webhook and checkout callback may both arrive). */
export async function recordGatewayPayment(leadId: string, amountRupees: number, paymentId: string, method: string) {
  const repo = getCrmRepo();
  const v = await repo.getVerification(leadId);
  if (v.payments.some((p) => p.reference === paymentId)) return 'duplicate';
  await repo.addPayment({ leadId, amount: Math.round(amountRupees), mode: method === 'card' ? 'card' : method === 'netbanking' ? 'netbanking' : 'upi', reference: paymentId, paidOn: todayIST(), status: 'approved', recordedBy: GATEWAY, approvedBy: GATEWAY, approvedAt: new Date().toISOString() });
  return 'recorded';
}

// ---------------------------------------------------------------- alumni (§9A row 20)

export async function joinAlumni(phone: string, input: { name: string; passedOut: number; nowAt: string | null; course: string | null; mentorWilling: boolean; story: string | null; studentId: string | null }) {
  const store = getRecordStore();
  const prev = (await alumni.list(store, { k1: phone }))[0];
  return alumni.put(store, { ...input, phone, approved: prev?.data.approved ?? false }, prev?.id);
}

/** An alumnus refers a family: a normal CRM lead with source alumni_referral. */
export async function referFamily(fromName: string, input: { name: string; phone: string; note: string | null }) {
  const phone = normalizeIndianMobile(input.phone);
  if (!phone) throw new SchoolError('Enter a valid 10-digit mobile number.');
  return getStore().captureLead({ name: input.name, phone, source: 'alumni_referral', note: `Referred by alumnus ${fromName}${input.note ? `: ${input.note}` : ''}`, consent: true });
}
