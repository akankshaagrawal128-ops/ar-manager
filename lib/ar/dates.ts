// Date arithmetic on 'YYYY-MM-DD' strings. Uses Date.UTC only, so results never depend
// on the time zone of the machine (brief section 4.11).

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from one 'YYYY-MM-DD' date to another. Never uses local time. */
export function daysBetween(from: string, to: string): number {
  return (toUtc(to) - toUtc(from)) / DAY_MS;
}

/** The date `days` calendar days after `date` (negative goes back). */
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** R2: due date = invoice date + the customer's credit days, in calendar days. */
export function dueDate(invoiceDate: string, creditDays: number): string {
  return addDays(invoiceDate, creditDays);
}
