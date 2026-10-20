// The as-at date (R10, brief section 4.10). Read from ?asof=YYYY-MM-DD; defaults to today in India.
// Used by server pages and by the header in the browser, so it must not import anything server-only.

/** Today's date in Asia/Kolkata. Vercel runs in UTC, so the server's own date would be wrong before 05:30 IST. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/** A real calendar date written as YYYY-MM-DD, between 2000 and 2099 (the range the numbering supports). */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 2000 || y > 2099) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The as-at date from the ?asof= value; anything missing or invalid falls back to today in India. */
export function parseAsOf(value: string | string[] | null | undefined, now: Date = new Date()): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isValidDate(v) ? v : todayInIndia(now);
}

/** Adds the as-at date to a link, so every page opens at the date being viewed. */
export function withAsOf(href: string, asOf: string): string {
  const [path, hash] = href.split('#');
  const url = `${path}${path.includes('?') ? '&' : '?'}asof=${encodeURIComponent(asOf)}`;
  return hash === undefined ? url : `${url}#${hash}`;
}
