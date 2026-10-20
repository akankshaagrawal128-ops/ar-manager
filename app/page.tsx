import { customerPositions } from '@/lib/ar/balances';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { formatBalance, formatDate } from '@/lib/format';

// Temporary home page: customer balances as at the chosen date, to show the as-at date working.
// Replaced by "Overdue at a glance" in Part 5, step 8.

// Figures must be live on every visit, so let the page wait for the data.
export const instant = false;

export default async function Home({ searchParams }: PageProps<'/'>) {
  const asOf = parseAsOf((await searchParams).asof);
  const rows = customerPositions(await loadArData(), asOf);

  return (
    <div>
      <h1 className="text-xl font-semibold">Customer balances as at {formatDate(asOf)}</h1>
      <table className="mt-4 border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Net balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.customer.id} className="border-b">
              <td className="px-3 py-2">{p.customer.code}</td>
              <td className="px-3 py-2">{p.customer.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatBalance(p.netBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
