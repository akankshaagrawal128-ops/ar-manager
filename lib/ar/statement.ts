import { balanceByDocuments, customerPositions } from './balances';
import { addDays } from './dates';
import type { Bucket } from './positions';
import type { ArData, Customer, Paise } from './types';

export type StatementLineType = 'Invoice' | 'Credit note' | 'Payment received' | 'TDS deducted by you';

export interface StatementLine {
  date: string;
  type: StatementLineType;
  documentNo: string;
  particulars: string;
  debit: Paise;
  credit: Paise;
  balance: Paise; // running balance after this line; negative is Cr
}

export interface Statement {
  customer: Customer;
  from: string;
  to: string;
  opening: Paise;
  lines: StatementLine[];
  totalDebit: Paise;
  totalCredit: Paise;
  closing: Paise;
  /** Footer: the outstanding invoices behind the closing balance, by ageing bucket as at `to`. */
  ageing: Record<Bucket, Paise>;
  unapplied: Paise;
}

/** R15: same-date lines go invoices, then credit notes, then receipts, then TDS lines. */
const TYPE_ORDER: Record<StatementLineType, number> = {
  Invoice: 0,
  'Credit note': 1,
  'Payment received': 2,
  'TDS deducted by you': 3,
};

/**
 * R15: statement of account for one customer from `from` to `to` ('YYYY-MM-DD', inclusive).
 * Opening and closing balances are the R14 balance, so the statement always ties to the control check.
 * Cancelled invoices, allocations and notes are left out.
 */
export function statement(data: ArData, customerId: number, from: string, to: string): Statement {
  if (from > to) throw new Error(`The From date (${from}) is after the To date (${to}).`);
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) throw new Error(`Customer ${customerId} not found.`);

  const inPeriod = (date: string) => from <= date && date <= to;
  const lines: Omit<StatementLine, 'balance'>[] = [];

  const invoiceNos = new Map<number, string>();
  for (const i of data.invoices) {
    if (i.customerId !== customerId || i.isCancelled) continue;
    invoiceNos.set(i.id, i.invoiceNo);
    if (inPeriod(i.invoiceDate)) {
      lines.push({ date: i.invoiceDate, type: 'Invoice', documentNo: i.invoiceNo, particulars: i.description, debit: i.total, credit: 0 });
    }
  }
  for (const c of data.creditNotes) {
    const invoiceNo = invoiceNos.get(c.invoiceId);
    if (invoiceNo === undefined || !inPeriod(c.creditNoteDate)) continue;
    lines.push({
      date: c.creditNoteDate, type: 'Credit note', documentNo: c.creditNoteNo,
      particulars: `Against ${invoiceNo}: ${c.reason}`, debit: 0, credit: c.total,
    });
  }
  for (const r of data.receipts) {
    if (r.customerId !== customerId || !inPeriod(r.receiptDate)) continue;
    const reference = [r.mode, r.reference].filter(Boolean).join(' ');
    lines.push({ date: r.receiptDate, type: 'Payment received', documentNo: r.receiptNo, particulars: reference, debit: 0, credit: r.bankAmount });
    if (r.tdsAmount > 0) {
      lines.push({
        date: r.receiptDate, type: 'TDS deducted by you', documentNo: r.receiptNo,
        particulars: `TDS on ${r.receiptNo}`, debit: 0, credit: r.tdsAmount,
      });
    }
  }

  lines.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.documentNo.localeCompare(b.documentNo),
  );

  const opening = balanceByDocuments(data, customerId, addDays(from, -1));
  let balance = opening;
  let totalDebit = 0;
  let totalCredit = 0;
  const withBalance = lines.map((l) => {
    balance += l.debit - l.credit;
    totalDebit += l.debit;
    totalCredit += l.credit;
    return { ...l, balance };
  });

  const position = customerPositions(data, to).find((p) => p.customer.id === customerId)!;
  return {
    customer,
    from,
    to,
    opening,
    lines: withBalance,
    totalDebit,
    totalCredit,
    closing: balance,
    ageing: position.buckets,
    unapplied: position.unapplied,
  };
}
