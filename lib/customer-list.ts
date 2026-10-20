// Search, filter and sort for the customer list (brief Part 2, Customer Master).
// The figures come from customerPositions; this file only chooses and orders rows.
import type { CustomerPosition } from '@/lib/ar/balances';

export type StatusFilter = 'all' | 'active' | 'inactive';
export type SortDir = 'asc' | 'desc';

export const CUSTOMER_SORT_KEYS = [
  'code', 'name', 'location', 'contact', 'creditDays', 'creditLimit', 'balance', 'overdue', 'used', 'status',
] as const;
export type CustomerSortKey = (typeof CUSTOMER_SORT_KEYS)[number];

export interface CustomerListQuery {
  q: string;
  status: StatusFilter;
  sort: CustomerSortKey;
  dir: SortDir;
}

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Reads the list settings from the address bar, falling back to sensible defaults. */
export function parseCustomerListQuery(params: Record<string, Param>): CustomerListQuery {
  const status = first(params.status);
  const sort = first(params.sort);
  return {
    q: first(params.q).trim(),
    status: status === 'active' || status === 'inactive' ? status : 'all',
    sort: (CUSTOMER_SORT_KEYS as readonly string[]).includes(sort) ? (sort as CustomerSortKey) : 'code',
    dir: first(params.dir) === 'desc' ? 'desc' : 'asc',
  };
}

/** Search matches code, name, contact person or email, ignoring case. */
function matches(p: CustomerPosition, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const c = p.customer;
  return [c.code, c.name, c.contactPerson, c.email].some((field) => field?.toLowerCase().includes(needle));
}

/** The value a column sorts by. Text sorts alphabetically; null sorts last. */
function sortValue(p: CustomerPosition, key: CustomerSortKey): string | number | null {
  const c = p.customer;
  switch (key) {
    case 'code': return c.code;
    case 'name': return c.name;
    case 'location': return `${c.city}, ${c.state}`;
    case 'contact': return c.contactPerson;
    case 'creditDays': return c.creditDays;
    case 'creditLimit': return c.creditLimit;
    case 'balance': return p.netBalance;
    case 'overdue': return p.overdue;
    case 'used': return p.creditUsedPct;
    case 'status': return c.isActive ? 'Active' : 'Inactive';
  }
}

function compare(a: string | number | null, b: string | number | null): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-IN', { sensitivity: 'base' });
}

export function customerListRows(positions: CustomerPosition[], query: CustomerListQuery): CustomerPosition[] {
  const sign = query.dir === 'desc' ? -1 : 1;
  return positions
    .filter((p) => query.status === 'all' || p.customer.isActive === (query.status === 'active'))
    .filter((p) => matches(p, query.q))
    .sort((a, b) => {
      const va = sortValue(a, query.sort);
      const vb = sortValue(b, query.sort);
      if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1; // nulls last either way
      return sign * compare(va, vb) || a.customer.code.localeCompare(b.customer.code);
    });
}
