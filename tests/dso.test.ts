import { describe, expect, it } from 'vitest';
import { customerPositions } from '@/lib/ar/balances';
import { dso, salesWindow } from '@/lib/ar/dso';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

describe('R17 DSO', () => {
  it('as at 31-Aug-2026, worked by hand: 21,18,100 ÷ 17,16,900 × 90 = 111.03 → 111 days', () => {
    // Window 03-Jun to 31-Aug: invoices 0011–0023 except cancelled 0014 = 17,46,400,
    // less credit note BWA/CN/26-27/001 (29,500) = 17,16,900
    expect(salesWindow(data, '2026-08-31')).toEqual({ from: '2026-06-03', to: '2026-08-31', sales: 171690000 });
    // Outstanding is before unapplied credit: 21,18,100, not the net 20,18,100
    const outstanding = customerPositions(data, '2026-08-31').reduce((s, p) => s + p.outstanding, 0);
    expect(outstanding).toBe(211810000);
    expect(dso(data, '2026-08-31')).toBe(111);
  });

  it('shows "—" (null) when there are no sales in the window', () => {
    // The last invoice is BWA/26-27/0024 on 05-Sep-2026, so the window 06-Sep to 04-Dec is empty
    expect(salesWindow(data, '2026-12-04')).toMatchObject({ from: '2026-09-06', sales: 0 });
    expect(dso(data, '2026-12-04')).toBeNull();
    // One day earlier the window still reaches 05-Sep and includes that invoice
    expect(salesWindow(data, '2026-12-03').sales).toBe(8850000);
    expect(dso(data, '2026-12-03')).not.toBeNull();
  });

  it('shows "—" before any invoice exists', () => {
    expect(dso(data, '2026-01-19')).toBeNull();
  });

  it('uses a 90-day window including both ends', () => {
    // BWA/26-27/0011 is dated 05-Jun: inside the window as at 02-Sep (05-Jun + 89), outside on 03-Sep
    const has0011 = (asOf: string) => salesWindow(data, asOf).from <= '2026-06-05';
    expect(salesWindow(data, '2026-09-02').from).toBe('2026-06-05');
    expect(has0011('2026-09-02')).toBe(true);
    expect(has0011('2026-09-03')).toBe(false);
  });

  it('leaves the cancelled invoice out of S', () => {
    // BWA/26-27/0014 (01-Jul, 2,36,000) is cancelled; 0015 (02-Jul, 4,72,000) is the only other sale on those days
    const asOf = '2026-07-02';
    const julyOnly = (d: ArData) => salesWindow(d, asOf).sales - salesWindow(d, '2026-06-30').sales;
    expect(julyOnly(data)).toBe(47200000);
  });

  it('treats net sales below zero like zero', () => {
    const bigCreditNote: ArData = {
      ...data,
      creditNotes: [
        ...data.creditNotes,
        { ...data.creditNotes[0], id: -1, creditNoteNo: 'TEST', creditNoteDate: '2026-12-01', total: 99999900 },
      ],
    };
    expect(salesWindow(bigCreditNote, '2026-12-04').sales).toBeLessThan(0);
    expect(dso(bigCreditNote, '2026-12-04')).toBeNull();
  });
});
