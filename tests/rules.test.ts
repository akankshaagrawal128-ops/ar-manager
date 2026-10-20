import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, dueDate } from '@/lib/ar/dates';
import { gstSplit, totalWithGst } from '@/lib/ar/gst';
import { fyLabel, fyStart, nextNumber } from '@/lib/ar/numbering';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const customerOf = (customerId: number) => data.customers.find((c) => c.id === customerId)!;
const invoice = (no: string) => data.invoices.find((i) => i.invoiceNo === no)!;

describe('dates', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween('2026-06-02', '2026-08-31')).toBe(90);
    expect(daysBetween('2026-08-31', '2026-08-31')).toBe(0);
    expect(daysBetween('2026-09-05', '2026-08-31')).toBe(-5);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('adds days across month, year and leap-year boundaries', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
    expect(addDays('2026-12-15', 45)).toBe('2027-01-29');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('R2 due date', () => {
  it('spot check 1: BWA/26-27/0001 is due 05-May-2026', () => {
    expect(dueDate('2026-04-05', 30)).toBe('2026-05-05');
  });

  it('is the invoice date itself when credit days are 0', () => {
    expect(dueDate('2026-04-05', 0)).toBe('2026-04-05');
  });

  it('matches the stored due date of every sample invoice', () => {
    for (const i of data.invoices) {
      expect(dueDate(i.invoiceDate, customerOf(i.customerId).creditDays), i.invoiceNo).toBe(i.dueDate);
    }
  });
});

describe('R3 GST', () => {
  it('spot check 1: BWA/26-27/0001 (C001, Maharashtra) is CGST 6,750 + SGST 6,750, total 88,500', () => {
    const gst = gstSplit('Maharashtra', 7500000, 18);
    expect(gst).toEqual({ cgst: 675000, sgst: 675000, igst: 0 });
    expect(totalWithGst(7500000, gst)).toBe(8850000);
  });

  it('spot check 2: BWA/26-27/0002 (C007, Telangana) is IGST 63,000, total 4,13,000', () => {
    const gst = gstSplit('Telangana', 35000000, 18);
    expect(gst).toEqual({ cgst: 0, sgst: 0, igst: 6300000 });
    expect(totalWithGst(35000000, gst)).toBe(41300000);
  });

  it('rounds each component to the paisa, halves up', () => {
    // ₹0.50 at 9% = 4.5 paise -> 5 paise each for CGST and SGST
    expect(gstSplit('Maharashtra', 50, 18)).toEqual({ cgst: 5, sgst: 5, igst: 0 });
    // ₹1,000.25 at 9% = 9,002.25 paise -> 9,002
    expect(gstSplit('Maharashtra', 100025, 18)).toEqual({ cgst: 9002, sgst: 9002, igst: 0 });
    // ₹1,000.25 at 18% = 18,004.5 paise -> 18,005
    expect(gstSplit('Karnataka', 100025, 18).igst).toBe(18005);
  });

  it('works with other rates', () => {
    expect(gstSplit('Maharashtra', 10000000, 5)).toEqual({ cgst: 250000, sgst: 250000, igst: 0 });
    expect(gstSplit('Gujarat', 10000000, 0)).toEqual({ cgst: 0, sgst: 0, igst: 0 });
  });

  it('matches the stored GST and total of every sample invoice', () => {
    for (const i of data.invoices) {
      const gst = gstSplit(customerOf(i.customerId).state, i.taxableValue, i.gstRatePct);
      expect({ cgst: i.cgst, sgst: i.sgst, igst: i.igst }, i.invoiceNo).toEqual(gst);
      expect(i.total, i.invoiceNo).toBe(totalWithGst(i.taxableValue, gst));
    }
  });

  it('matches the stored GST of the sample credit note (R7: invoice rate and split)', () => {
    for (const c of data.creditNotes) {
      const inv = data.invoices.find((i) => i.id === c.invoiceId)!;
      const gst = gstSplit(customerOf(inv.customerId).state, c.taxableValue, inv.gstRatePct);
      expect({ cgst: c.cgst, sgst: c.sgst, igst: c.igst }).toEqual(gst);
      expect(c.total).toBe(totalWithGst(c.taxableValue, gst));
    }
  });
});

describe('R4 financial year', () => {
  it('runs April to March', () => {
    expect(fyLabel('2026-04-01')).toBe('26-27');
    expect(fyLabel('2026-12-31')).toBe('26-27');
    expect(fyLabel('2027-03-31')).toBe('26-27');
    expect(fyLabel('2026-03-31')).toBe('25-26');
    expect(fyLabel('2099-04-01')).toBe('99-00');
  });

  it('starts on 1 April', () => {
    expect(fyStart('2026-08-31')).toBe('2026-04-01');
    expect(fyStart('2026-04-01')).toBe('2026-04-01');
    expect(fyStart('2026-03-31')).toBe('2025-04-01');
  });
});

describe('R4 next numbers', () => {
  it('follow on from the sample data', () => {
    expect(nextNumber('invoice', data, '2026-10-20')).toBe('BWA/26-27/0025');
    expect(nextNumber('creditNote', data, '2026-10-20')).toBe('BWA/CN/26-27/002');
    expect(nextNumber('receipt', data, '2026-10-20')).toBe('RCT/26-27/0018');
  });

  it('restart each 1 April', () => {
    expect(nextNumber('invoice', data, '2027-04-01')).toBe('BWA/27-28/0001');
    expect(nextNumber('creditNote', data, '2027-04-01')).toBe('BWA/CN/27-28/001');
    expect(nextNumber('receipt', data, '2027-04-01')).toBe('RCT/27-28/0001');
  });

  it('continue the carried-over FY 2025-26 series for a document dated in that year', () => {
    expect(nextNumber('invoice', data, '2026-03-31')).toBe('BWA/25-26/0172');
  });

  it('never reuse the number of a cancelled invoice', () => {
    const withCancelledLast: ArData = {
      ...data,
      invoices: [...data.invoices, { ...invoice('BWA/26-27/0014'), id: -1, invoiceNo: 'BWA/26-27/0025' }],
    };
    expect(withCancelledLast.invoices.at(-1)!.isCancelled).toBe(true);
    expect(nextNumber('invoice', withCancelledLast, '2026-10-20')).toBe('BWA/26-27/0026');
  });

  it('are no longer than 16 characters (GST Rule 46)', () => {
    for (const s of ['invoice', 'creditNote', 'receipt'] as const) {
      expect(nextNumber(s, data, '2026-10-20').length).toBeLessThanOrEqual(16);
    }
  });
});
