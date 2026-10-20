import { SELLER } from '@/lib/seller';
import type { Paise } from './types';

export interface GstSplit {
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
}

/** True when the customer is in the seller's state, so CGST + SGST apply instead of IGST. */
export function isIntraState(customerState: string): boolean {
  return customerState.trim().toLowerCase() === SELLER.state.toLowerCase();
}

/**
 * R3: GST on a taxable value in paise. Intra-state: CGST and SGST at half the rate each;
 * otherwise IGST at the full rate. Each component is rounded to the paisa, halves up.
 * The rate is turned into basis points first so the multiplication stays in whole numbers.
 */
export function gstSplit(customerState: string, taxable: Paise, ratePct: number): GstSplit {
  const basisPoints = Math.round(ratePct * 100); // 18% -> 1800
  if (isIntraState(customerState)) {
    const half = Math.round((taxable * basisPoints) / 20_000);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: Math.round((taxable * basisPoints) / 10_000) };
}

/** R3: total = taxable value + GST. */
export function totalWithGst(taxable: Paise, gst: GstSplit): Paise {
  return taxable + gst.cgst + gst.sgst + gst.igst;
}
