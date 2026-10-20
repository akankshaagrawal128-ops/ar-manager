import Link from 'next/link';
import { DisputedBadge, InvoiceStatusBadge, PartPaidBadge } from '@/components/Badges';
import { SortHeader } from '@/components/SortHeader';
import { BUCKETS } from '@/lib/ar/balances';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf, withAsOf } from '@/lib/asof';
import { formatDate, formatMoney } from '@/lib/format';
import { filterInvoiceRows, invoiceRows, invoiceTotals, parseInvoiceListQuery, type StatusFilter } from '@/lib/invoice-list';
import { buildHref } from '@/lib/url';

export const instant = false;

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All statuses',
  open: 'Open (Due + Overdue)',
  overdue: 'Overdue',
  due: 'Due',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const select = 'rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm';
const td = 'px-3 py-2';
const tdr = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

export default async function InvoicesPage({ searchParams }: PageProps<'/invoices'>) {
  const params = await searchParams;
  const asOf = parseAsOf(params.asof);
  const query = parseInvoiceListQuery(params);
  const data = await loadArData();
  const rows = filterInvoiceRows(invoiceRows(data, asOf), query);
  const totals = invoiceTotals(rows);
  const customers = [...data.customers].sort((a, b) => a.code.localeCompare(b.code));

  // Settings every link on this page keeps
  const keep = {
    asof: asOf,
    q: query.q,
    customer: query.customer ?? '',
    status: query.status === 'all' ? '' : query.status,
    disputed: query.disputed === 'all' ? '' : query.disputed,
    bucket: query.bucket ?? '',
    from: query.from ?? '',
    to: query.to ?? '',
  };
  const sortProps = { sort: query.sort, dir: query.dir, path: '/invoices', params: keep };
  const filtered = Object.entries(keep).some(([k, v]) => k !== 'asof' && v !== '');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Invoices <span className="text-base font-normal text-zinc-500">as at {formatDate(asOf)}</span>
        </h1>
        <Link
          href={withAsOf('/invoices/new', asOf)}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New invoice
        </Link>
      </div>

      <form action="/invoices" method="get" className="flex flex-wrap items-end gap-3 rounded border border-zinc-200 bg-white p-3 text-sm">
        <input type="hidden" name="asof" value={asOf} />
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.dir} />
        {query.bucket && <input type="hidden" name="bucket" value={query.bucket} />}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Invoice number</span>
          <input type="search" name="q" defaultValue={query.q} placeholder="e.g. 0003" className={`${select} w-36`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Customer</span>
          <select name="customer" defaultValue={query.customer ?? ''} className={select}>
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Status</span>
          <select name="status" defaultValue={query.status} className={select}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Disputed</span>
          <select name="disputed" defaultValue={query.disputed} className={select}>
            <option value="all">All</option>
            <option value="yes">Disputed only</option>
            <option value="no">Not disputed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Invoice date from</span>
          <input type="date" name="from" defaultValue={query.from ?? ''} className={select} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">to</span>
          <input type="date" name="to" defaultValue={query.to ?? ''} className={select} />
        </label>
        <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700">
          Apply
        </button>
        {filtered && (
          <Link href={withAsOf('/invoices', asOf)} className="py-1.5 text-blue-700 hover:underline">
            Clear filters
          </Link>
        )}
      </form>

      {query.bucket && (
        <p className="text-sm text-zinc-600">
          Showing ageing bucket <strong>{query.bucket === 'Not due' ? 'Not due' : `${query.bucket} days`}</strong>.{' '}
          <Link href={buildHref('/invoices', { ...keep, bucket: '' })} className="text-blue-700 hover:underline">Show all buckets</Link>
        </p>
      )}

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <SortHeader label="Number" sortKey="number" {...sortProps} />
              <SortHeader label="Customer" sortKey="customer" {...sortProps} />
              <SortHeader label="Invoice date" sortKey="date" {...sortProps} />
              <SortHeader label="Due date" sortKey="due" {...sortProps} />
              <SortHeader label="Total" sortKey="total" align="right" {...sortProps} />
              <SortHeader label="Received" sortKey="received" align="right" {...sortProps} />
              <SortHeader label="Credited" sortKey="credited" align="right" {...sortProps} />
              <SortHeader label="Outstanding" sortKey="outstanding" align="right" {...sortProps} />
              <SortHeader label="Status" sortKey="status" {...sortProps} />
              <SortHeader label="Days late" sortKey="late" align="right" {...sortProps} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cancelled = r.status === 'Cancelled';
              return (
                <tr
                  key={r.invoice.id}
                  className={`border-b border-zinc-100 ${r.status === 'Overdue' ? 'bg-red-50' : ''} ${cancelled ? 'text-zinc-400' : ''}`}
                >
                  <td className={`${td} font-mono whitespace-nowrap`}>
                    <Link href={withAsOf(`/invoices/${r.invoice.id}`, asOf)} className={cancelled ? 'hover:underline' : 'text-blue-700 hover:underline'}>
                      {r.invoice.invoiceNo}
                    </Link>
                  </td>
                  <td className={td}>
                    <Link href={withAsOf(`/customers/${r.customer.id}`, asOf)} className="hover:underline" title={r.customer.name}>
                      {r.customer.code} <span className="text-zinc-500">{r.customer.name}</span>
                    </Link>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(r.invoice.invoiceDate)}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(r.invoice.dueDate)}</td>
                  <td className={`${tdr} ${cancelled ? 'line-through' : ''}`}>{formatMoney(r.invoice.total)}</td>
                  <td className={tdr}>{cancelled ? '' : formatMoney(r.received)}</td>
                  <td className={tdr}>{cancelled ? '' : formatMoney(r.credited)}</td>
                  <td className={`${tdr} font-medium`}>{cancelled ? '' : formatMoney(r.outstanding)}</td>
                  <td className={`${td} space-x-1 whitespace-nowrap`}>
                    <InvoiceStatusBadge status={r.status} />
                    {r.isPartPaid && <PartPaidBadge />}
                    {r.invoice.isDisputed && <DisputedBadge />}
                  </td>
                  <td className={`${tdr} ${r.status === 'Overdue' ? 'font-medium text-red-700' : ''}`}>
                    {r.status === 'Overdue' ? r.daysPastDue : ''}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">No invoices match these filters.</td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
            <tr>
              <td className={td} colSpan={4}>
                Total · {totals.count} {totals.count === 1 ? 'invoice' : 'invoices'}
                {totals.cancelled > 0 && (
                  <span className="ml-2 font-normal text-zinc-500">({totals.cancelled} cancelled, not counted)</span>
                )}
              </td>
              <td className={tdr}>{formatMoney(totals.total)}</td>
              <td className={tdr}>{formatMoney(totals.received)}</td>
              <td className={tdr}>{formatMoney(totals.credited)}</td>
              <td className={tdr}>{formatMoney(totals.outstanding)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Ageing buckets: {BUCKETS.join(' · ')}. Click a column heading to sort; click again to reverse.
      </p>
    </div>
  );
}
