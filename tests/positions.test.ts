import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/ar/dates';
import { bucketFor, invoicePositions } from '@/lib/ar/positions';
import { sampleData as data } from './fixture';

const position = (invoiceNo: string, asOf: string) =>
  invoicePositions(data, asOf).find((p) => p.invoice.invoiceNo === invoiceNo);

describe('R12 bucket boundaries', () => {
  it.each([
    [-5, 'Not due'],
    [0, 'Not due'],
    [1, '1-30'],
    [30, '1-30'],
    [31, '31-60'],
    [60, '31-60'],
    [61, '61-90'],
    [90, '61-90'],
    [91, '91-180'],
    [180, '91-180'],
    [181, 'Over 180'],
    [400, 'Over 180'],
  ])('%i days past due is %s', (days, bucket) => {
    expect(bucketFor(days)).toBe(bucket);
  });
});

describe('R11 invoice position: spot checks', () => {
  it('3: BWA/26-27/0003 as at 31-Aug-2026 is 69,600 outstanding, Overdue, part-paid, 90 days, 61-90', () => {
    expect(position('BWA/26-27/0003', '2026-08-31')).toMatchObject({
      received: 7200000,
      credited: 0,
      outstanding: 6960000,
      status: 'Overdue',
      isPartPaid: true,
      daysPastDue: 90,
      bucket: '61-90',
    });
  });

  it('4: BWA/26-27/0021 as at 31-Aug-2026 is Due, 88,500', () => {
    expect(position('BWA/26-27/0021', '2026-08-31')).toMatchObject({
      outstanding: 8850000, status: 'Due', isPartPaid: false, bucket: 'Not due',
    });
  });

  it('4: BWA/26-27/0021 as at 06-Sep-2026 is Overdue 2 days, 88,500', () => {
    expect(position('BWA/26-27/0021', '2026-09-06')).toMatchObject({
      outstanding: 8850000, status: 'Overdue', daysPastDue: 2, bucket: '1-30',
    });
  });

  it('4: BWA/26-27/0021 as at 15-Sep-2026 is Paid', () => {
    expect(position('BWA/26-27/0021', '2026-09-15')).toMatchObject({
      received: 8850000, outstanding: 0, status: 'Paid', isPartPaid: false, bucket: null,
    });
  });

  it('7: BWA/26-27/0007 as at 31-Aug-2026 is 3,000 outstanding after the credit note and TDS receipt', () => {
    expect(position('BWA/26-27/0007', '2026-08-31')).toMatchObject({
      invoice: expect.objectContaining({ total: 29500000 }),
      credited: 2950000, // credit note 29,500.00
      received: 26250000, // receipt 2,40,000.00 + 22,500.00 TDS
      outstanding: 300000,
      status: 'Overdue',
      isPartPaid: true,
    });
  });
});

describe('R10 / R11 traps the brief warns about', () => {
  it('BWA/26-27/0017 as at 31-Aug-2026 is unpaid: the allocation is dated 5 Sep, not the receipt date', () => {
    expect(position('BWA/26-27/0017', '2026-08-31')).toMatchObject({
      received: 0, outstanding: 11800000, isPartPaid: false,
    });
    expect(position('BWA/26-27/0017', '2026-09-05')).toMatchObject({
      received: 10000000, outstanding: 1800000, isPartPaid: true,
    });
  });

  it('is still Due on its due date and Overdue from the next day', () => {
    const due = position('BWA/26-27/0021', '2026-08-31')!.invoice.dueDate;
    expect(due).toBe('2026-09-04');
    expect(position('BWA/26-27/0021', due)).toMatchObject({ status: 'Due', daysPastDue: 0, bucket: 'Not due' });
    expect(position('BWA/26-27/0021', '2026-09-05')).toMatchObject({ status: 'Overdue', daysPastDue: 1, bucket: '1-30' });
  });

  it('leaves out cancelled invoices', () => {
    expect(position('BWA/26-27/0014', '2026-10-31')).toBeUndefined();
  });

  it('leaves out invoices dated after the as-at date, and includes them from their date', () => {
    expect(position('BWA/26-27/0024', '2026-09-04')).toBeUndefined();
    expect(position('BWA/26-27/0024', '2026-09-05')).toBeDefined();
  });

  it('applies a credit note only from its own date', () => {
    expect(position('BWA/26-27/0007', '2026-07-24')!.credited).toBe(0);
    expect(position('BWA/26-27/0007', '2026-07-25')!.credited).toBe(2950000);
  });

  it('never shows outstanding below zero or above the total, on any day of the year', () => {
    for (let d = '2026-01-01'; d <= '2026-10-31'; d = addDays(d, 1)) {
      for (const p of invoicePositions(data, d)) {
        expect(p.outstanding, `${p.invoice.invoiceNo} on ${d}`).toBeGreaterThanOrEqual(0);
        expect(p.outstanding, `${p.invoice.invoiceNo} on ${d}`).toBeLessThanOrEqual(p.invoice.total);
      }
    }
  });
});
