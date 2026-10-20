import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DisputedBadge, InvoiceStatusBadge, PartPaidBadge, PromiseBadge } from '@/components/Badges';
import { isIntraState } from '@/lib/ar/gst';
import { loadArData } from '@/lib/ar/load';
import { promiseStatuses } from '@/lib/ar/notes';
import { invoicePositions } from '@/lib/ar/positions';
import { parseAsOf, withAsOf } from '@/lib/asof';
import { formatDate, formatMoney } from '@/lib/format';

export const instant = false;

const card = 'rounded border border-zinc-200 bg-white';
const th = 'px-3 py-2 text-left font-medium';
const thr = 'px-3 py-2 text-right font-medium';
const td = 'px-3 py-2';
const tdr = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

export default async function InvoicePage({ params, searchParams }: PageProps<'/invoices/[id]'>) {
  const id = Number((await params).id);
  const asOf = parseAsOf((await searchParams).asof);
  const data = await loadArData();
  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) notFound();

  const customer = data.customers.find((c) => c.id === invoice.customerId)!;
  const exists = invoice.invoiceDate <= asOf; // R10: an invoice dated after the as-at date does not exist yet
  const position = invoicePositions(data, asOf).find((p) => p.invoice.id === id); // undefined if cancelled or not yet dated
  const receipts = new Map(data.receipts.map((r) => [r.id, r]));
  const allocations = data.allocations
    .filter((a) => a.invoiceId === id && a.allocationDate <= asOf)
    .sort((a, b) => a.allocationDate.localeCompare(b.allocationDate) || a.id - b.id);
  const creditNotes = data.creditNotes
    .filter((c) => c.invoiceId === id && c.creditNoteDate <= asOf)
    .sort((a, b) => a.creditNoteDate.localeCompare(b.creditNoteDate));
  const promises = new Map(promiseStatuses(data, asOf).map((p) => [p.note.id, p]));
  const notes = data.notes
    .filter((n) => n.invoiceId === id && n.noteDate <= asOf)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));
  // The split the invoice was raised with; for a 0% invoice fall back to the customer's state (R3)
  const isIgst = invoice.igst > 0 || (invoice.cgst === 0 && invoice.sgst === 0 && !isIntraState(customer.state));
  const halfRate = invoice.gstRatePct / 2;

  return (
    <div className="space-y-6">
      <div>
        <Link href={withAsOf('/invoices', asOf)} className="text-sm text-blue-700 hover:underline">← Invoices</Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{invoice.invoiceNo}</span>
          {invoice.isCancelled ? (
            <InvoiceStatusBadge status="Cancelled" />
          ) : (
            position && (
              <>
                <InvoiceStatusBadge status={position.status} />
                {position.isPartPaid && <PartPaidBadge />}
              </>
            )
          )}
          {invoice.isDisputed && <DisputedBadge />}
        </h1>
        <p className="text-sm text-zinc-600">
          <Link href={withAsOf(`/customers/${customer.id}`, asOf)} className="text-blue-700 hover:underline">
            {customer.code} · {customer.name}
          </Link>{' '}
          · {customer.city}, {customer.state} · as at {formatDate(asOf)}
        </p>
      </div>

      {invoice.isCancelled && (
        <div className="rounded border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          This invoice is <strong>cancelled</strong>. It keeps its number but is left out of every total, balance,
          ageing figure, statement and DSO.
        </div>
      )}
      {!exists && (
        <div className="rounded border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          This invoice is dated {formatDate(invoice.invoiceDate)}, after the as-at date, so it does not count yet.{' '}
          <Link href={withAsOf(`/invoices/${id}`, invoice.invoiceDate)} className="font-medium underline">
            View as at {formatDate(invoice.invoiceDate)}
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} p-4 text-sm`}>
          <h2 className="font-semibold text-zinc-600">Invoice</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-zinc-500">Invoice date</dt><dd>{formatDate(invoice.invoiceDate)}</dd>
            <dt className="text-zinc-500">Due date</dt><dd>{formatDate(invoice.dueDate)}</dd>
            <dt className="text-zinc-500">Description</dt><dd>{invoice.description}</dd>
          </dl>
        </section>

        <section className={`${card} p-4 text-sm`}>
          <h2 className="font-semibold text-zinc-600">Tax breakdown</h2>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
            <dt className="text-zinc-500">Taxable value</dt><dd className="text-right">{formatMoney(invoice.taxableValue)}</dd>
            {isIgst ? (
              <>
                <dt className="text-zinc-500">IGST @ {invoice.gstRatePct}%</dt><dd className="text-right">{formatMoney(invoice.igst)}</dd>
              </>
            ) : (
              <>
                <dt className="text-zinc-500">CGST @ {halfRate}%</dt><dd className="text-right">{formatMoney(invoice.cgst)}</dd>
                <dt className="text-zinc-500">SGST @ {halfRate}%</dt><dd className="text-right">{formatMoney(invoice.sgst)}</dd>
              </>
            )}
            <dt className="border-t border-zinc-200 pt-1 font-semibold">Total</dt>
            <dd className="border-t border-zinc-200 pt-1 text-right font-semibold">{formatMoney(invoice.total)}</dd>
          </dl>
        </section>

        <section className={`${card} p-4 text-sm`}>
          <h2 className="font-semibold text-zinc-600">Position as at {formatDate(asOf)}</h2>
          {position ? (
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
              <dt className="text-zinc-500">Total</dt><dd className="text-right">{formatMoney(invoice.total)}</dd>
              <dt className="text-zinc-500">Less received</dt><dd className="text-right">{formatMoney(position.received)}</dd>
              <dt className="text-zinc-500">Less credited</dt><dd className="text-right">{formatMoney(position.credited)}</dd>
              <dt className="border-t border-zinc-200 pt-1 font-semibold">Outstanding</dt>
              <dd className="border-t border-zinc-200 pt-1 text-right text-base font-semibold">{formatMoney(position.outstanding)}</dd>
              {position.outstanding > 0 && (
                <>
                  <dt className="text-zinc-500">{position.daysPastDue >= 1 ? 'Days late' : 'Due in'}</dt>
                  <dd className={`text-right ${position.daysPastDue >= 1 ? 'font-semibold text-red-700' : ''}`}>
                    {position.daysPastDue >= 1 ? position.daysPastDue : position.daysPastDue === 0 ? 'today' : `${-position.daysPastDue} days`}
                  </dd>
                  <dt className="text-zinc-500">Ageing bucket</dt>
                  <dd className="text-right">{position.bucket === 'Not due' ? 'Not due' : `${position.bucket} days`}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="mt-2 text-zinc-500">{invoice.isCancelled ? 'Cancelled: nothing outstanding.' : 'Not yet issued on this date.'}</p>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">Payments allocated</h2>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className={th}>Receipt</th><th className={th}>Receipt date</th><th className={th}>Allocated on</th>
              <th className={th}>Mode / reference</th><th className={thr}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => {
              const r = receipts.get(a.receiptId)!;
              return (
                <tr key={a.id} className="border-t border-zinc-100">
                  <td className={`${td} font-mono`}>{r.receiptNo}</td>
                  <td className={td}>{formatDate(r.receiptDate)}</td>
                  <td className={td}>{formatDate(a.allocationDate)}</td>
                  <td className={td}>{r.mode} {r.reference}</td>
                  <td className={tdr}>{formatMoney(a.amount)}</td>
                </tr>
              );
            })}
            {allocations.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-zinc-500">No payments allocated as at {formatDate(asOf)}.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={card}>
        <h2 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">Credit notes</h2>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className={th}>Number</th><th className={th}>Date</th><th className={th}>Reason</th>
              <th className={thr}>Taxable</th><th className={thr}>GST</th><th className={thr}>Total</th>
            </tr>
          </thead>
          <tbody>
            {creditNotes.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className={`${td} font-mono`}>{c.creditNoteNo}</td>
                <td className={td}>{formatDate(c.creditNoteDate)}</td>
                <td className={td}>{c.reason}</td>
                <td className={tdr}>{formatMoney(c.taxableValue)}</td>
                <td className={tdr}>{formatMoney(c.cgst + c.sgst + c.igst)}</td>
                <td className={tdr}>{formatMoney(c.total)}</td>
              </tr>
            ))}
            {creditNotes.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-zinc-500">No credit notes as at {formatDate(asOf)}.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={card}>
        <h2 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">Notes on this invoice</h2>
        <ol className="divide-y divide-zinc-100">
          {notes.map((n) => {
            const promise = promises.get(n.id);
            return (
              <li key={n.id} className="px-3 py-3 text-sm">
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="font-medium text-zinc-800">{formatDate(n.noteDate)}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{n.noteType}</span>
                </div>
                <p className="mt-1">{n.body}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-600">
                  {n.followUpDate && <span>Follow up {formatDate(n.followUpDate)}{n.followUpDone ? ' · done' : ''}</span>}
                  {promise && (
                    <span className="space-x-1">
                      <span>Promised {formatMoney(promise.promiseAmount)} by {formatDate(promise.promiseDate)}</span>
                      <PromiseBadge status={promise.status} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {notes.length === 0 && <li className="px-3 py-4 text-center text-sm text-zinc-500">No notes on this invoice as at {formatDate(asOf)}.</li>}
        </ol>
      </section>
    </div>
  );
}
