/** Builds a link from a path and query values, leaving out empty ones: ('/customers', {q: '', asof: '2026-08-31'}) -> '/customers?asof=2026-08-31'. */
export function buildHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
