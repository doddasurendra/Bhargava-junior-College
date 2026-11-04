import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { receiptPdf } from './receiptPdf';

const payment = { id: 'p1', leadId: 'l1', amount: 55000, mode: 'upi', reference: 'UTR123', paidOn: '2026-11-02', status: 'approved' as const, recordedBy: 'staff', recordedAt: '2026-11-02T05:00:00Z', approvedBy: 'acc', approvedAt: '2026-11-02T06:00:00Z', receiptNo: 'BJC/2027-28/00001', receiptAt: '2026-11-02T06:01:00Z' };

describe('receipt PDF', () => {
  it('is a one-page A5 PDF with the logo, titled with the receipt number', async () => {
    const bytes = await receiptPdf(payment, null, { parentName: 'K Srinivas', contactName: null, studentName: 'Ravi Teja', program: 'iit-jee' });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Receipt BJC/2027-28/00001');
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    expect([w, h]).toEqual([420, 595]);
    expect(bytes.length).toBeGreaterThan(20_000); // includes the embedded logo image
  });

  it('refuses a payment without a receipt number', async () => {
    await expect(receiptPdf({ ...payment, receiptNo: null }, null, null)).rejects.toThrow(/No receipt/);
  });
});
