import { notFound } from 'next/navigation';
import { CustomerForm } from '@/components/CustomerForm';
import { saveCustomer } from '@/lib/actions/customers';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf, withAsOf } from '@/lib/asof';
import { customerFormValues } from '@/lib/validation/customer';

export const instant = false;

export default async function EditCustomerPage({ params, searchParams }: PageProps<'/customers/[id]/edit'>) {
  const id = Number((await params).id);
  const asOf = parseAsOf((await searchParams).asof);
  const customer = (await loadArData()).customers.find((c) => c.id === id);
  if (!customer) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        Edit {customer.code} · {customer.name}
      </h1>
      <CustomerForm
        action={saveCustomer.bind(null, customer.id, asOf)}
        initial={customerFormValues(customer)}
        submitLabel="Save changes"
        cancelHref={withAsOf(`/customers/${customer.id}`, asOf)}
        isEdit
      />
    </div>
  );
}
