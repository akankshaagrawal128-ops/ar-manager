import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActiveBadge, DisputedBadge, InvoiceStatusBadge, PartPaidBadge, PromiseBadge } from '@/components/Badges';
import { setCustomerActive } from '@/lib/actions/customers';
import { BUCKETS, customerPositions, receiptPositions } from '@/lib/ar/balances';
import { loadArData } from '@/lib/ar/load';
import { followUpsDue, promiseStatuses } from '@/lib/ar/notes';
import { fyStart } from '@/lib/ar/numbering';
import { invoicePositions } from '@/lib/ar/positions';
import { parseAsOf, withAsOf } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney, formatPct } from '@/lib/format';
import { buildHref } from '@/lib/url';

export const instant = false;

const card = 'rounded border border-zinc-200 bg-white';
const th = 'px-3 py-2 text-left font-medium';
const thr = 'px-3 py-2 text-right font-medium';
const td = 'px-3 py-2';
const tdr = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

export default async function CustomerPage({ params, searchParams }: PageProps<'/customers/[id]'>) {
  const id = Number((await params).id);
  const asOf = parseAsOf((await searchParams).asof);
  const data = await loadArData();
  const customer = data.customers.find((c) => c.id === id);
  if (!customer) notFound();

  const position = customerPositions(data, asOf).find((p) => p.customer.id === id)!;
  const invoices = invoicePositions(data, asOf).filter((p) => p.invoice.customerId === id);
  const cancelled = data.invoices.filter((i) => i.customerId === id && i.isCancelled && i.invoiceDate <= asOf);
  const receipts = receiptPositions(data, asOf).filter((r) => r.receipt.customerId === id);
  const promises = new Map(promiseStatuses(data, asOf).map((p) => [p.note.id, p]));
  const dueFollowUps = new Set(followUpsDue(data, asOf).map((f) => f.note.id));
  const notes = data.notes
    .filter((n) => n.customerId === id && n.noteDate <= asOf)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.id - a.id);
  const invoiceNo = new Map(data.invoices.map((i) => [i.id, i.invoiceNo]));

  const statementHref = buildHref('/statement', { customer: id, from: fyStart(asOf), to: asOf, asof: asOf });

  return (
    <div className="space-y-6">
      {/* Title and actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={withAsOf('/customers', asOf)} className="text-sm text-blue-700 hover:underline">
            ← Customers
          </Link>
          <h1 className="mt-1 text-xl font-semibold">
            <span className="font-mono">{customer.code}</span> · {customer.name} <ActiveBadge active={customer.isActive} />
          </h1>
          <p className="text-sm text-zinc-500">As at {formatDate(asOf)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {customer.isActive ? (
            <Link href={buildHref('/invoices/new', { customer: id, asof: asOf })} className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700">
              New invoice
            </Link>
          ) : (
            <span className="rounded bg-zinc-200 px-3 py-1.5 text-zinc-500" title="Inactive customers cannot be given new invoices (R9)">
              New invoice
            </span>
          )}
          <Link href={buildHref('/receipts/new', { customer: id, asof: asOf })} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">
            Record payment
          </Link>
          <Link href={statementHref} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">
            Statement
          </Link>
          <Link href={withAsOf(`/customers/${id}/edit`, asOf)} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">
            Edit
          </Link>
          <form action={setCustomerActive.bind(null, id, !customer.isActive)}>
            <button type="submit" className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">
              {customer.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </form>
        </div>
      </div>

      {!customer.isActive && (
        <div className="rounded border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          This customer is inactive: no new invoices can be raised. Payments, notes and statements still work.
        </div>
      )}
      {position.overLimit && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Over credit limit.</strong> Net balance {formatBalance(position.netBalance)} is above the limit of{' '}
          {formatMoney(customer.creditLimit)} ({formatPct(position.creditUsedPct)} used).
        </div>
      )}

      {/* Balance and profile */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} p-4 lg:col-span-2`}>
          <h2 className="text-sm font-semibold text-zinc-600">Balance</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Net balance" value={formatBalance(position.netBalance)} strong />
            <Figure label="Invoices outstanding" value={formatMoney(position.outstanding)} />
            <Figure label="Unapplied credit" value={formatMoney(position.unapplied)} />
            <Figure label="Overdue" value={formatMoney(position.overdue)} red={position.overdue > 0} />
          </div>
          <p className="mt-4 text-sm text-zinc-700">
            <span className="font-medium">Ageing: </span>
            {BUCKETS.map((b, i) => (
              <span key={b} className={position.buckets[b] > 0 && b !== 'Not due' ? 'text-red-700' : ''}>
                {i > 0 && ' · '}
                {b === 'Not due' ? 'Not due' : `${b} days`} {formatMoney(position.buckets[b])}
              </span>
            ))}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Unapplied credit is shown separately and is not netted off the oldest bucket.
          </p>
        </section>

        <section className={`${card} p-4 text-sm`}>
          <h2 className="font-semibold text-zinc-600">Profile</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-zinc-500">Contact</dt><dd>{customer.contactPerson ?? '—'}</dd>
            <dt className="text-zinc-500">Email</dt><dd className="break-all">{customer.email ?? '—'}</dd>
            <dt className="text-zinc-500">Phone</dt><dd>{customer.phone ?? '—'}</dd>
            <dt className="text-zinc-500">Location</dt><dd>{customer.city}, {customer.state}</dd>
            <dt className="text-zinc-500">GSTIN</dt><dd className="font-mono">{customer.gstin ?? '—'}</dd>
            <dt className="text-zinc-500">Credit days</dt><dd>{customer.creditDays}</dd>
            <dt className="text-zinc-500">Credit limit</dt><dd>{formatMoney(customer.creditLimit)}</dd>
            <dt className="text-zinc-500">TDS rate</dt><dd>{customer.tdsRatePct}%</dd>
          </dl>
        </section>
      </div>

      {/* Invoices */}
      <section className={card}>
        <h2 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">Invoices</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className={th}>Number</th><th className={th}>Date</th><th className={th}>Due</th>
                <th className={thr}>Total</th><th className={thr}>Received</th><th className={thr}>Credited</th>
                <th className={thr}>Outstanding</th><th className={th}>Status</th><th className={thr}>Days late</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((p) => (
                <tr key={p.invoice.id} className={`border-t border-zinc-100 ${p.status === 'Overdue' ? 'bg-red-50' : ''}`}>
                  <td className={`${td} font-mono`}>
                    <Link href={withAsOf(`/invoices/${p.invoice.id}`, asOf)} className="text-blue-700 hover:underline">{p.invoice.invoiceNo}</Link>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(p.invoice.invoiceDate)}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(p.invoice.dueDate)}</td>
                  <td className={tdr}>{formatMoney(p.invoice.total)}</td>
                  <td className={tdr}>{formatMoney(p.received)}</td>
                  <td className={tdr}>{formatMoney(p.credited)}</td>
                  <td className={`${tdr} font-medium`}>{formatMoney(p.outstanding)}</td>
                  <td className={`${td} space-x-1 whitespace-nowrap`}>
                    <InvoiceStatusBadge status={p.status} />
                    {p.isPartPaid && <PartPaidBadge />}
                    {p.invoice.isDisputed && <DisputedBadge />}
                  </td>
                  <td className={`${tdr} ${p.status === 'Overdue' ? 'text-red-700' : ''}`}>{p.status === 'Overdue' ? p.daysPastDue : ''}</td>
                </tr>
              ))}
              {cancelled.map((i) => (
                <tr key={i.id} className="border-t border-zinc-100 text-zinc-500">
                  <td className={`${td} font-mono`}>
                    <Link href={withAsOf(`/invoices/${i.id}`, asOf)} className="hover:underline">{i.invoiceNo}</Link>
                  </td>
                  <td className={td}>{formatDate(i.invoiceDate)}</td>
                  <td className={td}>{formatDate(i.dueDate)}</td>
                  <td className={tdr}>{formatMoney(i.total)}</td>
                  <td className={td} colSpan={3}></td>
                  <td className={td}><InvoiceStatusBadge status="Cancelled" /></td>
                  <td className={td}></td>
                </tr>
              ))}
              {invoices.length + cancelled.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-zinc-500">No invoices as at {formatDate(asOf)}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Receipts */}
      <section className={card}>
        <h2 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">
          Receipts
          {position.unapplied > 0 && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
              {formatMoney(position.unapplied)} unapplied credit to allocate
            </span>
          )}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className={th}>Number</th><th className={th}>Date</th><th className={th}>Mode / reference</th>
                <th className={thr}>Bank</th><th className={thr}>TDS</th><th className={thr}>Settlement</th>
                <th className={thr}>Allocated</th><th className={thr}>Unapplied</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.receipt.id} className="border-t border-zinc-100">
                  <td className={`${td} font-mono`}>{r.receipt.receiptNo}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(r.receipt.receiptDate)}</td>
                  <td className={td}>{r.receipt.mode} {r.receipt.reference}</td>
                  <td className={tdr}>{formatMoney(r.receipt.bankAmount)}</td>
                  <td className={tdr}>{formatMoney(r.receipt.tdsAmount)}</td>
                  <td className={tdr}>{formatMoney(r.settlement)}</td>
                  <td className={tdr}>{formatMoney(r.allocated)}</td>
                  <td className={`${tdr} ${r.unapplied > 0 ? 'font-semibold text-amber-800' : ''}`}>{formatMoney(r.unapplied)}</td>
                </tr>
              ))}
              {receipts.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-zinc-500">No receipts as at {formatDate(asOf)}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes timeline */}
      <section id="notes" className={card}>
        <h2 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold">Notes</h2>
        <ol className="divide-y divide-zinc-100">
          {notes.map((n) => {
            const promise = promises.get(n.id);
            return (
              <li key={n.id} className="px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-zinc-500">
                  <span className="font-medium text-zinc-800">{formatDate(n.noteDate)}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{n.noteType}</span>
                  {n.invoiceId !== null && <span className="font-mono text-xs">{invoiceNo.get(n.invoiceId)}</span>}
                </div>
                <p className="mt-1 text-zinc-800">{n.body}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-600">
                  {n.followUpDate && (
                    <span className={dueFollowUps.has(n.id) ? 'font-semibold text-red-700' : ''}>
                      Follow up {formatDate(n.followUpDate)}
                      {n.followUpDone ? ' · done' : dueFollowUps.has(n.id) ? ' · due' : ''}
                    </span>
                  )}
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
          {notes.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-500">No notes as at {formatDate(asOf)}.</li>}
        </ol>
      </section>
    </div>
  );
}

function Figure({ label, value, strong, red }: { label: string; value: string; strong?: boolean; red?: boolean }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`tabular-nums ${strong ? 'text-lg font-semibold' : 'text-base'} ${red ? 'text-red-700' : ''}`}>{value}</div>
    </div>
  );
}
