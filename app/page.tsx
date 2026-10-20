import { connection } from 'next/server';
import { db } from '@/lib/db';

// Temporary connection check (brief section 4.4, step 7).
// Replaced by "Overdue at a glance" in Part 5, step 8.

// Figures must be live on every visit, so let the page wait for the data.
export const instant = false;

export default async function Home() {
  await connection(); // always read live data, never a copy saved at build time

  const { data: customers, error } = await db
    .from('customers')
    .select('id, code, name, city, state')
    .order('code');

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-semibold text-red-700">Could not load customers</h1>
        <p className="mt-2">{error.message}</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Customers ({customers.length})</h1>
      <table className="mt-4 border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1 pr-6">Code</th>
            <th className="py-1 pr-6">Name</th>
            <th className="py-1 pr-6">City</th>
            <th className="py-1">State</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-1 pr-6">{c.code}</td>
              <td className="py-1 pr-6">{c.name}</td>
              <td className="py-1 pr-6">{c.city}</td>
              <td className="py-1">{c.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
