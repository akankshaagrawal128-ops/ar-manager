import { describe, expect, it } from 'vitest';
import {
  customerFormValues,
  isCodeTaken,
  parseCustomerForm,
  type CustomerFormValues,
} from '@/lib/validation/customer';
import { sampleData as data } from './fixture';

const valid: CustomerFormValues = {
  code: 'c009', name: 'Bhima Textiles Pvt. Ltd.', city: 'Solapur', state: 'Maharashtra',
  contact_person: 'Meera Kale', email: 'accounts@bhimatextiles.example', phone: '',
  gstin: '', credit_days: '30', credit_limit: '2,50,000', tds_rate_pct: '10',
};
const errorsFor = (changes: Partial<CustomerFormValues>) => {
  const r = parseCustomerForm({ ...valid, ...changes });
  return r.success ? {} : r.errors;
};

describe('customer form validation', () => {
  it('accepts a valid customer and tidies it for the database', () => {
    expect(parseCustomerForm(valid)).toEqual({
      success: true,
      data: {
        code: 'C009', name: 'Bhima Textiles Pvt. Ltd.', city: 'Solapur', state: 'Maharashtra',
        contact_person: 'Meera Kale', email: 'accounts@bhimatextiles.example', phone: null,
        gstin: null, credit_days: 30, credit_limit: 250000, tds_rate_pct: 10,
      },
    });
  });

  it('requires code, name, city, state, contact and email', () => {
    const r = parseCustomerForm({ ...valid, code: ' ', name: '', city: '', state: '', contact_person: '', email: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(Object.keys(r.errors).sort()).toEqual(['city', 'code', 'contact_person', 'email', 'name', 'state']);
    }
  });

  it('rejects an invalid email', () => {
    expect(errorsFor({ email: 'accounts.example' }).email).toMatch(/valid email/);
  });

  it('rejects a state that is not on the list (a misspelling would change the GST)', () => {
    expect(errorsFor({ state: 'Maharastra' }).state).toBeDefined();
  });

  it('checks credit days are a whole number of 0 or more', () => {
    expect(errorsFor({ credit_days: '-5' }).credit_days).toBeDefined();
    expect(errorsFor({ credit_days: '7.5' }).credit_days).toBeDefined();
    expect(errorsFor({ credit_days: '0' }).credit_days).toBeUndefined();
  });

  it('checks the credit limit is 0 or more with up to 2 decimals', () => {
    expect(errorsFor({ credit_limit: '-1' }).credit_limit).toBeDefined();
    expect(errorsFor({ credit_limit: '100.555' }).credit_limit).toBeDefined();
    expect(errorsFor({ credit_limit: 'lots' }).credit_limit).toBeDefined();
    expect(errorsFor({ credit_limit: '0' }).credit_limit).toBeUndefined();
  });

  it('checks the TDS rate is from 0 to 100', () => {
    expect(errorsFor({ tds_rate_pct: '101' }).tds_rate_pct).toMatch(/100/);
    expect(errorsFor({ tds_rate_pct: '-1' }).tds_rate_pct).toBeDefined();
    expect(errorsFor({ tds_rate_pct: '100' }).tds_rate_pct).toBeUndefined();
    expect(errorsFor({ tds_rate_pct: '0' }).tds_rate_pct).toBeUndefined();
  });

  it('accepts a blank GSTIN or exactly 15 characters', () => {
    expect(errorsFor({ gstin: '' }).gstin).toBeUndefined();
    expect(errorsFor({ gstin: '27aabcb1234c1z5' }).gstin).toBeUndefined();
    expect(errorsFor({ gstin: '27AABCB1234C1Z' }).gstin).toBeDefined();
    expect(errorsFor({ gstin: '27AABCB1234C1Z5X' }).gstin).toBeDefined();
  });

  it('rejects a code with spaces or symbols', () => {
    expect(errorsFor({ code: 'C 009' }).code).toBeDefined();
    expect(errorsFor({ code: 'C009/1' }).code).toBeDefined();
  });
});

describe('unique customer code', () => {
  it('finds a code already in use, ignoring case', () => {
    expect(isCodeTaken(data.customers, 'c001', null)).toBe(true);
    expect(isCodeTaken(data.customers, 'C009', null)).toBe(false);
  });
  it('lets a customer keep its own code when edited', () => {
    const c001 = data.customers.find((c) => c.code === 'C001')!;
    expect(isCodeTaken(data.customers, 'C001', c001.id)).toBe(false);
  });
});

describe('edit form starting values', () => {
  it('round-trips every sample customer through the form unchanged', () => {
    for (const c of data.customers) {
      const r = parseCustomerForm(customerFormValues(c));
      expect(r.success, c.code).toBe(true);
      if (r.success) {
        expect(r.data).toMatchObject({ code: c.code, state: c.state, credit_days: c.creditDays, credit_limit: c.creditLimit / 100 });
      }
    }
  });
});
