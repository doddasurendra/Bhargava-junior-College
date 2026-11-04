import 'server-only';
import { getAppStore } from '../app/service';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { formatDateTime, todayIST } from '../dates';
import { buses, busAttendance, certificates, hostelComplaints, hostelRooms, leaveRequests, nightAttendance, outpasses, sickRoom, visitorLog } from '../records/collections';
import { getStore } from '../store';
import { sendTemplate } from '../whatsapp/service';
import { allStudents, firstName, requireSeesStudent, SchoolError, store, studentsById } from './common';

const need = (ok: boolean, msg = 'You do not have permission to do this.') => {
  if (!ok) throw new SchoolError(msg);
};

// ---------------------------------------------------------------- hostel: rooms, night roll, sick room, complaints

export async function saveRoom(user: Staff, input: { id?: string; block: 'boys' | 'girls'; room: string; ac: boolean; capacity: number }) {
  need(can(user, 'hostel.manage'));
  const prev = input.id ? await hostelRooms.get(store(), input.id) : null;
  const all = await hostelRooms.list(store(), { k1: input.block });
  if (all.some((r) => r.data.room.toLowerCase() === input.room.toLowerCase() && r.id !== input.id)) throw new SchoolError(`Room ${input.room} already exists in this block.`);
  const studentIds = prev?.data.studentIds ?? [];
  if (studentIds.length > input.capacity) throw new SchoolError('More students are in the room than that capacity.');
  return hostelRooms.put(store(), { block: input.block, room: input.room, ac: input.ac, capacity: input.capacity, studentIds }, input.id);
}

export async function allotRoom(user: Staff, studentId: string, roomId: string | null) {
  need(can(user, 'hostel.manage'));
  const s = (await studentsById()).get(studentId);
  if (!s || s.stay !== 'hostel') throw new SchoolError('Only hostellers can be given a room.');
  const rooms = await hostelRooms.list(store());
  for (const r of rooms) if (r.id !== roomId && r.data.studentIds.includes(studentId)) await hostelRooms.put(store(), { ...r.data, studentIds: r.data.studentIds.filter((x) => x !== studentId) }, r.id);
  if (!roomId) return;
  const r = rooms.find((x) => x.id === roomId);
  if (!r) throw new SchoolError('Room not found.');
  if (r.data.studentIds.includes(studentId)) return;
  if (r.data.studentIds.length >= r.data.capacity) throw new SchoolError(`Room ${r.data.room} is full.`);
  if ((r.data.block === 'girls') !== (s.gender === 'female')) throw new SchoolError('Boys and girls have separate blocks.');
  await hostelRooms.put(store(), { ...r.data, studentIds: [...r.data.studentIds, studentId] }, r.id);
}

export async function markNightRoll(user: Staff, block: 'boys' | 'girls', present: string[]) {
  need(can(user, 'hostel.manage'));
  const date = todayIST();
  const residents = (await hostelRooms.list(store(), { k1: block })).flatMap((r) => r.data.studentIds);
  const p = present.filter((x) => residents.includes(x));
  const absent = residents.filter((x) => !p.includes(x));
  const prev = (await nightAttendance.list(store(), { k1: block, k2: date }))[0];
  await nightAttendance.put(store(), { block, date, present: p, absent, markedBy: user.id }, prev?.id);
  return { present: p.length, absent: absent.length };
}

export async function logSickRoom(user: Staff, input: { studentId: string; complaint: string; action: string; doctorCalled: boolean; informParent: boolean }) {
  need(can(user, 'hostel.manage'));
  await requireSeesStudent(user, input.studentId);
  return sickRoom.put(store(), { studentId: input.studentId, at: new Date().toISOString(), complaint: input.complaint, action: input.action, doctorCalled: input.doctorCalled, parentInformed: input.informParent, recordedBy: user.id });
}

export async function addComplaint(byId: string, input: { studentId: string | null; category: 'food' | 'room' | 'cleanliness' | 'safety' | 'other'; text: string }) {
  return hostelComplaints.put(store(), { ...input, status: 'open', resolution: null, by: byId });
}

export async function resolveComplaint(user: Staff, id: string, resolution: string) {
  need(can(user, 'hostel.manage'));
  const c = await hostelComplaints.get(store(), id);
  if (!c) throw new SchoolError('Complaint not found.');
  return hostelComplaints.put(store(), { ...c.data, status: 'resolved', resolution }, c.id);
}

// ---------------------------------------------------------------- out-pass: student → parent → warden

