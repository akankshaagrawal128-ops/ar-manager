import type { ArData } from './types';

export type Series = 'invoice' | 'creditNote' | 'receipt';

/** Longest invoice number GST Rule 46 allows (R4). */
export const MAX_DOCUMENT_NO_LENGTH = 16;

/** R4: the Indian financial year (April to March) of a 'YYYY-MM-DD' date, as 'YY-YY'. */
export function fyLabel(date: string): string {
  const [year, month] = date.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(start)}-${yy(start + 1)}`;
}

/** Prefix and digit count of each series, for the financial year of `date`. */
function format(series: Series, date: string): { prefix: string; digits: number } {
  const fy = fyLabel(date);
  switch (series) {
    case 'invoice':
      return { prefix: `BWA/${fy}/`, digits: 4 };
    case 'creditNote':
      return { prefix: `BWA/CN/${fy}/`, digits: 3 };
    case 'receipt':
      return { prefix: `RCT/${fy}/`, digits: 4 };
  }
}

function existingNumbers(series: Series, data: ArData): string[] {
  switch (series) {
    case 'invoice':
      return data.invoices.map((i) => i.invoiceNo); // cancelled ones too: never reused
    case 'creditNote':
      return data.creditNotes.map((c) => c.creditNoteNo);
    case 'receipt':
      return data.receipts.map((r) => r.receiptNo);
  }
}

/**
 * R4: the next document number in a series for a document dated `date`.
 * One more than the highest number used in that financial year, so a number is never
 * reused, even after cancellation. Restarts at 1 each 1 April.
 */
export function nextNumber(series: Series, data: ArData, date: string): string {
  const { prefix, digits } = format(series, date);
  let highest = 0;
  for (const no of existingNumbers(series, data)) {
    if (!no.startsWith(prefix)) continue;
    const rest = no.slice(prefix.length);
    if (/^\d+$/.test(rest)) highest = Math.max(highest, Number(rest));
  }
  const next = prefix + String(highest + 1).padStart(digits, '0');
  if (next.length > MAX_DOCUMENT_NO_LENGTH) {
    throw new Error(`${next} is longer than ${MAX_DOCUMENT_NO_LENGTH} characters (GST Rule 46).`);
  }
  return next;
}
