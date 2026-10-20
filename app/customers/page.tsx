import Link from 'next/link';
import { SortHeader } from '@/components/SortHeader';
import { customerPositions } from '@/lib/ar/balances';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf, withAsOf } from '@/lib/asof';
import { customerListRows, parseCustomerListQuery, type StatusFilter } from '@/lib/customer-list';
import { formatBalance, formatDate, formatMoney, formatPct } from '@/lib/format';
import { buildHref } from '@/lib/url';

// Figures must be live on every visit, so let the page wait for the data.
export const instant = false;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default async function CustomersPage({ searchParams }: PageProps<'/customers'>) {
  const params = await searchParams;
  const asOf = parseAsOf(params.asof);
  const query = parseCustomerListQuery(params);
  const rows = customerListRows(customerPositions(await loadArData(), asOf), query);

  // Settings every link on this page keeps
  const keep = { asof: asOf, q: query.q, status: query.status === 'all' ? '' : query.status };
  const sortProps = { sort: query.sort, dir: query.dir, path: '/customers', params: keep };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Customers <span className="text-base font-normal text-zinc-500">as at {formatDate(asOf)}</span>
        </h1>
        <Link
          href={withAsOf('/customers/new', asOf)}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New customer
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <form action="/customers" method="get" className="flex gap-2">
          <input type="hidden" name="asof" value={asOf} />
          {query.status !== 'all' && <input type="hidden" name="status" value={query.status} />}
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="dir" value={query.dir} />
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Search code, name, contact or email"
            className="w-72 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100">
            Search
          </button>
          {query.q && (
            <Link href={buildHref('/customers', { ...keep, q: '', sort: query.sort, dir: query.dir })} className="self-center text-sm text-blue-700 hover:underline">
              Clear
            </Link>
          )}
        </form>

        <div className="flex rounded border border-zinc-300 bg-white text-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={buildHref('/customers', { ...keep, status: f.value === 'all' ? '' : f.value, sort: query.sort, dir: query.dir })}
              className={`px-3 py-1.5 ${query.status === f.value ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100'}`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <span className="text-sm text-zinc-500">
          {rows.length} {rows.length === 1 ? 'customer' : 'customers'}
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <SortHeader label="Code" sortKey="code" {...sortProps} />
              <SortHeader label="Name" sortKey="name" {...sortProps} />
              <SortHeader label="City, State" sortKey="location" {...sortProps} />
              <SortHeader label="Contact" sortKey="contact" {...sortProps} />
              <SortHeader label="Credit days" sortKey="creditDays" align="right" {...sortProps} />
              <SortHeader label="Credit limit" sortKey="creditLimit" align="right" {...sortProps} />
              <SortHeader label="Balance" sortKey="balance" align="right" {...sortProps} />
              <SortHeader label="Overdue" sortKey="overdue" align="right" {...sortProps} />
              <SortHeader label="Limit used" sortKey="used" align="right" {...sortProps} />
              <SortHeader label="Status" sortKey="status" {...sortProps} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const c = p.customer;
              return (
                <tr key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono">
                    <Link href={withAsOf(`/customers/${c.id}`, asOf)} className="text-blue-700 hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={withAsOf(`/customers/${c.id}`, asOf)} className="hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.city}, {c.state}</td>
                  <td className="px-3 py-2">{c.contactPerson ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.creditDays}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatMoney(c.creditLimit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBalance(p.netBalance)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${p.overdue > 0 ? 'text-red-700' : ''}`}>
                    {formatMoney(p.overdue)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${p.overLimit ? 'font-semibold text-red-700' : ''}`}>
                    {formatPct(p.creditUsedPct)}
                    {p.overLimit && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs">Over limit</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-zinc-200 text-zinc-600'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                  No customers match{query.q ? ` “${query.q}”` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