export async function requestOutpass(studentId: string, input: { from: string; to: string; reason: string }) {
  const s = (await studentsById()).get(studentId);
  if (!s || s.stay !== 'hostel') throw new SchoolError('Out-passes are for hostellers.');
  if (!(new Date(input.from) < new Date(input.to))) throw new SchoolError('The out-pass must end after it starts.');
  if (new Date(input.from).getTime() < Date.now() - 3600_000) throw new SchoolError('Pick a time from now on.');
  const open = (await outpasses.list(store(), { k1: studentId })).find((o) => o.data.status === 'requested' || o.data.status === 'parent_approved');
  if (open) throw new SchoolError('You already have an out-pass waiting for approval.');
  const r = await outpasses.put(store(), { studentId, ...input, status: 'requested', parentPhone: null, parentAt: null, wardenId: null, wardenAt: null, note: null });
  for (const g of await getAppStore().guardiansOf(studentId)) {
    await sendTemplate({ template: 'outpass_request', to: g.phone, params: [firstName(s.fullName), formatDateTime(input.from), formatDateTime(input.to), input.reason.slice(0, 120)], leadId: s.leadId, dedupeKey: `outpass:${r.id}:${g.phone}` }).catch(() => undefined);
  }
  return r;
}

export async function parentDecideOutpass(phone: string, outpassId: string, approve: boolean) {
  const o = await outpasses.get(store(), outpassId);
  if (!o || o.data.status !== 'requested') throw new SchoolError('This out-pass is not waiting for you.');
  const guardians = await getAppStore().guardiansOf(o.data.studentId);
  if (!guardians.some((g) => g.phone === phone)) throw new SchoolError('Out-pass not found.');
  return outpasses.put(store(), { ...o.data, status: approve ? 'parent_approved' : 'rejected', parentPhone: phone, parentAt: new Date().toISOString(), note: approve ? null : 'Declined by parent' }, o.id);
}

export async function wardenDecideOutpass(user: Staff, outpassId: string, approve: boolean, note: string | null) {
  need(can(user, 'outpass.approve'));
  const o = await outpasses.get(store(), outpassId);
  if (!o) throw new SchoolError('Out-pass not found.');
  if (approve && o.data.status !== 'parent_approved') throw new SchoolError('A parent must approve it first.');
  if (!['requested', 'parent_approved'].includes(o.data.status)) throw new SchoolError('This out-pass has already been decided.');
  return outpasses.put(store(), { ...o.data, status: approve ? 'approved' : 'rejected', wardenId: user.id, wardenAt: new Date().toISOString(), note }, o.id);
}

export async function markReturned(user: Staff, outpassId: string) {
  need(can(user, 'outpass.approve'));
  const o = await outpasses.get(store(), outpassId);
  if (!o || o.data.status !== 'approved') throw new SchoolError('Only an approved out-pass can be closed.');
  return outpasses.put(store(), { ...o.data, status: 'returned' }, o.id);
}

export async function outpassesFor(studentId: string) {
  return (await outpasses.list(store(), { k1: studentId })).map((o) => ({ id: o.id, ...o.data }));
}

export async function hostelBoard(user: Staff) {
  need(can(user, 'hostel.manage'));
  const [rooms, passes, sick, complaints, roll] = await Promise.all([hostelRooms.list(store()), outpasses.list(store()), sickRoom.list(store(), { limit: 30 }), hostelComplaints.list(store(), { k1: 'open' }), nightAttendance.list(store(), { k2: todayIST() })]);
  const students = (await allStudents()).filter((s) => s.stay === 'hostel');
  return { rooms, passes: passes.filter((p) => ['requested', 'parent_approved', 'approved'].includes(p.data.status)), sick, complaints, roll, students };
}

// ---------------------------------------------------------------- visitor log & gate passes (front desk, hostel)

export async function logVisitor(user: Staff, input: { name: string; phone: string | null; purpose: string; studentId: string | null; place: 'front_desk' | 'hostel'; kind: 'visitor' | 'gate_pass' | 'parcel' }) {
  need(can(user, 'visitor.log'));
  return visitorLog.put(store(), { ...input, date: todayIST(), inAt: new Date().toISOString(), outAt: null, recordedBy: user.id });
}

export async function visitorOut(user: Staff, id: string) {
  need(can(user, 'visitor.log'));
  const v = await visitorLog.get(store(), id);
  if (!v || v.data.outAt) return;
  await visitorLog.put(store(), { ...v.data, outAt: new Date().toISOString() }, v.id);
}

export async function visitorsToday(user: Staff, place?: 'front_desk' | 'hostel') {
  need(can(user, 'visitor.log'));
  return (await visitorLog.list(store(), { k1: todayIST(), ...(place ? { k2: place } : {}) })).map((v) => ({ id: v.id, ...v.data }));
}

/** Walk-in enquiry at the front desk — a normal CRM lead (de-duplicated by phone). */
export async function walkIn(user: Staff, input: { name: string; phone: string; program?: string; studentName?: string; note?: string }) {
  need(can(user, 'walkin.create'));
  const { leadId } = await getStore().captureLead({ name: input.name, phone: input.phone, studentName: input.studentName, program: input.program as never, note: input.note ?? `Walk-in, entered by ${user.fullName}`, source: 'walk_in', consent: true });
  return leadId;
}

