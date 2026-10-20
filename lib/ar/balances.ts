import { invoicePositions, type Bucket, type InvoicePosition } from './positions';
import type { ArData, Customer, Paise, Receipt } from './types';

export const BUCKETS: Bucket[] = ['Not due', '1-30', '31-60', '61-90', '91-180', 'Over 180'];

export interface ReceiptPosition {
  receipt: Receipt;
  settlement: Paise; // bank + TDS (R5)
  allocated: Paise;
  unapplied: Paise;
}

export interface CustomerPosition {
  customer: Customer;
  buckets: Record<Bucket, Paise>;
  outstanding: Paise; // Σ invoice outstanding, before unapplied credit
  unapplied: Paise;
  netBalance: Paise; // negative is a credit balance (Cr)
  overdue: Paise;
  overLimit: boolean;
  creditUsedPct: number | null; // net debit balance as a % of the credit limit (0 when in credit); null when the limit is 0
}

export interface BalanceDifference {
  customer: Customer;
  netBalance: Paise;
  byDocuments: Paise;
  difference: Paise;
}

/** R5 + R13: every receipt dated on or before asOf, with what has been allocated from it by then. */
export function receiptPositions(data: ArData, asOf: string): ReceiptPosition[] {
  const allocated = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) allocated.set(a.receiptId, (allocated.get(a.receiptId) ?? 0) + a.amount);
  }
  return data.receipts
    .filter((r) => r.receiptDate <= asOf)
    .map((r) => {
      const settlement = r.bankAmount + r.tdsAmount;
      const alloc = allocated.get(r.id) ?? 0;
      return { receipt: r, settlement, allocated: alloc, unapplied: settlement - alloc };
    });
}

const emptyBuckets = (): Record<Bucket, Paise> =>
  Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, Paise>;

/**
 * R13: one entry per customer (active or not), built by adding up invoicePositions and
 * receiptPositions. Unapplied credit is kept in its own figure, never netted off a bucket.
 */
export function customerPositions(
  data: ArData,
  asOf: string,
  invoices: InvoicePosition[] = invoicePositions(data, asOf),
  receipts: ReceiptPosition[] = receiptPositions(data, asOf),
): CustomerPosition[] {
  return data.customers.map((customer) => {
    const buckets = emptyBuckets();
    let outstanding = 0;
    for (const p of invoices) {
      if (p.invoice.customerId !== customer.id || p.bucket === null) continue;
      buckets[p.bucket] += p.outstanding;
      outstanding += p.outstanding;
    }
    let unapplied = 0;
    for (const r of receipts) {
      if (r.receipt.customerId === customer.id) unapplied += r.unapplied;
    }
    const netBalance = outstanding - unapplied;
    return {
      customer,
      buckets,
      outstanding,
      unapplied,
      netBalance,
      overdue: outstanding - buckets['Not due'],
      overLimit: netBalance > customer.creditLimit,
      // A customer in credit (an advance) is using none of its limit, not a negative share of it.
      creditUsedPct: customer.creditLimit > 0 ? (Math.max(netBalance, 0) / customer.creditLimit) * 100 : null,
    };
  });
}

/** R14: a customer's balance straight from the documents, without using allocations. */
export function balanceByDocuments(data: ArData, customerId: number, asOf: string): Paise {
  const invoiceIds = new Set<number>();
  let balance = 0;
  for (const i of data.invoices) {
    if (i.customerId !== customerId || i.isCancelled) continue;
    invoiceIds.add(i.id);
    if (i.invoiceDate <= asOf) balance += i.total;
  }
  for (const c of data.creditNotes) {
    if (invoiceIds.has(c.invoiceId) && c.creditNoteDate <= asOf) balance -= c.total;
  }
  for (const r of data.receipts) {
    if (r.customerId === customerId && r.receiptDate <= asOf) balance -= r.bankAmount + r.tdsAmount;
  }
  return balance;
}

/** R14 control check: the customers whose net balance disagrees with the documents. Must always be empty. */
export function balanceCheck(data: ArData, asOf: string): BalanceDifference[] {
  return customerPositions(data, asOf)
    .map((p) => {
      const byDocuments = balanceByDocuments(data, p.customer.id, asOf);
      return { customer: p.customer, netBalance: p.netBalance, byDocuments, difference: p.netBalance - byDocuments };
    })
    .filter((d) => d.difference !== 0);
}
