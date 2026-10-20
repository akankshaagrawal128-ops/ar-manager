'use client';

// The header: seller name, navigation and the as-at date picker (brief Part 2, "Across the app").
// Runs in the browser because it reads and changes the address bar. Every link carries ?asof=.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isValidDate, parseAsOf, todayInIndia, withAsOf } from '@/lib/asof';
import { SELLER } from '@/lib/seller';

const NAV = [
  { href: '/', label: 'Overdue at a glance' },
  { href: '/customers', label: 'Customers' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/receipts/new', label: 'Record payment' },
  { href: '/statement', label: 'Statement' },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function Shell({ nav, picker }: { nav: React.ReactNode; picker?: React.ReactNode }) {
  return (
    <header className="border-b border-zinc-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
        <div>
          <div className="text-base font-semibold text-zinc-900">AR Manager</div>
          <div className="text-xs text-zinc-500">{SELLER.name}</div>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">{nav}</nav>
        <div className="ml-auto">{picker}</div>
      </div>
    </header>
  );
}

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const asOf = parseAsOf(searchParams.get('asof'));
  const today = todayInIndia();

  function goTo(date: string) {
    if (!isValidDate(date)) return; // ignore half-typed dates
    const params = new URLSearchParams(searchParams.toString());
    params.set('asof', date);
    router.push(`${pathname}?${params.toString()}`);
  }

  const nav = NAV.map((item) => (
    <Link
      key={item.href}
      href={withAsOf(item.href, asOf)}
      className={`rounded px-3 py-1.5 ${
        isActive(pathname, item.href) ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
      }`}
    >
      {item.label}
    </Link>
  ));

  const picker = (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      <span className="font-medium">As at</span>
      <input
        type="date"
        value={asOf}
        min="2000-01-01"
        max="2099-12-31"
        onChange={(e) => goTo(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-zinc-900"
      />
      {asOf !== today && (
        <button type="button" onClick={() => goTo(today)} className="rounded px-2 py-1 text-blue-700 hover:bg-blue-50">
          Today
        </button>
      )}
    </label>
  );

  return <Shell nav={nav} picker={picker} />;
}

/** Shown for a moment while the address bar is read: the same header without the date picker. */
export function HeaderFallback() {
  const nav = NAV.map((item) => (
    <span key={item.href} className="rounded px-3 py-1.5 text-zinc-700">
      {item.label}
    </span>
  ));
  return <Shell nav={nav} />;
}
