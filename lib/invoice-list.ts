// The invoice list (brief Part 2, Invoices): rows as at a date, filters, sorting and the totals row.
// Figures come from invoicePositions; cancelled invoices are listed but never counted (R8).
import { BUCKETS } from '@/lib/ar/balances';
import { invoicePositions, type Bucket } from '@/lib/ar/positions';
import type { ArData, Customer, Invoice, Paise } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';

export type ListStatus = 'Paid' | 'Due' | 'Overdue' | 'Cancelled';

export interface InvoiceRow {
  invoice: Invoice;
  customer: Customer;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
  daysPastDue: number;
  status: ListStatus;
  isPartPaid: boolean;
  bucket: Bucket | null;
}

export const STATUS_FILTERS = ['all', 'open', 'overdue', 'due', 'paid', 'cancelled'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const INVOICE_SORT_KEYS = [
  'number', 'customer', 'date', 'due', 'total', 'received', 'credited', 'outstanding', 'status', 'late',
] as const;
export type InvoiceSortKey = (typeof INVOICE_SORT_KEYS)[number];

export interface InvoiceListQuery {
  q: string;
  customer: number | null;
  status: StatusFilter;
  disputed: 'all' | 'yes' | 'no';
  bucket: Bucket | null;
  from: string | null;
  to: string | null;
  sort: InvoiceSortKey;
  dir: 'asc' | 'desc';
}

export interface InvoiceTotals {
  count: number; // invoices counted in the totals (cancelled left out)
  cancelled: number; // cancelled invoices shown but not counted
  total: Paise;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
}

type Param = string | string[] | undefined;
const first = (v: Param) => ((Array.isArray(v) ? v[0] : v) ?? '').trim();

export function parseInvoiceListQuery(params: Record<string, Param>): InvoiceListQuery {
  const status = first(params.status) as StatusFilter;
  const disputed = first(params.disputed);
  const bucket = first(params.bucket) as Bucket;
  const sort = first(params.sort) as InvoiceSortKey;
  const customer = Number(first(params.customer));
  const from = first(params.from);
  const to = first(params.to);
  return {
    q: first(params.q),
    customer: Number.isInteger(customer) && customer > 0 ? customer : null,
    status: STATUS_FILTERS.includes(status) ? status : 'all',
    disputed: disputed === 'yes' || disputed === 'no' ? disputed : 'all',
    bucket: BUCKETS.includes(bucket) ? bucket : null,
    from: isValidDate(from) ? from : null,
    to: isValidDate(to) ? to : null,
    sort: INVOICE_SORT_KEYS.includes(sort) ? sort : 'date',
    dir: first(params.dir) === 'desc' ? 'desc' : 'asc',
  };
}

/** Every invoice dated on or before asOf: live ones with their position, cancelled ones with nothing counted. */
export function invoiceRows(data: ArData, asOf: string): InvoiceRow[] {
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const live: InvoiceRow[] = invoicePositions(data, asOf).map((p) => ({
    ...p,
    customer: customers.get(p.invoice.customerId)!,
  }));
  const cancelled: InvoiceRow[] = data.invoices
    .filter((i) => i.isCancelled && i.invoiceDate <= asOf)
    .map((invoice) => ({
      invoice,
      customer: customers.get(invoice.customerId)!,
      received: 0,
      credited: 0,
      outstanding: 0,
      daysPastDue: 0,
      status: 'Cancelled',
      isPartPaid: false,
      bucket: null,
    }));
  return [...live, ...cancelled];
}

function statusMatches(row: InvoiceRow, filter: StatusFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case 'open': return row.status === 'Due' || row.status === 'Overdue';
    case 'overdue': return row.status === 'Overdue';
    case 'due': return row.status === 'Due';
    case 'paid': return row.status === 'Paid';
    case 'cancelled': return row.status === 'Cancelled';
  }
}

function sortValue(r: InvoiceRow, key: InvoiceSortKey): string | number {
  switch (key) {
    case 'number': return r.invoice.invoiceNo;
    case 'customer': return r.customer.code;
    case 'date': return r.invoice.invoiceDate;
    case 'due': return r.invoice.dueDate;
    case 'total': return r.invoice.total;
    case 'received': return r.received;
    case 'credited': return r.credited;
    case 'outstanding': return r.outstanding;
    case 'status': return r.status;
    case 'late': return r.status === 'Overdue' ? r.daysPastDue : -Infinity; // only overdue invoices are late
  }
}

export function filterInvoiceRows(rows: InvoiceRow[], query: InvoiceListQuery): InvoiceRow[] {
  const needle = query.q.toLowerCase();
  const sign = query.dir === 'desc' ? -1 : 1;
  return rows
    .filter((r) => !needle || r.invoice.invoiceNo.toLowerCase().includes(needle))
    .filter((r) => query.customer === null || r.invoice.customerId === query.customer)
    .filter((r) => statusMatches(r, query.status))
    .filter((r) => query.disputed === 'all' || r.invoice.isDisputed === (query.disputed === 'yes'))
    .filter((r) => query.bucket === null || r.bucket === query.bucket)
    .filter((r) => query.from === null || r.invoice.invoiceDate >= query.from)
    .filter((r) => query.to === null || r.invoice.invoiceDate <= query.to)
    .sort((a, b) => {
      const va = sortValue(a, query.sort);
      const vb = sortValue(b, query.sort);
      const order = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sign * order || a.invoice.invoiceNo.localeCompare(b.invoice.invoiceNo);
    });
}

/** The totals row: adds up the rows shown, leaving out cancelled invoices (R8). */
export function invoiceTotals(rows: InvoiceRow[]): InvoiceTotals {
  const totals: InvoiceTotals = { count: 0, cancelled: 0, total: 0, received: 0, credited: 0, outstanding: 0 };
  for (const r of rows) {
    if (r.status === 'Cancelled') {
      totals.cancelled += 1;
      continue;
    }
    totals.count += 1;
    totals.total += r.invoice.total;
    totals.received += r.received;
    totals.credited += r.credited;
    totals.outstanding += r.outstanding;
  }
  return totals;
}
