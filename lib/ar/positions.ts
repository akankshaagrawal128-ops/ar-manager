import { daysBetween } from './dates';
import type { ArData, Invoice, Paise } from './types';

export { daysBetween };

export type Bucket = 'Not due' | '1-30' | '31-60' | '61-90' | '91-180' | 'Over 180';

export interface InvoicePosition {
  invoice: Invoice;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
  daysPastDue: number;
  status: 'Paid' | 'Due' | 'Overdue';
  isPartPaid: boolean;
  bucket: Bucket | null;
}

export function bucketFor(daysPastDue: number): Bucket {
  if (daysPastDue <= 0) return 'Not due';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  if (daysPastDue <= 180) return '91-180';
  return 'Over 180';
}

/** R11 + R12: the position of every live invoice at the end of asOf ('YYYY-MM-DD'). */
export function invoicePositions(data: ArData, asOf: string): InvoicePosition[] {
  const received = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) received.set(a.invoiceId, (received.get(a.invoiceId) ?? 0) + a.amount);
  }
  const credited = new Map<number, Paise>();
  for (const c of data.creditNotes) {
    if (c.creditNoteDate <= asOf) credited.set(c.invoiceId, (credited.get(c.invoiceId) ?? 0) + c.total);
  }
  return data.invoices
    .filter((i) => !i.isCancelled && i.invoiceDate <= asOf)
    .map((i) => {
      const rec = received.get(i.id) ?? 0;
      const cred = credited.get(i.id) ?? 0;
      const outstanding = i.total - rec - cred;
      const daysPastDue = daysBetween(i.dueDate, asOf);
      return {
        invoice: i,
        received: rec,
        credited: cred,
        outstanding,
        daysPastDue,
        status: outstanding === 0 ? 'Paid' : daysPastDue >= 1 ? 'Overdue' : 'Due',
        isPartPaid: outstanding > 0 && rec + cred > 0,
        bucket: outstanding === 0 ? null : bucketFor(daysPastDue),
      };
    });
}
