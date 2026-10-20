import { addDays } from './dates';
import { invoicePositions } from './positions';
import type { ArData, Paise } from './types';

export const DSO_WINDOW_DAYS = 90;

export interface SalesWindow {
  from: string; // asOf − 89 days
  to: string; // asOf
  sales: Paise; // S: non-cancelled invoice totals less credit-note totals dated in the window
}

/** R17: S, the net sales of the 90 days ending on asOf (both ends included). */
export function salesWindow(data: ArData, asOf: string): SalesWindow {
  const from = addDays(asOf, -(DSO_WINDOW_DAYS - 1));
  const inWindow = (date: string) => from <= date && date <= asOf;
  let sales = 0;
  for (const i of data.invoices) {
    if (!i.isCancelled && inWindow(i.invoiceDate)) sales += i.total;
  }
  for (const c of data.creditNotes) {
    if (inWindow(c.creditNoteDate)) sales -= c.total;
  }
  return { from, to: asOf, sales };
}

/**
 * R17: DSO = Σ invoice outstanding (before unapplied credit) ÷ S × 90, to the nearest whole day.
 * Returns null (shown as "—") when there are no net sales in the window.
 */
export function dso(data: ArData, asOf: string): number | null {
  const { sales } = salesWindow(data, asOf);
  // S below zero (credit notes larger than sales) would give a meaningless negative DSO, so it is treated like zero.
  if (sales <= 0) return null;
  const outstanding = invoicePositions(data, asOf).reduce((sum, p) => sum + p.outstanding, 0);
  return Math.round((outstanding * DSO_WINDOW_DAYS) / sales);
}
