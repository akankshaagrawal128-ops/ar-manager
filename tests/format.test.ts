import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from '@/lib/csv';
import { formatBalance, formatDate, formatMoney, formatPct, toRupeeString } from '@/lib/format';

describe('formatMoney (R18)', () => {
  it('uses the rupee sign and Indian digit grouping', () => {
    expect(formatMoney(12345600)).toBe('₹1,23,456.00');
    expect(formatMoney(1000000050)).toBe('₹1,00,00,000.50');
    expect(formatMoney(8850000)).toBe('₹88,500.00');
    expect(formatMoney(7)).toBe('₹0.07');
    expect(formatMoney(0)).toBe('₹0.00');
  });
});

describe('formatBalance (R18 Dr/Cr)', () => {
  it('shows a debit balance with Dr', () => {
    expect(formatBalance(8880000)).toBe('₹88,800.00 Dr');
  });
  it('shows a credit balance (negative) as a positive amount with Cr', () => {
    expect(formatBalance(-10000000)).toBe('₹1,00,000.00 Cr');
  });
  it('shows a nil balance without a side', () => {
    expect(formatBalance(0)).toBe('₹0.00');
  });
});

describe('formatDate (R18)', () => {
  it('shows dates as 31-Aug-2026', () => {
    expect(formatDate('2026-08-31')).toBe('31-Aug-2026');
    expect(formatDate('2026-01-05')).toBe('05-Jan-2026');
    expect(formatDate('2026-12-01')).toBe('01-Dec-2026');
  });
  it('shows a dash for a missing date', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatPct', () => {
  it('rounds to one decimal and shows a dash when there is no figure', () => {
    expect(formatPct(111.65)).toBe('111.7%');
    expect(formatPct(0)).toBe('0.0%');
    expect(formatPct(null)).toBe('—');
  });
});

describe('toRupeeString (CSV amounts)', () => {
  it('writes plain numbers with two decimals, no ₹ or commas', () => {
    expect(toRupeeString(7080000)).toBe('70800.00');
    expect(toRupeeString(5)).toBe('0.05');
    expect(toRupeeString(0)).toBe('0.00');
    expect(toRupeeString(-10000000)).toBe('-100000.00');
    expect(toRupeeString(123456789)).toBe('1234567.89');
  });
});

describe('CSV (section 4.12)', () => {
  it('quotes a field that contains a comma', () => {
    expect(csvField('Monthly accounting retainer, Apr')).toBe('"Monthly accounting retainer, Apr"');
  });
  it('doubles quotes inside a quoted field', () => {
    expect(csvField('Said "next week"')).toBe('"Said ""next week"""');
  });
  it('quotes a field with a line break', () => {
    expect(csvField('line 1\nline 2')).toBe('"line 1\nline 2"');
  });
  it('leaves plain fields alone and writes empty for null', () => {
    expect(csvField('BWA/26-27/0001')).toBe('BWA/26-27/0001');
    expect(csvField(70800)).toBe('70800');
    expect(csvField(null)).toBe('');
  });
  it('builds a file with a UTF-8 BOM and CRLF line ends', () => {
    expect(toCsv([['Date', 'Amount'], ['2026-04-18', '141600.00']])).toBe(
      '﻿Date,Amount\r\n2026-04-18,141600.00\r\n',
    );
  });
});
