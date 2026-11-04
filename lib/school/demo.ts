import 'server-only';
import { getAppStore } from '../app/service';
import { getCrmRepo } from '../crm/repo';
import { todayIST } from '../dates';
import { getStore } from '../store';
import { batches, buses, hostelRooms, mentorships, timetable } from '../records/collections';
import { allBatches, allStudents, store } from './common';

/**
 * Local development only: admits a handful of SAMPLE students through the real verification gate and sets
 * up two batches, a timetable, mentors, hostel rooms and a bus, so every staff and parent portal has data.
 */
const DEMO = [
  { name: 'Asha Rao', parent: 'Lakshmi Rao', phone: '+919700000101', gender: 'female' as const, stay: 'hostel' as const, program: 'iit-jee' as const },
  { name: 'Ravi Kumar', parent: 'Suresh Kumar', phone: '+919700000102', gender: 'male' as const, stay: 'day' as const, program: 'iit-jee' as const },
  { name: 'Meghana Reddy', parent: 'Sunitha Reddy', phone: '+919700000103', gender: 'female' as const, stay: 'day' as const, program: 'iit-jee' as const },
  { name: 'Karthik Goud', parent: 'Mahesh Goud', phone: '+919700000104', gender: 'male' as const, stay: 'hostel' as const, program: 'neet' as const },
  { name: 'Divya Sri', parent: 'Padma Devi', phone: '+919700000105', gender: 'female' as const, stay: 'hostel' as const, program: 'neet' as const },
  { name: 'Arjun Teja', parent: 'Ravi Teja', phone: '+919700000106', gender: 'male' as const, stay: 'day' as const, program: 'neet' as const },
];

export async function seedSchoolDemo() {
  if ((await allStudents()).length > 0 || (await allBatches()).length > 0) return { created: 0 };
  const repo = getCrmRepo();
  const ids: { id: string; program: string; stay: string; gender: string }[] = [];
  for (const d of DEMO) {
    const { leadId } = await getStore().captureLead({ name: d.parent, phone: d.phone, studentName: d.name, consent: true, source: 'visit', program: d.program });
    await repo.updateLead(leadId, { status: 'confirmed', stage: 'counselling', ownerId: 'staff-anil' }, []);
    await repo.signOffStage(leadId, 'application', 'staff-anil', 'demo');
    for (const k of ['ssc_memo', 'tc', 'study_certificate', 'aadhaar', 'photos']) await repo.setDocument(leadId, k, 'verified', null, 'staff-office');
    await repo.setDocument(leadId, 'caste_income', 'not_applicable', null, 'staff-office');
    await repo.signOffStage(leadId, 'documents', 'staff-office', 'demo');
    await repo.addPayment({ leadId, amount: 75000, mode: 'upi', reference: 'DEMO', paidOn: todayIST(), status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: new Date().toISOString() });
    await repo.signOffStage(leadId, 'fee', 'staff-accounts', 'demo');
    await repo.issueReceipts(leadId, 'staff-accounts');
    await repo.createStudent(leadId, { fullName: d.name, dob: '2010-06-15', gender: d.gender, program: d.program, stay: d.stay, guardianName: d.parent, guardianPhone: d.phone, loginPhone: d.phone.replace('97000001', '97000002') }, 'staff-adminoffice');
    await repo.issueCollegeId(leadId, 'staff-adminoffice');
    const s = (await getAppStore().listStudents()).find((x) => x.leadId === leadId)!;
    await getAppStore().addGuardian({ studentId: s.id, phone: d.phone, name: d.parent, relation: 'mother', addedBy: 'staff-adminoffice' }).catch(() => undefined);
    ids.push({ id: s.id, program: d.program, stay: d.stay, gender: d.gender });
  }
  const jee = await batches.put(store(), { name: 'JEE-1A', program: 'iit-jee', year: 1, section: 'A', capacity: 40, classTeacherId: 'staff-naresh', studentIds: ids.filter((x) => x.program === 'iit-jee').map((x) => x.id), active: true });
  const neet = await batches.put(store(), { name: 'NEET-1A', program: 'neet', year: 1, section: 'A', capacity: 40, classTeacherId: 'staff-swathi', studentIds: ids.filter((x) => x.program === 'neet').map((x) => x.id), active: true });
  // three periods a day, Monday to Saturday, with no teacher in two places at once
  const plan = [
    { batchId: jee.id, slots: [['08:30', '09:30', 'Physics', 'staff-krishna'], ['09:30', '10:30', 'Chemistry', 'staff-radhika'], ['10:45', '11:45', 'Mathematics', 'staff-naresh']] },
    { batchId: neet.id, slots: [['08:30', '09:30', 'Biology', 'staff-swathi'], ['09:30', '10:30', 'Physics', 'staff-krishna'], ['10:45', '11:45', 'Chemistry', 'staff-radhika']] },
  ];
  for (const b of plan) for (let day = 1; day <= 6; day++) for (const [start, end, subject, facultyId] of b.slots) await timetable.put(store(), { batchId: b.batchId, day, start, end, subject, facultyId, room: null });  for (const x of ids) await mentorships.put(store(), { mentorId: x.program === 'iit-jee' ? 'staff-naresh' : 'staff-swathi', studentId: x.id });
  await hostelRooms.put(store(), { block: 'girls', room: 'G-101', ac: true, capacity: 3, studentIds: ids.filter((x) => x.stay === 'hostel' && x.gender === 'female').map((x) => x.id) });
  await hostelRooms.put(store(), { block: 'boys', room: 'B-101', ac: false, capacity: 4, studentIds: ids.filter((x) => x.stay === 'hostel' && x.gender === 'male').map((x) => x.id) });
  await buses.put(store(), { route: 'LB Nagar – Saroornagar', busNo: 'TS09-1234', driverName: 'Ramulu', driverPhone: '+919700000199', studentIds: ids.filter((x) => x.stay === 'day').map((x) => x.id), location: null });
  return { created: ids.length };
}
