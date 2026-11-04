/** The admission system (brief §3.1–3.2): stage titles and descriptions are the college's exact wording. */

export const OPERATING_PRINCIPLE =
  'Every lead must be tracked. Every parent must receive a timely follow-up. Every campus visit must have a recorded outcome. Every admission must be verified and accounted for.';

export type StageGroup = 'records' | 'telecalling' | 'campus';

export const STAGE_GROUPS: Record<StageGroup, { label: string; swatch: string; card: string }> = {
  records: { label: 'Data and records', swatch: 'bg-[#efe3c8]', card: 'border-[#d9c7a0] bg-[#f8f1e1] dark:border-[#8a7752] dark:bg-[#3a3326]' },
  telecalling: { label: 'Telecalling team', swatch: 'bg-[#ddd3f2]', card: 'border-[#c2b4e6] bg-[#f1ecfb] dark:border-[#6f60a0] dark:bg-[#2d2840]' },
  campus: { label: 'On campus', swatch: 'bg-[#cfe8d2]', card: 'border-[#a9d3ae] bg-[#ebf6ec] dark:border-[#4f8a57] dark:bg-[#23362a]' },
};

export const ADMISSION_STAGES: { no: string; title: string; description: string; group: StageGroup }[] = [
  { no: '1', group: 'records', title: 'School data collection', description: 'collect accurate student and parent details and create a structured lead database.' },
  { no: '2', group: 'records', title: 'Lead allocation', description: 'assign leads to telecallers with clear ownership and access to a shared lead list.' },
  { no: '3', group: 'telecalling', title: 'Initial telecalling', description: 'call parents and students, introduce Bhargava Junior College, and explain relevant courses and facilities.' },
  { no: '4', group: 'telecalling', title: 'Lead classification', description: 'classify each lead as Hot, Warm, Cold or Invalid based on the family’s interest and readiness.' },
  { no: '5A', group: 'telecalling', title: 'Follow-up', description: 'schedule and complete callbacks for families who need more time or information. Record the next follow-up date and outcome.' },
  { no: '5B', group: 'campus', title: 'Campus visit', description: 'schedule visits for interested families and confirm the appointment with the parent before arrival.' },
  { no: '6', group: 'campus', title: 'Campus tour', description: 'showcase classrooms, laboratories, hostels and other relevant campus facilities.' },
  { no: '7', group: 'campus', title: 'Admission counselling', description: 'explain the academic plan, faculty, courses, fee structure, scholarship options and admission process.' },
  { no: '8', group: 'campus', title: 'Admission decision', description: 'record the outcome as Confirmed, Pending or Lost. For pending cases, assign a follow-up owner and date.' },
  { no: '9', group: 'records', title: 'Document & fee verification', description: 'complete the application, verify required documents, confirm fee payment and generate the official receipt.' },
  { no: '10', group: 'records', title: 'Student registration', description: 'create the student record, confirm admission in the institutional system and assign the College ID.' },
];

/** The flowchart's main path (5A and 5B branch after classification and rejoin at the campus visit). */
export const FLOW: { label: string; note: string; group: StageGroup }[] = [
  { label: 'School data', note: 'lead database', group: 'records' },
  { label: 'Qualified & allocated', note: 'Hot · Warm · Cold · Invalid, then an owner', group: 'records' },
  { label: 'Telecalling', note: 'first call, then follow-ups', group: 'telecalling' },
  { label: 'Campus visit & tour', note: 'appointment confirmed', group: 'campus' },
  { label: 'Counselling & decision', note: 'Confirmed · Pending · Lost', group: 'campus' },
  { label: 'Student admitted', note: 'documents and fee paid', group: 'records' },
  { label: 'College ID assigned', note: 'student record created', group: 'records' },
];

export const ADDITIONS: { key: string; title: string; body: string }[] = [
  { key: 'A', title: 'Lead qualification before allocation', body: 'Hot = interested and likely to visit. Warm = interested but needs follow-up. Cold = not currently interested. Invalid = incorrect number or duplicate. The CRM refuses to allocate a lead that is not yet qualified, and never allocates Invalid leads.' },
  { key: 'B', title: 'Follow-up after the campus visit', body: 'Campus visit completed → counselling completed → decision pending → follow-up by the admission counsellor → admission confirmed or lead lost (a lost lead needs a reason).' },
  { key: 'C', title: 'Follow-up pending, with ageing', body: 'Every open lead shows how many days its follow-up is overdue. Overdue alerts the owner; after 24 hours the supervisor; after 48 hours management.' },
  { key: 'D', title: 'Verification checkpoint before the College ID', body: 'Application completed → documents verified → fee payment confirmed → receipt generated → student record created. The College ID button stays disabled until all five are done.' },
  { key: 'E', title: 'Accountability', body: 'Every stage has an owner, and no stage changes without one. An audit trail records who changed what, and when.' },
];
