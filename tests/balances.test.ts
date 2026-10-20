import { describe, expect, it } from 'vitest';
import {
  BUCKETS,
  balanceByDocuments,
  balanceCheck,
  customerPositions,
  receiptPositions,
} from '@/lib/ar/balances';
import { addDays } from '@/lib/ar/dates';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const customer = (code: string) => data.customers.find((c) => c.code === code)!;
const customerPosition = (code: string, asOf: string) =>
  customerPositions(data, asOf).find((p) => p.customer.code === code)!;
const receiptPosition = (receiptNo: string, asOf: string) =>
  receiptPositions(data, asOf).find((p) => p.receipt.receiptNo === receiptNo);

/** Every date from `from` to `to`, inclusive. */
function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

describe('receiptPositions (R5)', () => {
  it('settles with bank + TDS, and leaves the rest unapplied until it is allocated', () => {
    // RCT/26-27/0011, C005: 90,000 bank + 10,000 TDS, allocated on 5 Sep
    expect(receiptPosition('RCT/26-27/0011', '2026-08-31')).toMatchObject({
      settlement: 10000000, allocated: 0, unapplied: 10000000,
    });
    expect(receiptPosition('RCT/26-27/0011', '2026-09-05')).toMatchObject({
      settlement: 10000000, allocated: 10000000, unapplied: 0,
    });
  });

  it('adds up a receipt split across two invoices', () => {
    // RCT/26-27/0009, C007: 5,72,400 + 53,000 TDS = 6,25,400 = 4,13,000 + 2,12,400
    expect(receiptPosition('RCT/26-27/0009', '2026-06-25')).toMatchObject({
      settlement: 62540000, allocated: 62540000, unapplied: 0,
    });
  });

  it('leaves out receipts dated after the as-at date', () => {
    expect(receiptPosition('RCT/26-27/0011', '2026-07-09')).toBeUndefined();
    expect(receiptPosition('RCT/26-27/0011', '2026-07-10')).toBeDefined();
  });
});

describe('customerPositions (R13): spot checks', () => {
  it('5: C005 as at 31-Aug-2026 is outstanding 1,88,800, unapplied 1,00,000, net 88,800 Dr', () => {
    expect(customerPosition('C005', '2026-08-31')).toMatchObject({
      outstanding: 18880000,
      unapplied: 10000000,
      netBalance: 8880000,
    });
  });

  it('6: C005 as at 12-Jul-2026 is net 1,00,000 Cr (advance received, invoice not yet raised)', () => {
    expect(customerPosition('C005', '2026-07-12')).toMatchObject({
      outstanding: 0,
      unapplied: 10000000,
      netBalance: -10000000,
      overdue: 0,
    });
  });

  it('keeps unapplied credit out of the buckets', () => {
    const p = customerPosition('C005', '2026-08-31');
    const bucketTotal = BUCKETS.reduce((sum, b) => sum + p.buckets[b], 0);
    expect(bucketTotal).toBe(p.outstanding); // 1,88,800, not 88,800
  });

  it('works out overdue as outstanding less the Not due bucket', () => {
    // C001 as at 31-Aug: only BWA/26-27/0021 (88,500, due 4 Sep) is open, so nothing is overdue
    expect(customerPosition('C001', '2026-08-31')).toMatchObject({ outstanding: 8850000, overdue: 0 });
    // C002 as at 31-Aug: 0003 (69,600, 90 days), 0009 (94,400, due 6 Jul), 0018 (59,000, due 3 Sep)
    expect(customerPosition('C002', '2026-08-31')).toMatchObject({
      outstanding: 22300000,
      overdue: 16400000,
      buckets: expect.objectContaining({ 'Not due': 5900000, '31-60': 9440000, '61-90': 6960000 }),
    });
  });

  it('flags a customer only when the net balance is above the credit limit', () => {
    for (const asOf of eachDay('2026-01-01', '2026-10-31')) {
      for (const p of customerPositions(data, asOf)) {
        expect(p.overLimit).toBe(p.netBalance > p.customer.creditLimit);
      }
    }
  });

  it('includes inactive customers', () => {
    expect(customerPosition('C008', '2026-04-01')).toMatchObject({ outstanding: 5310000, netBalance: 5310000 });
    expect(customerPosition('C008', '2026-04-25')).toMatchObject({ outstanding: 0, netBalance: 0 });
  });

  it('keeps the six buckets adding up to outstanding on every day', () => {
    for (const asOf of eachDay('2026-01-01', '2026-10-31')) {
      for (const p of customerPositions(data, asOf)) {
        expect(BUCKETS.reduce((s, b) => s + p.buckets[b], 0)).toBe(p.outstanding);
      }
    }
  });
});

describe('R14 control check', () => {
  it('balanceByDocuments for C005 matches spot checks 5 and 6', () => {
    expect(balanceByDocuments(data, customer('C005').id, '2026-08-31')).toBe(8880000);
    expect(balanceByDocuments(data, customer('C005').id, '2026-07-12')).toBe(-10000000);
  });

  it('10: balanceCheck is empty for every day from 2026-01-01 to 2026-10-31', () => {
    const days = eachDay('2026-01-01', '2026-10-31');
    expect(days).toHaveLength(304);
    for (const asOf of days) {
      expect(balanceCheck(data, asOf), asOf).toEqual([]);
    }
  });

  it('catches corrupted data: a receipt from C005 allocated to a C001 invoice', () => {
    const c001Invoice = data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0021')!;
    const rct11 = data.receipts.find((r) => r.receiptNo === 'RCT/26-27/0011')!;
    const corrupted: ArData = {
      ...data,
      allocations: [
        ...data.allocations,
        { id: -1, receiptId: rct11.id, invoiceId: c001Invoice.id, allocationDate: '2026-08-31', amount: 100000 },
      ],
    };
    const differences = balanceCheck(corrupted, '2026-08-31');
    expect(differences.map((d) => [d.customer.code, d.difference])).toEqual([
      ['C001', -100000],
      ['C005', 100000],
    ]);
  });
});
