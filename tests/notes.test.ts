import { describe, expect, it } from 'vitest';
import { followUpsDue, promiseStatuses } from '@/lib/ar/notes';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const codeOf = (customerId: number) => data.customers.find((c) => c.id === customerId)!.code;

/** The promise noted for a customer on a date, as at asOf. */
const promise = (code: string, noteDate: string, asOf: string) =>
  promiseStatuses(data, asOf).find((p) => codeOf(p.note.customerId) === code && p.note.noteDate === noteDate);

describe('R16 promise status', () => {
  it('9: the promise noted by C002 on 20-Jul-2026 is Broken as at 31-Aug-2026', () => {
    expect(promise('C002', '2026-07-20', '2026-08-31')).toMatchObject({
      promiseDate: '2026-08-01', promiseAmount: 6960000, received: 0, status: 'Broken',
    });
  });

  it('is Pending up to and on the promise date, and Broken from the next day', () => {
    expect(promise('C002', '2026-07-20', '2026-07-31')!.status).toBe('Pending');
    expect(promise('C002', '2026-07-20', '2026-08-01')!.status).toBe('Pending');
    expect(promise('C002', '2026-07-20', '2026-08-02')!.status).toBe('Broken');
  });

  it('stays Broken when the money arrives after the promise date', () => {
    // C002 paid 94,400 on 9 Sep, but the promise of 20 Jul was due by 1 Aug
    expect(promise('C002', '2026-07-20', '2026-09-30')).toMatchObject({ received: 0, status: 'Broken' });
  });

  it('C003 promise (2,34,200 by 30-Sep): Pending on 31-Aug and 30-Sep, Broken from 1-Oct', () => {
    expect(promise('C003', '2026-08-10', '2026-08-31')!.status).toBe('Pending');
    expect(promise('C003', '2026-08-10', '2026-09-30')!.status).toBe('Pending');
    expect(promise('C003', '2026-08-10', '2026-10-01')!.status).toBe('Broken');
    expect(promise('C003', '2026-08-10', '2026-10-15')).toMatchObject({ promiseAmount: 23420000, received: 0, status: 'Broken' });
  });

  it('is Kept as soon as receipts (bank + TDS) reach the promised amount', () => {
    // C002 promised 94,400 by 10 Sep on 2 Sep; RCT/26-27/0016 on 9 Sep is 86,400 + 8,000 TDS
    expect(promise('C002', '2026-09-02', '2026-09-08')).toMatchObject({ received: 0, status: 'Pending' });
    expect(promise('C002', '2026-09-02', '2026-09-09')).toMatchObject({ received: 9440000, status: 'Kept' });
    expect(promise('C002', '2026-09-02', '2026-10-31')!.status).toBe('Kept');
  });

  it('does not exist before its note date', () => {
    expect(promise('C002', '2026-09-02', '2026-09-01')).toBeUndefined();
  });

  it('lists every promise in the sample data once all notes exist', () => {
    expect(promiseStatuses(data, '2026-10-31').map((p) => [codeOf(p.note.customerId), p.status])).toEqual([
      ['C002', 'Broken'],
      ['C003', 'Broken'],
      ['C002', 'Kept'],
    ]);
  });

  it('counts only receipts on or after the note date, and only for that customer', () => {
    const c002 = data.customers.find((c) => c.code === 'C002')!;
    const c003 = data.customers.find((c) => c.code === 'C003')!;
    const withReceipts: ArData = {
      ...data,
      receipts: [
        ...data.receipts,
        // Before the 20-Jul note: does not count
        { id: -1, receiptNo: 'T1', customerId: c002.id, receiptDate: '2026-07-19', bankAmount: 9999900, tdsAmount: 0, mode: 'NEFT', reference: null },
        // Another customer: does not count
        { id: -2, receiptNo: 'T2', customerId: c003.id, receiptDate: '2026-07-25', bankAmount: 9999900, tdsAmount: 0, mode: 'NEFT', reference: null },
        // On the note date, part of the amount: counts, but not enough
        { id: -3, receiptNo: 'T3', customerId: c002.id, receiptDate: '2026-07-20', bankAmount: 5000000, tdsAmount: 0, mode: 'NEFT', reference: null },
        // On the promise date, the rest with TDS: now kept
        { id: -4, receiptNo: 'T4', customerId: c002.id, receiptDate: '2026-08-01', bankAmount: 1760000, tdsAmount: 200000, mode: 'NEFT', reference: null },
      ],
    };
    const at = (asOf: string) => promiseStatuses(withReceipts, asOf).find((p) => p.note.noteDate === '2026-07-20')!;
    expect(at('2026-07-31')).toMatchObject({ received: 5000000, status: 'Pending' });
    expect(at('2026-08-31')).toMatchObject({ received: 6960000, status: 'Kept' });
  });
});

describe('R16 follow-ups due', () => {
  const due = (asOf: string, d: ArData = data) =>
    followUpsDue(d, asOf).map((f) => [codeOf(f.note.customerId), f.note.followUpDate, f.daysOverdue]);

  it('has none as at 31-Aug-2026: every follow-up date is later', () => {
    expect(due('2026-08-31')).toEqual([]);
  });

  it('lists open follow-ups dated on or before the as-at date, oldest first', () => {
    expect(due('2026-09-10')).toEqual([
      ['C006', '2026-09-01', 9],
      ['C004', '2026-09-05', 5],
      ['C004', '2026-09-10', 0],
    ]);
    expect(due('2026-09-15')).toHaveLength(4);
  });

  it('leaves out follow-ups marked done', () => {
    const doneData: ArData = {
      ...data,
      notes: data.notes.map((n) => (n.followUpDate === '2026-09-01' ? { ...n, followUpDone: true } : n)),
    };
    expect(due('2026-09-10', doneData).map((f) => f[1])).toEqual(['2026-09-05', '2026-09-10']);
  });

  it('leaves out notes dated after the as-at date', () => {
    const c001 = data.customers.find((c) => c.code === 'C001')!;
    const laterNote: ArData = {
      ...data,
      notes: [
        ...data.notes,
        {
          id: -1, customerId: c001.id, invoiceId: null, noteDate: '2026-09-20', noteType: 'Call', body: 'Test',
          followUpDate: '2026-09-01', followUpDone: false, promiseDate: null, promiseAmount: null,
        },
      ],
    };
    expect(due('2026-09-10', laterNote)).toHaveLength(3);
    expect(due('2026-09-20', laterNote)).toHaveLength(5);
  });
});
