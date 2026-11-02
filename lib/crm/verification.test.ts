import { describe, expect, it } from 'vitest';
import { canApproveReversal, canRequestReversal, canSignOff, checklistFor, formatCollegeId, formatReceiptNo, outstandingDocuments, reversalCascade, rupeesInWords, stepStates, type PaymentRow, type VerificationRecord } from './verification';

const empty: VerificationRecord = { signOffs: [], documents: [], payments: [], student: null, reversals: [] };
const pay = (p: Partial<PaymentRow>): PaymentRow => ({ id: 'p', leadId: 'l', amount: 50000, mode: 'upi', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 's', recordedAt: '', approvedBy: null, approvedAt: null, receiptNo: null, receiptAt: null, ...p });
const signed = (...stages: string[]) => stages.map((stage) => ({ stage: stage as never, signedOffBy: 's', at: '2026-11-02T10:00:00Z', note: null }));
const blockers = (v: VerificationRecord, stage: string, status: 'confirmed' | 'open' = 'confirmed') => stepStates(status, 'iit-jee', v).find((s) => s.stage === stage)!.blockers;

describe('verification gate (§7.4)', () => {
  it('application needs a confirmed decision', () => {
    expect(blockers(empty, 'application', 'open')).toHaveLength(1);
    expect(blockers(empty, 'application')).toEqual([]);
  });

  it('documents: required must be verified, "if applicable" can be N/A', () => {
    const list = checklistFor('iit-jee');
    const all = list.map((d) => ({ key: d.key, status: 'verified' as const, note: null, updatedBy: null, updatedAt: null }));
    expect(outstandingDocuments(list, all)).toEqual([]);
    const naCaste = all.map((d) => (d.key === 'caste_income' ? { ...d, status: 'not_applicable' as const } : d));
    expect(outstandingDocuments(list, naCaste)).toEqual([]);
    const naAadhaar = all.map((d) => (d.key === 'aadhaar' ? { ...d, status: 'not_applicable' as const } : d));
    expect(outstandingDocuments(list, naAadhaar).map((d) => d.key)).toEqual(['aadhaar']);
    expect(blockers(empty, 'documents')).toHaveLength(list.length);
  });

  it('fee needs an approved payment and no pending approvals', () => {
    expect(blockers(empty, 'fee')).toEqual(['No approved payment yet.']);
    expect(blockers({ ...empty, payments: [pay({}), pay({ id: 'q', status: 'pending_approval' })] }, 'fee')).toEqual(['1 payment awaiting Accounts approval.']);
    expect(blockers({ ...empty, payments: [pay({}), pay({ id: 'r', status: 'rejected' })] }, 'fee')).toEqual([]);
  });

  it('receipt needs fee, student record needs application', () => {
    expect(blockers(empty, 'receipt')).toHaveLength(1);
    expect(blockers({ ...empty, signOffs: signed('fee') }, 'receipt')).toEqual([]);
    expect(blockers(empty, 'student_record')).toHaveLength(1);
    expect(blockers({ ...empty, signOffs: signed('application') }, 'student_record')).toEqual([]);
  });

  it('College ID stays blocked until all five steps are signed off', () => {
    expect(blockers(empty, 'college_id')).toHaveLength(5);
    expect(blockers({ ...empty, signOffs: signed('application', 'documents', 'fee', 'receipt') }, 'college_id')).toEqual(['Student record created: not signed off']);
    expect(blockers({ ...empty, signOffs: signed('application', 'documents', 'fee', 'receipt', 'student_record') }, 'college_id')).toEqual([]);
  });

  it('each step is signed off by its owner role only', () => {
    expect(canSignOff({ roles: ['admission_office'] }, 'documents')).toBe(true);
    expect(canSignOff({ roles: ['accounts'] }, 'documents')).toBe(false);
    expect(canSignOff({ roles: ['accounts'] }, 'receipt')).toBe(true);
    expect(canSignOff({ roles: ['admin_office'] }, 'college_id')).toBe(true);
    expect(canSignOff({ roles: ['super_admin'] }, 'college_id')).toBe(false);
    expect(canSignOff({ roles: ['admission_counsellor'] }, 'application')).toBe(true);
  });
});

describe('reversals', () => {
  it('cascades to dependent steps that are signed off', () => {
    expect(reversalCascade('documents', ['application', 'documents', 'fee'])).toEqual(['documents']);
    expect(reversalCascade('fee', ['fee', 'receipt'])).toEqual(['fee', 'receipt']);
    expect(reversalCascade('application', ['application', 'student_record'])).toEqual(['application', 'student_record']);
    expect(reversalCascade('application', ['application'])).toEqual(['application']);
  });
  it('refuses unsigned steps and anything after a College ID', () => {
    expect(() => reversalCascade('fee', ['application'])).toThrow(/not signed/);
    expect(() => reversalCascade('documents', ['documents', 'college_id'])).toThrow(/College ID/);
  });
  it('owner or manager requests; a different manager approves', () => {
    expect(canRequestReversal({ roles: ['accounts'] }, 'fee')).toBe(true);
    expect(canRequestReversal({ roles: ['accounts'] }, 'documents')).toBe(false);
    expect(canRequestReversal({ roles: ['admission_manager'] }, 'documents')).toBe(true);
    expect(canRequestReversal({ roles: ['admission_manager'] }, 'college_id')).toBe(false);
    const req = { requestedBy: 'm1', status: 'pending' as const };
    expect(canApproveReversal({ id: 'm1', roles: ['admission_manager'] }, req)).toBe(false);
    expect(canApproveReversal({ id: 'm2', roles: ['management'] }, req)).toBe(true);
    expect(canApproveReversal({ id: 'a1', roles: ['accounts'] }, req)).toBe(false);
    expect(canApproveReversal({ id: 'm2', roles: ['management'] }, { ...req, status: 'approved' })).toBe(false);
  });
});

describe('numbering', () => {
  it('formats College IDs and receipt numbers', () => {
    expect(formatCollegeId('iit-jee', 1)).toBe('BJC-2027-JEE-0001');
    expect(formatCollegeId('long-term-neet', 123)).toBe('BJC-2027-LTN-0123');
    expect(() => formatCollegeId('unknown', 1)).toThrow();
    expect(formatReceiptNo(42)).toBe('BJC/2027-28/00042');
  });
  it('writes amounts in Indian words', () => {
    expect(rupeesInWords(155000)).toBe('Rupees One Lakh Fifty Five Thousand Only');
    expect(rupeesInWords(24425)).toBe('Rupees Twenty Four Thousand Four Hundred Twenty Five Only');
    expect(rupeesInWords(10000000)).toBe('Rupees One Crore Only');
    expect(rupeesInWords(5000)).toBe('Rupees Five Thousand Only');
  });
});
