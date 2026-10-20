// Display helpers (R18, brief section 4.11). Amounts arrive as whole paise; dates as 'YYYY-MM-DD'.
import type { Paise } from '@/lib/ar/types';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ₹1,23,456.00 — Indian digit grouping. */
export function formatMoney(amount: Paise): string {
  return money.format(amount / 100);
}

/** A balance with its side: ₹88,800.00 Dr, ₹1,00,000.00 Cr, or ₹0.00 when it is nil. */
export function formatBalance(amount: Paise): string {
  if (amount === 0) return formatMoney(0);
  return `${formatMoney(Math.abs(amount))} ${amount > 0 ? 'Dr' : 'Cr'}`;
}

/** '2026-08-31' -> '31-Aug-2026'. Splits the string, so the date can never shift by a day. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** 111.73 -> '111.7%'; null -> '—'. */
export function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${pct.toFixed(1)}%`;
}

/** Whole paise as a plain rupee figure for CSV files and form fields: 7080000 -> '70800.00'. */
export function toRupeeString(amount: Paise): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
