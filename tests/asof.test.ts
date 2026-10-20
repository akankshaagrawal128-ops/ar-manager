import { describe, expect, it } from 'vitest';
import { isValidDate, parseAsOf, todayInIndia, withAsOf } from '@/lib/asof';

describe('todayInIndia', () => {
  it('uses India time, not the server clock (UTC)', () => {
    // 20:00 UTC on 31 Aug is already 01:30 on 1 Sep in India
    expect(todayInIndia(new Date('2026-08-31T20:00:00Z'))).toBe('2026-09-01');
    // 18:29 UTC is still 23:59 on 31 Aug in India
    expect(todayInIndia(new Date('2026-08-31T18:29:00Z'))).toBe('2026-08-31');
  });
});

describe('isValidDate', () => {
  it('accepts real dates in YYYY-MM-DD form', () => {
    expect(isValidDate('2026-08-31')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
  });
  it('rejects impossible or badly written dates', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-8-31', '31-08-2026', 'rubbish', '', '2026-02-29', '1999-12-31']) {
      expect(isValidDate(bad), bad).toBe(false);
    }
  });
});

describe('parseAsOf', () => {
  const now = new Date('2026-09-18T06:00:00Z'); // 18 Sep, 11:30 IST

  it('uses a valid ?asof= value', () => {
    expect(parseAsOf('2026-08-31', now)).toBe('2026-08-31');
  });
  it('defaults to today in India when missing', () => {
    expect(parseAsOf(undefined, now)).toBe('2026-09-18');
    expect(parseAsOf(null, now)).toBe('2026-09-18');
    expect(parseAsOf('', now)).toBe('2026-09-18');
  });
  it('defaults to today in India when invalid', () => {
    expect(parseAsOf('rubbish', now)).toBe('2026-09-18');
    expect(parseAsOf('2026-02-30', now)).toBe('2026-09-18');
  });
  it('takes the first value when ?asof= appears twice', () => {
    expect(parseAsOf(['2026-08-31', '2026-07-12'], now)).toBe('2026-08-31');
  });
});

describe('withAsOf', () => {
  it('adds the date to a link with or without other parameters', () => {
    expect(withAsOf('/customers', '2026-08-31')).toBe('/customers?asof=2026-08-31');
    expect(withAsOf('/invoices?status=Overdue', '2026-08-31')).toBe('/invoices?status=Overdue&asof=2026-08-31');
    expect(withAsOf('/customers/5#notes', '2026-08-31')).toBe('/customers/5?asof=2026-08-31#notes');
  });
});
