import { describe, expect, it } from 'vitest';
import { BUCKETS, balanceByDocuments } from '@/lib/ar/balances';
import { addDays } from '@/lib/ar/dates';
import { statement } from '@/lib/ar/statement';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const customer = (code: string) => data.customers.find((c) => c.code === code)!;
const invoice = (no: string) => data.invoices.find((i) => i.invoiceNo === no)!;

describe('R15 statement: spot check 8', () => {
  const s = statement(data, customer('C002').id, '2026-04-01', '2026-08-31');

  it('C002, 01-Apr-2026 to 31-Aug-2026: opening 70,800 Dr, closing 2,23,000 Dr, 7 lines', () => {
    expect(s.opening).toBe(7080000);
    expect(s.closing).toBe(22300000);
    expect(s.lines).toHaveLength(7);
  });

  it('shows each line, in order, with its running balance', () => {
    expect(s.lines.map((l) => [l.date, l.type, l.documentNo, l.debit, l.credit, l.balance])).toEqual([
      ['2026-04-18', 'Invoice', 'BWA/26-27/0003', 14160000, 0, 21240000],
      ['2026-05-20', 'Payment received', 'RCT/26-27/0005', 0, 6480000, 14760000],
      ['2026-05-20', 'TDS deducted by you', 'RCT/26-27/0005', 0, 600000, 14160000],
      ['2026-05-22', 'Invoice', 'BWA/26-27/0009', 9440000, 0, 23600000],
      ['2026-06-15', 'Payment received', 'RCT/26-27/0007', 0, 6000000, 17600000],
      ['2026-06-15', 'TDS deducted by you', 'RCT/26-27/0007', 0, 1200000, 16400000],
      ['2026-07-20', 'Invoice', 'BWA/26-27/0018', 5900000, 0, 22300000],
    ]);
    expect(s.totalDebit).toBe(29500000);
    expect(s.totalCredit).toBe(14280000);
    expect(s.opening + s.totalDebit - s.totalCredit).toBe(s.closing);
  });

  it('footer: the closing balance by ageing bucket, with no unapplied credit', () => {
    expect(s.unapplied).toBe(0);
    expect(s.ageing).toMatchObject({ 'Not due': 5900000, '31-60': 9440000, '61-90': 6960000 });
  });
});

describe('R15 statement: what goes in and what is left out', () => {
  it('leaves out the TDS line when no TDS was deducted', () => {
    // C006 deducts no TDS: 2 invoices + 2 receipts, and no TDS lines
    const s = statement(data, customer('C006').id, '2026-04-01', '2026-07-31');
    expect(s.lines.map((l) => l.type)).toEqual(['Invoice', 'Payment received', 'Invoice', 'Payment received']);
  });

  it('shows a credit note as a credit of its total', () => {
    const s = statement(data, customer('C004').id, '2026-07-01', '2026-07-31');
    expect(s.lines.find((l) => l.type === 'Credit note')).toMatchObject({
      date: '2026-07-25', documentNo: 'BWA/CN/26-27/001', debit: 0, credit: 2950000,
    });
  });

  it('leaves out cancelled invoices', () => {
    const s = statement(data, customer('C007').id, '2026-07-01', '2026-07-31');
    expect(s.lines.map((l) => l.documentNo)).toEqual(['BWA/26-27/0015']); // not 0014
  });

  it('shows an advance as a credit balance (C005, July)', () => {
    const s = statement(data, customer('C005').id, '2026-07-01', '2026-07-12');
    expect(s.opening).toBe(0);
    expect(s.closing).toBe(-10000000); // 1,00,000 Cr
    expect(s.unapplied).toBe(10000000);
  });

  it('refuses a From date after the To date', () => {
    expect(() => statement(data, customer('C002').id, '2026-08-31', '2026-04-01')).toThrow();
  });
});

describe('R15 same-date ordering', () => {
  it('goes invoices, credit notes, receipts, TDS lines, then document number', () => {
    const c001 = customer('C001');
    const template = invoice('BWA/26-27/0021');
    const day = '2026-10-01';
    // Records on one day, deliberately added out of order
    const extra: ArData = {
      ...data,
      receipts: [
        ...data.receipts,
        { id: -2, receiptNo: 'RCT/26-27/0019', customerId: c001.id, receiptDate: day, bankAmount: 100000, tdsAmount: 10000, mode: 'NEFT', reference: 'B' },
        { id: -1, receiptNo: 'RCT/26-27/0018', customerId: c001.id, receiptDate: day, bankAmount: 200000, tdsAmount: 20000, mode: 'NEFT', reference: 'A' },
      ],
      creditNotes: [
        ...data.creditNotes,
        { id: -3, creditNoteNo: 'BWA/CN/26-27/002', invoiceId: -4, creditNoteDate: day, taxableValue: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000, reason: 'Test' },
      ],
      invoices: [
        ...data.invoices,
        { ...template, id: -5, invoiceNo: 'BWA/26-27/0026', invoiceDate: day, dueDate: '2026-10-31' },
        { ...template, id: -4, invoiceNo: 'BWA/26-27/0025', invoiceDate: day, dueDate: '2026-10-31' },
      ],
    };
    const s = statement(extra, c001.id, day, day);
    expect(s.lines.map((l) => `${l.type} ${l.documentNo}`)).toEqual([
      'Invoice BWA/26-27/0025',
      'Invoice BWA/26-27/0026',
      'Credit note BWA/CN/26-27/002',
      'Payment received RCT/26-27/0018',
      'Payment received RCT/26-27/0019',
      'TDS deducted by you RCT/26-27/0018',
      'TDS deducted by you RCT/26-27/0019',
    ]);
  });
});

describe('R15 statement ties to the control check (R14)', () => {
  it('opening and closing equal balanceByDocuments, for every customer and every To date', () => {
    for (const c of data.customers) {
      for (const from of ['2026-01-01', '2026-04-01', '2026-07-15']) {
        for (let to = from; to <= '2026-10-31'; to = addDays(to, 1)) {
          const s = statement(data, c.id, from, to);
          expect(s.opening, `${c.code} opening ${from}`).toBe(balanceByDocuments(data, c.id, addDays(from, -1)));
          expect(s.closing, `${c.code} ${from} to ${to}`).toBe(balanceByDocuments(data, c.id, to));
        }
      }
    }
  });

  it('footer ageing less unapplied credit equals the closing balance', () => {
    for (const c of data.customers) {
      for (const to of ['2026-03-31', '2026-06-30', '2026-07-12', '2026-08-31', '2026-10-31']) {
        const s = statement(data, c.id, '2026-01-01', to);
        const ageingTotal = BUCKETS.reduce((sum, b) => sum + s.ageing[b], 0);
        expect(ageingTotal - s.unapplied, `${c.code} ${to}`).toBe(s.closing);
      }
    }
  });
});
