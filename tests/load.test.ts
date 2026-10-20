import { describe, expect, it } from 'vitest';
import { paise } from '@/lib/ar/rows';
import { sampleData as data } from './fixture';

describe('fixture', () => {
  it('holds the sample data from brief Part 3.5', () => {
    expect(data.customers).toHaveLength(8);
    expect(data.invoices).toHaveLength(29);
    expect(data.creditNotes).toHaveLength(1);
    expect(data.receipts).toHaveLength(17);
    expect(data.allocations).toHaveLength(18);
    expect(data.notes).toHaveLength(7);
  });
});

describe('paise conversion', () => {
  it('turns rupees into whole paise', () => {
    expect(paise(88500)).toBe(8850000);
    expect(paise('69600.00')).toBe(6960000);
    expect(paise(0.1 + 0.2)).toBe(30); // 0.30000000000000004 rupees is still 30 paise
  });

  it('converts every amount in the fixture to a whole number of paise', () => {
    const amounts = [
      ...data.customers.map((c) => c.creditLimit),
      ...data.invoices.flatMap((i) => [i.taxableValue, i.cgst, i.sgst, i.igst, i.total]),
      ...data.creditNotes.flatMap((c) => [c.taxableValue, c.cgst, c.sgst, c.igst, c.total]),
      ...data.receipts.flatMap((r) => [r.bankAmount, r.tdsAmount]),
      ...data.allocations.map((a) => a.amount),
    ];
    for (const a of amounts) expect(Number.isInteger(a)).toBe(true);
  });

  it('maps known records correctly', () => {
    const c001 = data.customers.find((c) => c.code === 'C001')!;
    expect(c001).toMatchObject({ state: 'Maharashtra', creditDays: 30, creditLimit: 50000000, tdsRatePct: 10, isActive: true });

    const inv1 = data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0001')!;
    expect(inv1).toMatchObject({
      customerId: c001.id, invoiceDate: '2026-04-05', dueDate: '2026-05-05',
      taxableValue: 7500000, cgst: 675000, sgst: 675000, igst: 0, total: 8850000,
    });

    const rct11 = data.receipts.find((r) => r.receiptNo === 'RCT/26-27/0011')!;
    expect(rct11).toMatchObject({ receiptDate: '2026-07-10', bankAmount: 9000000, tdsAmount: 1000000 });

    expect(data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0014')!.isCancelled).toBe(true);
    expect(data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0010')!.isDisputed).toBe(true);
  });

  it('keeps an empty promise as null and converts a real one', () => {
    const promises = data.notes.filter((n) => n.promiseAmount !== null).map((n) => n.promiseAmount);
    expect(promises).toEqual([6960000, 23420000, 9440000]);
    expect(data.notes.filter((n) => n.promiseAmount === null)).toHaveLength(4);
  });
});
