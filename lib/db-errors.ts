// Turns a database refusal into plain language (brief section 4.6).
// Most of the database's own messages are already readable; a few come from constraints and need translating.

interface DbError {
  message: string;
  code?: string;
}

const CONSTRAINTS: [RegExp, string][] = [
  [/total_equals_taxable_plus_gst/, 'The total does not equal the taxable value plus GST.'],
  [/permission denied for table/, 'This record cannot be deleted. Cancel or deactivate it instead.'],
  [/violates foreign key constraint/, 'This record is linked to other records, so the change was refused.'],
];

export function friendlyDbError(error: DbError): string {
  if (error.code === '23505') {
    return 'That number or code is already in use. Please refresh the page and try again.';
  }
  for (const [pattern, text] of CONSTRAINTS) {
    if (pattern.test(error.message)) return text;
  }
  return error.message;
}
