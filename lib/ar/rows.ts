// Converts raw database rows (snake_case, amounts in rupees) into ArData (camelCase, amounts in paise).
// Kept separate from load.ts so the tests can run the same conversion on the offline fixture.
import type { ArData } from './types';

/** The six tables exactly as Supabase returns them. */
export type DbRow = Record<string, unknown>;
export interface RawTables {
  customers: DbRow[];
  invoices: DbRow[];
  credit_notes: DbRow[];
  receipts: DbRow[];
  allocations: DbRow[];
  notes: DbRow[];
}

export const TABLES = ['customers', 'invoices', 'credit_notes', 'receipts', 'allocations', 'notes'] as const;

/** Rupees to whole paise. Called once per amount, as the data arrives. */
export const paise = (rupees: unknown): number => Math.round(Number(rupees) * 100);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toArData(raw: RawTables): ArData {
  return {
    customers: raw.customers.map((r: any) => ({
      id: r.id, code: r.code, name: r.name, city: r.city, state: r.state,
      contactPerson: r.contact_person, email: r.email, phone: r.phone, gstin: r.gstin,
      creditDays: r.credit_days, creditLimit: paise(r.credit_limit),
      tdsRatePct: Number(r.tds_rate_pct), isActive: r.is_active,
    })),
    invoices: raw.invoices.map((r: any) => ({
      id: r.id, invoiceNo: r.invoice_no, customerId: r.customer_id,
      invoiceDate: r.invoice_date, dueDate: r.due_date, description: r.description,
      taxableValue: paise(r.taxable_value), gstRatePct: Number(r.gst_rate_pct),
      cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst), total: paise(r.total),
      isCancelled: r.is_cancelled, isDisputed: r.is_disputed,
    })),
    creditNotes: raw.credit_notes.map((r: any) => ({
      id: r.id, creditNoteNo: r.credit_note_no, invoiceId: r.invoice_id,
      creditNoteDate: r.credit_note_date, taxableValue: paise(r.taxable_value),
      cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst), total: paise(r.total),
      reason: r.reason,
    })),
    receipts: raw.receipts.map((r: any) => ({
      id: r.id, receiptNo: r.receipt_no, customerId: r.customer_id, receiptDate: r.receipt_date,
      bankAmount: paise(r.bank_amount), tdsAmount: paise(r.tds_amount),
      mode: r.mode, reference: r.reference,
    })),
    allocations: raw.allocations.map((r: any) => ({
      id: r.id, receiptId: r.receipt_id, invoiceId: r.invoice_id,
      allocationDate: r.allocation_date, amount: paise(r.amount),
    })),
    notes: raw.notes.map((r: any) => ({
      id: r.id, customerId: r.customer_id, invoiceId: r.invoice_id, noteDate: r.note_date,
      noteType: r.note_type, body: r.body, followUpDate: r.follow_up_date,
      followUpDone: r.follow_up_done, promiseDate: r.promise_date,
      promiseAmount: r.promise_amount === null ? null : paise(r.promise_amount),
    })),
  };
}
