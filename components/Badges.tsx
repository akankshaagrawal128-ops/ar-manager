// Small coloured labels used across the screens: red for overdue, amber for disputed (brief section 4.10).
import type { PromiseStatus } from '@/lib/ar/notes';

type InvoiceStatus = 'Paid' | 'Due' | 'Overdue' | 'Cancelled';

const base = 'inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium';

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  Paid: 'bg-green-100 text-green-800',
  Due: 'bg-sky-100 text-sky-800',
  Overdue: 'bg-red-100 text-red-800',
  Cancelled: 'bg-zinc-200 text-zinc-600 line-through',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`${base} ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function PartPaidBadge() {
  return <span className={`${base} bg-indigo-100 text-indigo-800`}>Part-paid</span>;
}

export function DisputedBadge() {
  return <span className={`${base} bg-amber-100 text-amber-900`}>Disputed</span>;
}

const PROMISE_STYLE: Record<PromiseStatus, string> = {
  Kept: 'bg-green-100 text-green-800',
  Broken: 'bg-red-100 text-red-800',
  Pending: 'bg-sky-100 text-sky-800',
};

export function PromiseBadge({ status }: { status: PromiseStatus }) {
  return <span className={`${base} ${PROMISE_STYLE[status]}`}>Promise {status.toLowerCase()}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`${base} ${active ? 'bg-green-100 text-green-800' : 'bg-zinc-200 text-zinc-600'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
