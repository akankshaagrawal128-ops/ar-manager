// Customer form validation (brief Part 2: required fields, unique code, valid email,
// credit days >= 0, credit limit >= 0, TDS rate 0-100, optional 15-character GSTIN).
// Pure functions, so they run in the server action and in the tests.
import { z } from 'zod';
import type { Customer } from '@/lib/ar/types';

/** States and union territories. A fixed list, because GST depends on the exact spelling of "Maharashtra" (R3). */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
] as const;

export const CUSTOMER_FIELDS = [
  'code', 'name', 'city', 'state', 'contact_person', 'email', 'phone', 'gstin',
  'credit_days', 'credit_limit', 'tds_rate_pct',
] as const;
export type CustomerField = (typeof CUSTOMER_FIELDS)[number];
export type CustomerFormValues = Record<CustomerField, string>;

const required = (label: string) => z.string().trim().min(1, `Enter the ${label}.`);
const optional = z.string().trim().transform((v) => v || null);
const AMOUNT = /^\d+(\.\d{1,2})?$/;

const schema = z.object({
  code: required('customer code')
    .max(20, 'Keep the code to 20 characters or fewer.')
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]+$/, 'Use letters, digits and hyphens only.')),
  name: required('customer name').max(200, 'Keep the name to 200 characters or fewer.'),
  city: required('city'),
  state: z.enum(INDIAN_STATES, { error: 'Choose a state from the list.' }),
  contact_person: required('contact person'),
  email: z.string().trim().min(1, 'Enter an email address.').pipe(z.email({ error: 'Enter a valid email address, like accounts@example.com.' })),
  phone: optional.pipe(z.string().regex(/^[0-9+\-() ]{6,20}$/, 'Enter a phone number of 6 to 20 digits.').nullable()),
  gstin: z.string().trim().transform((v) => v.toUpperCase() || null)
    .pipe(z.string().regex(/^[0-9A-Z]{15}$/, 'A GSTIN is exactly 15 letters and digits. Leave it blank if there is none.').nullable()),
  credit_days: z.string().trim()
    .regex(/^\d+$/, 'Enter credit days as a whole number, 0 or more.')
    .transform(Number)
    .pipe(z.number().max(3650, 'Credit days cannot be more than 3650.')),
  credit_limit: z.string().trim()
    .transform((v) => v.replace(/,/g, '')) // accept 2,50,000 as typed
    .pipe(z.string().regex(AMOUNT, 'Enter the credit limit in rupees, 0 or more, with up to 2 decimals.'))
    .transform(Number),
  tds_rate_pct: z.string().trim()
    .regex(AMOUNT, 'Enter the TDS rate as a number from 0 to 100, with up to 2 decimals.')
    .transform(Number)
    .pipe(z.number().max(100, 'The TDS rate cannot be more than 100%.')),
});

/** The row sent to the customers table: snake_case, amounts in rupees. */
export type CustomerRow = z.output<typeof schema>;

export type CustomerParseResult =
  | { success: true; data: CustomerRow }
  | { success: false; errors: Partial<Record<CustomerField, string>> };

export function parseCustomerForm(values: CustomerFormValues): CustomerParseResult {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };
  const errors: Partial<Record<CustomerField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as CustomerField;
    errors[field] ??= issue.message;
  }
  return { success: false, errors };
}

/** True when another customer already uses this code (ignoring case). */
export function isCodeTaken(customers: Customer[], code: string, exceptId: number | null): boolean {
  return customers.some((c) => c.id !== exceptId && c.code.toUpperCase() === code.toUpperCase());
}

/** The form's starting values for an existing customer (amounts back in rupees). */
export function customerFormValues(c: Customer): CustomerFormValues {
  return {
    code: c.code,
    name: c.name,
    city: c.city,
    state: c.state,
    contact_person: c.contactPerson ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    gstin: c.gstin ?? '',
    credit_days: String(c.creditDays),
    credit_limit: (c.creditLimit / 100).toFixed(2),
    tds_rate_pct: String(c.tdsRatePct),
  };
}

export const EMPTY_CUSTOMER: CustomerFormValues = {
  code: '', name: '', city: '', state: '', contact_person: '', email: '', phone: '', gstin: '',
  credit_days: '30', credit_limit: '', tds_rate_pct: '10',
};
