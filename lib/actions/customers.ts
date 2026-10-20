'use server';

// Server actions for customers. Each follows brief section 4.8: validate, check the rules, write, refresh.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { withAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import {
  CUSTOMER_FIELDS,
  isCodeTaken,
  parseCustomerForm,
  type CustomerField,
  type CustomerFormValues,
} from '@/lib/validation/customer';

export interface CustomerFormState {
  values: CustomerFormValues;
  errors: Partial<Record<CustomerField, string>>;
  message?: string;
}

/** Creates a customer (customerId null) or updates one, then opens the customer page. */
export async function saveCustomer(
  customerId: number | null,
  asOf: string,
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const values = Object.fromEntries(
    CUSTOMER_FIELDS.map((f) => [f, String(formData.get(f) ?? '')]),
  ) as CustomerFormValues;

  // 1. Validate
  const parsed = parseCustomerForm(values);
  if (!parsed.success) {
    return { values, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }

  // 2. Check the business rules
  const data = await loadArData();
  if (customerId !== null && !data.customers.some((c) => c.id === customerId)) {
    return { values, errors: {}, message: 'This customer no longer exists. It may have been removed by a workspace reset.' };
  }
  if (isCodeTaken(data.customers, parsed.data.code, customerId)) {
    return { values, errors: { code: `Code ${parsed.data.code} is already used by another customer.` } };
  }

  // 3. Write
  const result =
    customerId === null
      ? await db.from('customers').insert(parsed.data).select('id').single()
      : await db.from('customers').update(parsed.data).eq('id', customerId).select('id').single();
  if (result.error) return { values, errors: {}, message: friendlyDbError(result.error) };

  // 4. Refresh
  revalidatePath('/', 'layout');
  redirect(withAsOf(`/customers/${result.data.id}`, asOf));
}

/** R9: customers are deactivated or reactivated, never deleted. */
export async function setCustomerActive(customerId: number, isActive: boolean): Promise<void> {
  const { error } = await db.from('customers').update({ is_active: isActive }).eq('id', customerId);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath('/', 'layout');
}
