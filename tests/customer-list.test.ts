import { describe, expect, it } from 'vitest';
import { customerPositions } from '@/lib/ar/balances';
import { customerListRows, parseCustomerListQuery, type CustomerListQuery } from '@/lib/customer-list';
import { sampleData as data } from './fixture';

const positions = customerPositions(data, '2026-08-31');
const codes = (query: Partial<CustomerListQuery>) =>
  customerListRows(positions, { q: '', status: 'all', sort: 'code', dir: 'asc', ...query }).map((p) => p.customer.code);

describe('parseCustomerListQuery', () => {
  it('defaults to all customers sorted by code', () => {
    expect(parseCustomerListQuery({})).toEqual({ q: '', status: 'all', sort: 'code', dir: 'asc' });
  });
  it('reads valid settings and ignores invalid ones', () => {
    expect(parseCustomerListQuery({ q: ' pune ', status: 'inactive', sort: 'balance', dir: 'desc' }))
      .toEqual({ q: 'pune', status: 'inactive', sort: 'balance', dir: 'desc' });
    expect(parseCustomerListQuery({ status: 'deleted', sort: 'password', dir: 'sideways' }))
      .toEqual({ q: '', status: 'all', sort: 'code', dir: 'asc' });
  });
});

describe('customer list search', () => {
  it('finds by code, name, contact or email, ignoring case', () => {
    expect(codes({ q: 'c003' })).toEqual(['C003']);
    expect(codes({ q: 'TAMHINI' })).toEqual(['C001']);
    expect(codes({ q: 'neha' })).toEqual(['C001']);
    expect(codes({ q: 'payables@' })).toEqual(['C002']);
    expect(codes({ q: 'pvt. ltd.' })).toEqual(['C001', 'C003', 'C004', 'C005', 'C008']);
  });
  it('returns nothing when nothing matches', () => {
    expect(codes({ q: 'zzz' })).toEqual([]);
  });
});

describe('customer list filter', () => {
  it('shows active or inactive customers', () => {
    expect(codes({ status: 'inactive' })).toEqual(['C008']);
    expect(codes({ status: 'active' })).toHaveLength(7);
    expect(codes({ status: 'all' })).toHaveLength(8);
  });
  it('combines with search', () => {
    expect(codes({ q: 'kamshet', status: 'active' })).toEqual([]);
  });
});

describe('customer list sort', () => {
  it('sorts by balance as at the date, both ways', () => {
    // 31-Aug: C007 7,31,600 > C003 4,46,600 > C004 4,04,200 > C002 2,23,000 > C005 88,800 > C001 88,500 > C006 35,400 > C008 0
    expect(codes({ sort: 'balance', dir: 'desc' })).toEqual(['C007', 'C003', 'C004', 'C002', 'C005', 'C001', 'C006', 'C008']);
    expect(codes({ sort: 'balance', dir: 'asc' })).toEqual(['C008', 'C006', 'C001', 'C005', 'C002', 'C004', 'C003', 'C007']);
  });
  it('sorts by percentage of credit limit used', () => {
    expect(codes({ sort: 'used', dir: 'desc' })[0]).toBe('C003'); // 111.7%, over limit
  });
  it('sorts text alphabetically', () => {
    expect(codes({ sort: 'name' })[0]).toBe('C008'); // Kamshet Hospitality
    expect(codes({ sort: 'contact' })[0]).toBe('C004'); // Dr. Anita Deshpande
  });
  it('breaks ties by code', () => {
    // C001, C003 and C005 all have 30 credit days
    expect(codes({ sort: 'creditDays' }).slice(0, 2)).toEqual(['C006', 'C001']);
  });
});