// ---------------------------------------------------------------- transport

export async function saveBus(user: Staff, input: { id?: string; route: string; busNo: string; driverName: string; driverPhone: string | null }) {
  need(can(user, 'transport.manage'));
  const prev = input.id ? await buses.get(store(), input.id) : null;
  return buses.put(store(), { route: input.route, busNo: input.busNo, driverName: input.driverName, driverPhone: input.driverPhone, studentIds: prev?.data.studentIds ?? [], location: prev?.data.location ?? null }, input.id);
}

export async function assignBus(user: Staff, studentId: string, busId: string | null) {
  need(can(user, 'transport.manage'));
  const s = (await studentsById()).get(studentId);
  if (!s || s.stay !== 'day') throw new SchoolError('College transport is for day scholars.');
  for (const b of await buses.list(store())) if (b.id !== busId && b.data.studentIds.includes(studentId)) await buses.put(store(), { ...b.data, studentIds: b.data.studentIds.filter((x) => x !== studentId) }, b.id);
  if (!busId) return;
  const b = await buses.get(store(), busId);
  if (!b) throw new SchoolError('Bus not found.');
  if (!b.data.studentIds.includes(studentId)) await buses.put(store(), { ...b.data, studentIds: [...b.data.studentIds, studentId] }, b.id);
}

export async function markBusAttendance(user: Staff, busId: string, trip: 'pickup' | 'drop', present: string[]) {
  need(can(user, 'transport.manage'));
  const b = await buses.get(store(), busId);
  if (!b) throw new SchoolError('Bus not found.');
  const date = todayIST();
  const prev = (await busAttendance.list(store(), { k1: busId, k2: date })).find((r) => r.data.trip === trip);
  return busAttendance.put(store(), { busId, date, trip, present: present.filter((x) => b.data.studentIds.includes(x)), markedBy: user.id }, prev?.id);
}

/** GPS device / driver app pushes the bus position (header-key authenticated route). */
export async function updateBusLocation(busNo: string, lat: number, lng: number) {
  const b = (await buses.list(store())).find((x) => x.data.busNo.toLowerCase() === busNo.toLowerCase());
  if (!b) return null;
  if (!(lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98)) throw new SchoolError('Position outside India.');
  return buses.put(store(), { ...b.data, location: { lat, lng, at: new Date().toISOString() } }, b.id);
}

export async function busFor(studentId: string) {
  return (await buses.list(store())).find((b) => b.data.studentIds.includes(studentId)) ?? null;
}

// ---------------------------------------------------------------- admin office: certificates (TC, bonafide, study, conduct)

const CERT_PREFIX = { tc: 'TC', bonafide: 'BF', study: 'SC', conduct: 'CC' } as const;

export async function issueCertificate(user: Staff, input: { studentId: string; kind: 'tc' | 'bonafide' | 'study' | 'conduct'; purpose: string | null; conduct: string | null }) {
  need(can(user, 'certificates.issue'));
  const s = (await studentsById()).get(input.studentId);
  if (!s?.collegeId) throw new SchoolError('Certificates are for admitted students with a College ID.');
  if (input.kind === 'tc' && (await certificates.list(store(), { k1: input.studentId, k2: 'tc' })).length) throw new SchoolError('A transfer certificate has already been issued for this student.');
  const year = todayIST().slice(0, 4);
  const n = (await certificates.list(store())).filter((c) => c.data.kind === input.kind && c.data.number.includes(`/${year}/`)).length + 1;
  const number = `BJC/${CERT_PREFIX[input.kind]}/${year}/${String(n).padStart(4, '0')}`;
  return certificates.put(store(), { ...input, number, issuedAt: new Date().toISOString(), issuedBy: user.id });
}

export async function certificatesFor(studentId: string) {
  return (await certificates.list(store(), { k1: studentId })).map((c) => ({ id: c.id, ...c.data }));
}

// ---------------------------------------------------------------- staff leave

export async function requestLeave(user: Staff, input: { from: string; to: string; reason: string }) {
  need(can(user, 'leave.request'));
  return leaveRequests.put(store(), { staffId: user.id, ...input, status: 'pending', decidedBy: null });
}

export async function decideLeave(user: Staff, id: string, approve: boolean) {
  need(can(user, 'leave.approve'));
  const l = await leaveRequests.get(store(), id);
  if (!l || l.data.status !== 'pending') throw new SchoolError('This request has already been decided.');
  if (l.data.staffId === user.id) throw new SchoolError('You can’t approve your own leave.');
  return leaveRequests.put(store(), { ...l.data, status: approve ? 'approved' : 'rejected', decidedBy: user.id }, l.id);
}
