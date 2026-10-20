import { describe, expect, it } from 'vitest';
import { customerPositions } from '@/lib/ar/balances';
import {
  filterInvoiceRows,
  invoiceRows,
  invoiceTotals,
  parseInvoiceListQuery,
  type InvoiceListQuery,
} from '@/lib/invoice-list';
import { sampleData as data } from './fixture';

const asOf = '2026-08-31';
const rows = invoiceRows(data, asOf);
const customerId = (code: string) => data.customers.find((c) => c.code === code)!.id;
const list = (query: Partial<InvoiceListQuery>) =>
  filterInvoiceRows(rows, { ...parseInvoiceListQuery({}), ...query });
const numbers = (query: Partial<InvoiceListQuery>) => list(query).map((r) => r.invoice.invoiceNo);

describe('invoiceRows', () => {
  it('lists every invoice dated on or before the as-at date, including the cancelled one', () => {
    // 29 invoices, less BWA/26-27/0024 (dated 5 Sep, after the as-at date)
    expect(rows).toHaveLength(28);
    expect(rows.find((r) => r.invoice.invoiceNo === 'BWA/26-27/0024')).toBeUndefined();
    expect(rows.find((r) => r.invoice.invoiceNo === 'BWA/26-27/0014')).toMatchObject({
      status: 'Cancelled', outstanding: 0, received: 0, credited: 0, bucket: null,
    });
  });
});

describe('invoice list filters', () => {
  it('filters by status, including Cancelled', () => {
    expect(numbers({ status: 'cancelled' })).toEqual(['BWA/26-27/0014']);
    expect(list({ status: 'overdue' })).toHaveLength(11);
    expect(list({ status: 'open' }).every((r) => r.status === 'Due' || r.status === 'Overdue')).toBe(true);
    expect(list({ status: 'paid' }).every((r) => r.outstanding === 0)).toBe(true);
  });

  it('filters by customer', () => {
    expect(numbers({ customer: customerId('C005') })).toEqual(['BWA/26-27/0017', 'BWA/26-27/0022']);
  });

  it('filters by disputed', () => {
    expect(numbers({ disputed: 'yes' })).toEqual(['BWA/26-27/0010']);
    expect(list({ disputed: 'no' })).toHaveLength(27);
  });

  it('filters by invoice date range, both ends included', () => {
    expect(numbers({ from: '2026-08-01', to: '2026-08-20' })).toEqual(['BWA/26-27/0020', 'BWA/26-27/0021', 'BWA/26-27/0022']);
  });

  it('filters by ageing bucket (for click-through from the dashboard)', () => {
    expect(numbers({ customer: customerId('C003'), bucket: '91-180' })).toEqual(['BWA/25-26/0156', 'BWA/26-27/0004']);
  });

  it('searches by invoice number', () => {
    expect(numbers({ q: '0003' })).toEqual(['BWA/26-27/0003']);
    expect(list({ q: '25-26' })).toHaveLength(5);
  });

  it('ignores invalid settings in the address', () => {
    expect(parseInvoiceListQuery({ status: 'deleted', bucket: '1000', from: 'yesterday', customer: 'x', sort: 'magic' }))
      .toMatchObject({ status: 'all', bucket: null, from: null, customer: null, sort: 'date' });
  });
});

describe('invoice list sort', () => {
  it('sorts overdue invoices by days late, longest first', () => {
    expect(numbers({ status: 'overdue', sort: 'late', dir: 'desc' }).slice(0, 2)).toEqual(['BWA/25-26/0141', 'BWA/25-26/0156']);
  });
  it('sorts by outstanding', () => {
    expect(numbers({ sort: 'outstanding', dir: 'desc' })[0]).toBe('BWA/26-27/0015'); // 4,72,000
  });
});

describe('invoice totals row', () => {
  it('as at 31-Aug-2026 the full list totals 21,18,100 outstanding, matching every customer added up', () => {
    const t = invoiceTotals(list({}));
    const byCustomer = customerPositions(data, asOf).reduce((s, p) => s + p.outstanding, 0);
    expect(t.outstanding).toBe(211810000);
    expect(t.outstanding).toBe(byCustomer);
    expect(t.total - t.received - t.credited).toBe(t.outstanding);
  });

  it('leaves the cancelled invoice out of every total', () => {
    const all = invoiceTotals(list({ customer: customerId('C007') }));
    // C007 as at 31-Aug: 0002, 0008, 0015, 0023 (0014 cancelled, 2,36,000, not counted)
    expect(all).toMatchObject({ count: 4, cancelled: 1, total: 41300000 + 21240000 + 47200000 + 25960000 });
  });

  it('adds up only the filtered rows', () => {
    expect(invoiceTotals(list({ status: 'overdue' })).outstanding).toBe(128620000); // 12,86,200
  });
});
