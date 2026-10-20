'use client';

// The add/edit customer form. Shows each field's error next to it, and keeps what was typed.
import Link from 'next/link';
import { useActionState } from 'react';
import type { CustomerFormState } from '@/lib/actions/customers';
import { INDIAN_STATES, type CustomerField, type CustomerFormValues } from '@/lib/validation/customer';

interface Props {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  initial: CustomerFormValues;
  submitLabel: string;
  cancelHref: string;
  isEdit: boolean;
}

export function CustomerForm({ action, initial, submitLabel, cancelHref, isEdit }: Props) {
  const [state, formAction, pending] = useActionState(action, { values: initial, errors: {} });
  const v = state.values;
  const e = state.errors;

  const field = (name: CustomerField, label: string, input: React.ReactNode, hint?: string) => (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      {input}
      {e[name] ? (
        <span className="mt-1 block text-sm text-red-700">{e[name]}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      )}
    </label>
  );

  const inputClass = (name: CustomerField) =>
    `mt-1 block w-full rounded border bg-white px-3 py-1.5 text-sm ${e[name] ? 'border-red-500' : 'border-zinc-300'}`;
  const text = (name: CustomerField, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input name={name} defaultValue={v[name]} className={inputClass(name)} {...extra} />
  );

  return (
    <form action={formAction} className="max-w-3xl space-y-6" noValidate>
      {state.message && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</div>
      )}

      <fieldset className="grid grid-cols-1 gap-4 rounded border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Customer</legend>
        {field('code', 'Code *', text('code', { placeholder: 'C009', autoCapitalize: 'characters' }), 'Unique. Letters, digits and hyphens.')}
        {field('name', 'Name *', text('name'))}
        {field('city', 'City *', text('city'))}
        {field(
          'state',
          'State *',
          <select name="state" defaultValue={v.state} className={inputClass('state')}>
            <option value="">Choose a state…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>,
          'Maharashtra customers are charged CGST + SGST; all others IGST.',
        )}
        {field('gstin', 'GSTIN', text('gstin', { maxLength: 15, autoCapitalize: 'characters' }), 'Optional. 15 characters.')}
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 rounded border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Contact</legend>
        {field('contact_person', 'Contact person *', text('contact_person'))}
        {field('email', 'Email *', text('email', { type: 'email' }))}
        {field('phone', 'Phone', text('phone', { type: 'tel' }))}
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 rounded border border-zinc-200 bg-white p-4 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold">Credit terms</legend>
        {field(
          'credit_days',
          'Credit days *',
          text('credit_days', { inputMode: 'numeric' }),
          isEdit ? 'A change applies to new invoices only (R2).' : undefined,
        )}
        {field('credit_limit', 'Credit limit (₹) *', text('credit_limit', { inputMode: 'decimal', placeholder: '500000.00' }))}
        {field('tds_rate_pct', 'TDS rate (%) *', text('tds_rate_pct', { inputMode: 'decimal' }), 'Pre-fills expected TDS on payments.')}
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href={cancelHref} className="text-sm text-zinc-600 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
