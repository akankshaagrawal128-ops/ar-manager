import { CustomerForm } from '@/components/CustomerForm';
import { saveCustomer } from '@/lib/actions/customers';
import { parseAsOf, withAsOf } from '@/lib/asof';
import { EMPTY_CUSTOMER } from '@/lib/validation/customer';

export const instant = false;

export default async function NewCustomerPage({ searchParams }: PageProps<'/customers/new'>) {
  const asOf = parseAsOf((await searchParams).asof);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New customer</h1>
      <CustomerForm
        action={saveCustomer.bind(null, null, asOf)}
        initial={EMPTY_CUSTOMER}
        submitLabel="Add customer"
        cancelHref={withAsOf('/customers', asOf)}
        isEdit={false}
      />
    </div>
  );
}
