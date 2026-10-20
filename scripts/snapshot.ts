// Saves the six tables of the workspace to tests/fixtures/sample.json (brief section 4.14, point 1).
// Reset the workspace first, so the fixture is the original sample data.
// Run with: node --env-file=.env.local scripts/snapshot.ts
//
// Talks to Supabase directly rather than through lib/db.ts, because lib/db.ts is
// marked server-only and can only be imported inside the Next.js app.
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const TABLES = ['customers', 'invoices', 'credit_notes', 'receipts', 'allocations', 'notes'];
const OUT = 'tests/fixtures/sample.json';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
  global: { headers: { 'x-workspace': process.env.AR_WORKSPACE_ID! } },
});

const fixture: Record<string, unknown[]> = {};
for (const table of TABLES) {
  const { data, error } = await db.from(table).select('*').order('id');
  if (error) throw new Error(`${table}: ${error.message}`);
  // The fixture is committed to GitHub, so leave out the workspace id (section 4.9)
  // and the created_at timestamps, which change on every reset.
  fixture[table] = data.map((row) => {
    const copy = { ...row };
    delete copy.workspace_id;
    delete copy.created_at;
    return copy;
  });
  console.log(`${table}: ${data.length} rows`);
}

mkdirSync('tests/fixtures', { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Saved ${OUT}`);
