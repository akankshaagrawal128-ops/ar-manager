// A clickable column heading: sorts by its column, and reverses the order when clicked again.
import Link from 'next/link';
import { buildHref } from '@/lib/url';

interface Props {
  label: string;
  sortKey: string;
  sort: string;
  dir: 'asc' | 'desc';
  path: string;
  params: Record<string, string | number>; // the other settings to keep (asof, search, filters)
  align?: 'left' | 'right';
}

export function SortHeader({ label, sortKey, sort, dir, path, params, align = 'left' }: Props) {
  const active = sort === sortKey;
  const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
  return (
    <th className={`whitespace-nowrap px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <Link href={buildHref(path, { ...params, sort: sortKey, dir: nextDir })} className="hover:underline">
        {label}
        <span className="ml-1 text-zinc-400">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
      </Link>
    </th>
  );
}
