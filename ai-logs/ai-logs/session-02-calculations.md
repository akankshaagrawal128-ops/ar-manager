give me step by steps guidance for Phase B
7:06 PM
First, a quick check: .env.local changed on disk since I wrote it. I'll make sure it still has all three settings, without showing the values.



PowerShell Check .env.local still has three settings
IN
"size: " + (Get-Item .env.local).Length; Get-Content .env.local | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.+)$') { "$($matches[1]) present (length $($matches[2].Length))" } elseif ($_.Trim()) { "other line, length $($_.Length)" } }

OUT
size: 335
SUPABASE_URL present (length 40)
SUPABASE_ANON_KEY present (length 208)
AR_WORKSPACE_ID present (length 36)
7:08 PM
Your .env.local is still fine: all three settings are present.

Here is the full Phase B guide. It covers Part 5, steps 3 and 4 of the brief, the part the reviewers mark most closely ("correct to the paisa").

Phase B: The calculation engine
What you're building, in accounting terms
Think of an Excel AR workbook with two kinds of sheets:

Report sheets: the ageing report, the customer ledger, the statement. These are the screens, which come later in Phase C.
A formulas sheet: where every figure is worked out. That is Phase B.
The brief's one big rule (section 4.3) is that all calculations live in one place, the folder lib/ar/. The screens only display what lib/ar returns. That way the dashboard, the customer page and the statement can never disagree.

Tests are your tick-and-tie. They're small checks that say, for example, "invoice 0003 as at 31-Aug must show 69,600 outstanding". You run them all with one command, npm test, in about a second.

Three ideas to understand before you start
1. Paise, not rupees. Computers add decimals slightly wrongly (0.1 + 0.2 = 0.30000000000000004). So inside the app, every amount is stored in whole paise: ₹88,500.00 becomes 8850000. It's converted back to rupees only for display.

2. The as-at date (R10). Every figure is calculated "as at" a date D. Any record dated after D is ignored, as if it hasn't happened yet. This is why the brief forbids storing a running "amount paid" figure: it would be wrong for every date except today.

3. The control check (R14) is your trial balance. There are two routes to a customer's balance:

Route A: add up the invoice outstanding amounts, then subtract unapplied credit.
Route B: total invoices − total credit notes − total receipts (bank + TDS).
The two must agree for every customer on every day. If they don't, there's a bug.

Overview of the steps
Step	What gets built	Proof it's right (spot check)	Time
B1	Data layer: types, loader, test data file	The file holds 8 customers, 29 invoices, 17 receipts	30 min
B2	Simple rules: due date, GST, document numbers	Spot checks 1 and 2; next numbers 0025 / 002 / 0018	30 min
B3	Invoice position and ageing	Spot checks 3, 4, 7	45 min
B4	Customer balance and control check	Spot checks 5, 6, 10	45 min
B5	Statement of account	Spot check 8	45 min
B6	Notes, follow-ups, promises	Spot check 9	30 min
B7	DSO	Hand-calculate one date	20 min
B8	Final full test run, commit, push, save log	Every test passes	15 min
After every step, follow the same routine:

Run the tests.
Check the figures against your own calculation.
Commit and push (Source Control panel, then Commit, then Sync Changes).
B1: Data layer (Part 5, step 3)
What it is:

lib/ar/types.ts describes each kind of record: what a customer has, what an invoice has, and so on.
lib/ar/load.ts reads all six tables from the database and converts every amount to paise.
scripts/snapshot.ts saves a copy of the sample data to tests/fixtures/sample.json, so tests run offline. Your own test entries in the workspace won't affect them.
Type this to me:

Read docs/BRIEF.md sections 4.5 and 4.14 point 1. We're on Part 5 step 3. Explain your plan simply, then build types.ts, load.ts, and the snapshot script, reset my workspace, and create the fixture.

Your check: open tests/fixtures/sample.json and confirm it contains:

Table	Count	Count it from the brief, Part 3.5
customers	8	C001–C008
invoices	29	5 from FY 25-26 + 24 from FY 26-27
credit_notes	1	
receipts	17	
allocations	18	
notes	7	
Commit message: Add AR types, data loader and test fixture

B2: Simple rules (R2, R3, R4)
What it is:

dueDate: invoice date + credit days.
gstSplit: CGST + SGST if the customer is in Maharashtra, otherwise IGST.
fyLabel / nextNumber: the next invoice, credit note or receipt number.
Type this to me:

Section 4.7, R2–R4. Build dueDate, gstSplit, fyLabel and nextNumber with Vitest tests, including spot checks 1 and 2 and the next numbers in R4.

Check by hand first (this is your CA skill):

Spot check 1: invoice 0001 for C001 (Maharashtra), taxable ₹75,000.
CGST 9% = 6,750 and SGST 9% = 6,750, so total = 88,500.
Due date: 5 Apr + 30 days = 05-May-2026.
Spot check 2: invoice 0002 for C007 (Telangana), taxable ₹3,50,000.
IGST 18% = 63,000, so total = 4,13,000.
Next numbers: BWA/26-27/0025, BWA/CN/26-27/002, RCT/26-27/0018.
Commit message: Add due date, GST split and document numbering with tests

B3: Invoice position and ageing (R11, R12)
What it is: for each invoice as at date D, it works out received, credited, outstanding, days late, status (Paid / Due / Overdue), the part-paid label and the ageing bucket. The brief gives this code in full in section 4.7.

Type this to me:

Section 4.7: build invoicePositions and bucketFor exactly as given, plus tests for spot checks 3, 4 and 7 and the bucket boundaries (0, 1, 30, 31, 60, 61, 90, 91, 180, 181 days).

Hand check, spot check 3 (invoice 0003, C002, as at 31-Aug-2026):

Taxable 1,20,000 + GST 21,600 = total 1,41,600.
Due date: 18 Apr + 45 days = 2 Jun.
Received: receipt 0007 allocated 72,000 on 15 Jun.
Outstanding: 1,41,600 − 72,000 = 69,600.
Days late: 2 Jun to 31 Aug = 28 + 31 + 31 = 90 days, so the bucket is 61–90.
Status: Overdue, part-paid ✔
Traps to watch for (from the brief's troubleshooting table):

Invoice 0017 (C005). The money was received on 10 Jul but allocated on 5 Sep. As at 31 Aug, the invoice must show as fully outstanding, not part-paid. The allocation date counts, not the receipt date.
Invoice 0014 is cancelled. It must not appear anywhere in the totals.
On its due date, an invoice is "Due", not "Overdue". It's Overdue only from the next day.
Commit message: Add invoice positions and ageing buckets with tests

B4: Customer balance and the control check (R5, R13, R14)
What it is:

receiptPositions: for each receipt, settlement = bank + TDS, minus allocations, gives the unapplied amount.
customerPositions: the six ageing buckets, outstanding, unapplied credit, net balance, overdue and over-limit.
balanceByDocuments and balanceCheck: the control check.
Type this to me:

Section 4.7: build receiptPositions, customerPositions, balanceByDocuments and balanceCheck. Test spot checks 5, 6, 10, and a loop proving balanceCheck is empty for every day from 2026-01-01 to 2026-10-31.

Hand check, spot check 6 (C005 as at 12-Jul-2026):

Receipt 0011 on 10 Jul: bank 90,000 + TDS 10,000 = settlement 1,00,000.
Invoice 0017 is dated 15 Jul, so as at 12 Jul it doesn't exist yet.
Net balance: 0 − 1,00,000 = 1,00,000 Cr (an advance).
Hand check, spot check 5 (C005 as at 31-Aug):

Invoices 0017 (1,18,000) + 0022 (70,800) = 1,88,800 outstanding.
Unapplied credit 1,00,000, because it's not allocated until 5 Sep.
Net balance = 88,800 Dr.
Unapplied credit shows in its own column and is not netted off against the oldest bucket (R13).
Commit message: Add customer positions and control check with tests

B5: Statement of account (R15)
What it is:

Opening balance: the balance as at the day before the From date.
Lines: invoices as debits; credit notes, payments (bank amount) and TDS as separate credit lines.
Running balance, and a closing balance.
Type this to me:

R15 and section 4.7: build statement(). Test spot check 8, the same-date line ordering rule, and that the closing balance equals balanceByDocuments at the To date.

Expected result, spot check 8 (C002, 01-Apr to 31-Aug-2026):

Opening 70,800 Dr: invoice 0162 from March, still unpaid on 31 Mar.
7 lines: invoices 0003, 0009, 0018 = 3 lines. Receipt 0005 = payment + TDS = 2 lines. Receipt 0007 = payment + TDS = 2 lines.
Closing 2,23,000 Dr.
Try listing the 7 lines yourself from the CSV data in the brief. It's good practice for the interview.

Commit message: Add statement of account with tests

B6: Notes, follow-ups, promises (R16)
Type this to me:

R16: build followUpsDue and promiseStatuses with tests, including spot check 9.

Hand check, spot check 9 (C002's promise of 20 Jul, as at 31 Aug):

The promise was ₹69,600 by 1 Aug.
C002's receipts dated from 20 Jul to 1 Aug: none. Receipt 0007 was 15 Jun and receipt 0016 was 9 Sep.
Not kept, and 1 Aug is before 31 Aug, so the status is Broken ✔
Commit message: Add follow-ups and promise status with tests

B7: DSO (R17)
What it is: DSO = total invoice outstanding ÷ net sales of the last 90 days × 90, rounded to whole days. It shows "—" when there are no sales in that window.

Type this to me:

R17: build dso() with tests: one date worked by hand, and a date where sales in the window are zero.

Your check: ask me to print the outstanding total and the 90-day sales figure as at 31-Aug. Then do the division on a calculator yourself.

Commit message: Add DSO calculation with tests

B8: Finish Phase B
Run npm test. Everything must pass.
Run npm run build. It must succeed; this is what Vercel runs.
Commit and push.
Save this session's chat into ai-logs/session-02-calculations.md.
Rules for working with me in Phase B
One step at a time. Don't ask for B3 to B7 together. If something is wrong, it's much easier to find in a small step.
Always check one figure by hand before accepting a step. The brief warns that AI often gets a boundary wrong, such as < where it should be <=.
Ask "why?" whenever something is unclear. In the interview you'll have to explain this module and change it live.
Stop me if I suggest new tables, SQL, migrations or a login. The brief forbids them.
If a test fails, that's normal. Tell me what you expected; working through the fix is good material for your logs.
Ready? Type "start B1" and I'll explain the plan for the data layer before writing any code.



Read docs/BRIEF.md sections 4.5 and 4.14 point 1. We're on Part 5 step 3. Explain your plan simply, then build types.ts, load.ts, and the snapshot script, reset my workspace, and create the fixture.
7:13 PM
I've already read the whole brief, including sections 4.5 and 4.14. Here's the plan in simple terms before I build anything.

The plan
1. lib/ar/types.ts: the "column headings"

One description per record type: Customer, Invoice, CreditNote, Receipt, Allocation, Note.
Every amount is stored in paise: ₹88,500.00 becomes 8850000.
Names inside the app use camelCase (invoiceDate), as the brief asks, rather than the database's invoice_date.
2. lib/ar/rows.ts + lib/ar/load.ts: getting the data in

rows.ts converts raw database rows into the app's format: renames fields and turns rupees into paise.
load.ts fetches all six tables from Supabase on each page load, then passes them through rows.ts.
Why I split it into two files (a small improvement on the brief): the tests can feed the saved sample data through the same conversion without needing the internet. The conversion is then tested too.
3. scripts/snapshot.ts: the photocopy

It fetches the six tables once and saves them to tests/fixtures/sample.json.
One safety tweak: every database row carries your workspace_id. This file will go to GitHub, so I'll strip that field out. Your ID must never appear in code (section 4.9).
4. Reset the workspace, so the photocopy is the pristine sample data.

5. A small test confirming the fixture has 8 / 29 / 1 / 17 / 18 / 7 rows and that the paise conversion is right.

Starting with the reset, then a look at what the raw rows look like:



PowerShell Reset workspace and inspect raw table rows
IN
$cfg=@{}; Get-Content .env.local | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { $cfg[$matches[1]]=$matches[2] } }; $h=@{ apikey=$cfg.SUPABASE_ANON_KEY; 'x-workspace'=$cfg.AR_WORKSPACE_ID }; $r = Invoke-RestMethod -Method Post -Uri "$($cfg.SUPABASE_URL)/rest/v1/rpc/reset_workspace" -Headers $h -ContentType 'application/json' -Body '{}'; "reset result: $($r | ConvertTo-Json -Compress)"; foreach ($t in 'customers','invoices','credit_notes','receipts','allocations','notes') { $raw = (Invoke-WebRequest -UseBasicParsing -Uri "$($cfg.SUPABASE_URL)/rest/v1/${t}?select=*&order=id&limit=1" -Headers $h).Content; $cnt = (Invoke-WebRequest -UseBasicParsing -Uri "$($cfg.SUPABASE_URL)/rest/v1/${t}?select=id" -Headers $h).Content | ConvertFrom-Json; "== $t ($(@($cnt).Count) rows)"; ($raw -replace $cfg.AR_WORKSPACE_ID,'<ws>') }

OUT
reset result: "Workspace reset to the sample data."
== customers (8 rows)
[{"id":531,"workspace_id":"<ws>","code":"C001","name":"Tamhini Foods Pvt. Ltd.","city":"Pune","state":"Maharashtra","contact_person":"Neha Joshi","email":"accounts@tamhinifoods.example","phone":null,"gstin":null,"credit_days":30,"credit_limit":500000.00,"tds_rate_pct":10.00,"is_active":true,"created_at":"2026-10-20T13:43:30.642027+00:00"}]
== invoices (29 rows)
[{"id":1892,"workspace_id":"<ws>","invoice_no":"BWA/25-26/0141","customer_id":533,"invoice_date":"2026-01-20","due_date":"2026-02-19","description":"Cost audit support, Q3","taxable_value":150000.00,"gst_rate_pct":18.00,"cgst":0.00,"sgst":0.00,"igst":27000.00,"total":177000.00,"is_cancelled":false,"is_disputed":false,"created_at":"2026-10-20T13:43:30.642027+00:00"}]
== credit_notes (1 rows)
[{"id":77,"workspace_id":"<ws>","credit_note_no":"BWA/CN/26-27/001","invoice_id":1903,"credit_note_date":"2026-07-25","taxable_value":25000.00,"cgst":2250.00,"sgst":2250.00,"igst":0.00,"total":29500.00,"reason":"Scope reduced: one hospital unit dropped from audit","created_at":"2026-10-20T13:43:30.642027+00:00"}]
== receipts (17 rows)
[{"id":1151,"workspace_id":"<ws>","receipt_no":"RCT/26-27/0001","customer_id":538,"receipt_date":"2026-04-25","bank_amount":48600.00,"tds_amount":4500.00,"mode":"NEFT","reference":"UTR 0425-7781","created_at":"2026-10-20T13:43:30.642027+00:00"}]
== allocations (18 rows)
[{"id":1217,"workspace_id":"<ws>","receipt_id":1151,"invoice_id":1896,"allocation_date":"2026-04-25","amount":53100.00,"created_at":"2026-10-20T13:43:30.642027+00:00"}]
== notes (7 rows)
[{"id":493,"workspace_id":"<ws>","customer_id":535,"invoice_id":null,"note_date":"2026-07-10","note_type":"Note","body":"Advance received before the engagement started. Allocate it once the invoice is raised.","follow_up_date":null,"follow_up_done":false,"promise_date":null,"promise_amount":null,"created_at":"2026-10-20T13:43:30.642027+00:00"}]
The reset succeeded, with counts matching the brief and amounts coming through correctly in rupees (note that IDs get regenerated each time, which is fine since the fixture is a fixed copy). Now writing the files.
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\types.ts
96 lines
// Record types used inside the app. Names are camelCase; every amount is whole paise.
// Dates are kept as 'YYYY-MM-DD' strings (brief section 4.11), never as JavaScript Dates.

export type Paise = number; // whole paise: ₹88,500.00 is 8850000

export type ReceiptMode = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'Cheque';
export type NoteType = 'Call' | 'Email' | 'Meeting' | 'Note';

export interface Customer {
  id: number;
  code: string;
  name: string;
  city: string;
  state: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  creditDays: number;
  creditLimit: Paise;
  tdsRatePct: number;
  isActive: boolean;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  customerId: number;
  invoiceDate: string;
  dueDate: string;
  description: string;
  taxableValue: Paise;
  gstRatePct: number;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  total: Paise;
  isCancelled: boolean;
  isDisputed: boolean;
}

export interface CreditNote {
  id: number;
  creditNoteNo: string;
  invoiceId: number;
  creditNoteDate: string;
  taxableValue: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  total: Paise;
  reason: string;
}

export interface Receipt {
  id: number;
  receiptNo: string;
  customerId: number;
  receiptDate: string;
  bankAmount: Paise;
  tdsAmount: Paise;
  mode: ReceiptMode;
  reference: string | null;
}

export interface Allocation {
  id: number;
  receiptId: number;
  invoiceId: number;
  allocationDate: string;
  amount: Paise;
}

export interface Note {
  id: number;
  customerId: number;
  invoiceId: number | null;
  noteDate: string;
  noteType: NoteType;
  body: string;
  followUpDate: string | null;
  followUpDone: boolean;
  promiseDate: string | null;
  promiseAmount: Paise | null;
}

/** Everything the calculations need: all six tables, already converted. */
export interface ArData {
  customers: Customer[];
  invoices: Invoice[];
  creditNotes: CreditNote[];
  receipts: Receipt[];
  allocations: Allocation[];
  notes: Note[];
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\rows.ts
60 lines
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
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\load.ts
19 lines
import 'server-only';
import { db } from '@/lib/db';
import { TABLES, toArData, type RawTables } from './rows';
import type { ArData } from './types';

/**
 * Loads all six tables on every request and converts them once (brief section 4.5).
 * The data set is small, so every calculation then runs in memory in lib/ar.
 */
export async function loadArData(): Promise<ArData> {
  const results = await Promise.all(TABLES.map((t) => db.from(t).select('*').order('id')));
  const raw = {} as RawTables;
  results.forEach((r, i) => {
    if (r.error) throw new Error(`Could not load ${TABLES[i]}: ${r.error.message}`);
    raw[TABLES[i]] = r.data;
  });
  return toArData(raw);
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\scripts\snapshot.ts
31 lines
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
  fixture[table] = data.map(({ workspace_id, created_at, ...row }) => row);
  console.log(`${table}: ${data.length} rows`);
}

mkdirSync('tests/fixtures', { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Saved ${OUT}`);
7:14 PM
Now running the snapshot script to create the fixture:



PowerShell Run snapshot script and check no workspace id leaks
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); node --env-file=.env.local scripts/snapshot.ts; "--- workspace id in fixture? ---"; $ws = ((Get-Content .env.local) -match '^AR_WORKSPACE_ID=') -replace 'AR_WORKSPACE_ID=',''; (Select-String -Path tests\fixtures\sample.json -SimpleMatch $ws -Quiet) -eq $true; (Select-String -Path tests\fixtures\sample.json -Pattern 'workspace_id|created_at' -Quiet) -eq $true

OUT
(node:10244) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///C:/Users/Dell/Desktop/Akanksha%20-%20Verve%20Advisory/Accountmanager/ar-manager-ca-it-main/scripts/snapshot.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to \\?\C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
customers: 8 rows
invoices: 29 rows
credit_notes: 1 rows
receipts: 17 rows
allocations: 18 rows
notes: 7 rows
Saved tests/fixtures/sample.json
--- workspace id in fixture? ---
False
False
The fixture was created with the exact counts (8/29/1/17/18/7), excluding your workspace ID; the typeless package.json warning is harmless. Next, I'll run the test checking the fixture and paise conversion.
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\vitest.config.ts
13 lines
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Same "@/..." shortcut as tsconfig.json, so tests import files the way the app does.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\fixture.ts
7 lines
// The sample data as ArData, for every test. Comes from tests/fixtures/sample.json,
// so tests run offline and are not affected by records added to the workspace.
import sample from './fixtures/sample.json';
import { toArData, type RawTables } from '@/lib/ar/rows';

export const sampleData = toArData(sample as RawTables);
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\load.test.ts
57 lines
import { describe, expect, it } from 'vitest';
import { paise } from '@/lib/ar/rows';
import { sampleData as data } from './fixture';

describe('fixture', () => {
  it('holds the sample data from brief Part 3.5', () => {
    expect(data.customers).toHaveLength(8);
    expect(data.invoices).toHaveLength(29);
    expect(data.creditNotes).toHaveLength(1);
    expect(data.receipts).toHaveLength(17);
    expect(data.allocations).toHaveLength(18);
    expect(data.notes).toHaveLength(7);
  });
});

describe('paise conversion', () => {
  it('turns rupees into whole paise', () => {
    expect(paise(88500)).toBe(8850000);
    expect(paise('69600.00')).toBe(6960000);
    expect(paise(0.1 + 0.2)).toBe(30); // 0.30000000000000004 rupees is still 30 paise
  });

  it('converts every amount in the fixture to a whole number of paise', () => {
    const amounts = [
      ...data.customers.map((c) => c.creditLimit),
      ...data.invoices.flatMap((i) => [i.taxableValue, i.cgst, i.sgst, i.igst, i.total]),
      ...data.creditNotes.flatMap((c) => [c.taxableValue, c.cgst, c.sgst, c.igst, c.total]),
      ...data.receipts.flatMap((r) => [r.bankAmount, r.tdsAmount]),
      ...data.allocations.map((a) => a.amount),
    ];
    for (const a of amounts) expect(Number.isInteger(a)).toBe(true);
  });

  it('maps known records correctly', () => {
    const c001 = data.customers.find((c) => c.code === 'C001')!;
    expect(c001).toMatchObject({ state: 'Maharashtra', creditDays: 30, creditLimit: 50000000, tdsRatePct: 10, isActive: true });

    const inv1 = data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0001')!;
    expect(inv1).toMatchObject({
      customerId: c001.id, invoiceDate: '2026-04-05', dueDate: '2026-05-05',
      taxableValue: 7500000, cgst: 675000, sgst: 675000, igst: 0, total: 8850000,
    });

    const rct11 = data.receipts.find((r) => r.receiptNo === 'RCT/26-27/0011')!;
    expect(rct11).toMatchObject({ receiptDate: '2026-07-10', bankAmount: 9000000, tdsAmount: 1000000 });

    expect(data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0014')!.isCancelled).toBe(true);
    expect(data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0010')!.isDisputed).toBe(true);
  });

  it('keeps an empty promise as null and converts a real one', () => {
    const promises = data.notes.filter((n) => n.promiseAmount !== null).map((n) => n.promiseAmount);
    expect(promises).toEqual([6960000, 23420000, 9440000]);
    expect(data.notes.filter((n) => n.promiseAmount === null)).toHaveLength(4);
  });
});
PowerShell Run tests, production build and lint
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); npm.cmd test; "=== BUILD ==="; npm.cmd run build 2>&1 | Select-Object -Last 15; "=== LINT ==="; npx.cmd eslint lib scripts tests vitest.config.ts

OUT
> ar-manager-ca-it-main@0.1.0 test
> vitest run

'vitest' is not recognized as an internal or external command,
operable program or batch file.
=== BUILD ===
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 429ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 9.2s
  Running TypeScript ...
tests/load.test.ts(1,38): error TS2307: Cannot find module 'vitest' or its corresponding type declarations.
vitest.config.ts(1,30): error TS2307: Cannot find module 'vitest/config' or its corresponding type declarations.
npm.cmd : Failed to type check.
At line:1 char:463
+ ... User'); npm.cmd test; "=== BUILD ==="; npm.cmd run build 2>&1 | Selec ...
+                                            ~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Failed to type check.:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
=== LINT ===

C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\scripts\snapshot.ts
  24:32  warning  'workspace_id' is defined but never used  @typescript-eslint/no-unused-vars
  24:46  warning  'created_at' is defined but never used    @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)
Vitest never finished installing despite being in package.json, which is why tests failed and the build complained—I'll install it now, then clean up two small lint warnings in the snapshot script.
Edit C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\scripts\snapshot.ts
Added 5 lines
PowerShell Install Vitest and run the tests
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); npm.cmd install -D vitest 2>&1 | Select-Object -Last 4; "=== TEST ==="; npm.cmd test 2>&1 | Select-Object -Last 15

OUT
Exit code 1
npm error
npm error For a full report see:
npm error C:\Users\Dell\AppData\Local\npm-cache\_logs\2026-10-20T13_47_53_591Z-eresolve-report.txt
npm error A complete log of this run can be found in: 
C:\Users\Dell\AppData\Local\npm-cache\_logs\2026-10-20T13_47_53_591Z-debug-0.log
=== TEST ===

> ar-manager-ca-it-main@0.1.0 test
> vitest run

npm.cmd : 'vitest' is not recognized as an internal or external command,
At line:1 char:504
+ ... &1 | Select-Object -Last 4; "=== TEST ==="; npm.cmd test 2>&1 | Selec ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ('vitest' is not...ternal command,:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
operable program or batch file.
7:18 PM
This is the same error that silently stopped your earlier install: a version conflict between libraries. I'll read the details.



PowerShell Read the npm conflict report
IN
Get-Content "C:\Users\Dell\AppData\Local\npm-cache\_logs\2026-10-20T13_47_53_591Z-eresolve-report.txt" | Select-Object -First 40

OUT
'Log files:
C:\Users\Dell\AppData\Local\npm-cache\_logs\2026-10-20T13_47_53_591Z-debug-0.log

# npm resolution error report

While resolving: vitest@5.0.5
Found: @types/node@20.19.43
node_modules/@types/node
  dev @types/node@"^20" from the root project
  peerOptional @types/node@"^20.19.0 || >=22.12.0" from vite@8.3.4
  node_modules/vite
    peer vite@"^6.4.0 || ^7.0.0 || ^8.0.0" from vitest@5.0.5
    node_modules/vitest
      dev vitest@"*" from the root project

Could not resolve dependency:
peerOptional @types/node@"^22.0.0 || >=24.0.0" from vitest@5.0.5
node_modules/vitest
  dev vitest@"*" from the root project

Conflicting peer dependency: @types/node@26.6.5
node_modules/@types/node
  peerOptional @types/node@"^22.0.0 || >=24.0.0" from vitest@5.0.5
  node_modules/vitest
    dev vitest@"*" from the root project

Fix the upstream dependency conflict, or retry this command with --force or --legacy-peer-deps to accept an incorrect (and potentially broken) dependency resolution.
I found that Vitest requires @types/node v22+, but the project has v20 while actually running Node 24. I'll update @types/node to version 24 to match, rather than forcing the install.
PowerShell Install Vitest with matching Node types, run tests
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); npm.cmd install -D vitest "@types/node@^24" 2>&1 | Select-Object -Last 4; "=== TEST ==="; npm.cmd test 2>&1 | Select-Object -Last 15

OUT
npm.cmd : npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
At line:1 char:432
+ ... th','User'); npm.cmd install -D vitest "@types/node@^24" 2>&1 | Selec ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm warn instal...y allowScripts::String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
npm warn install-scripts   unrs-resolver@1.12.2 (postinstall: node postinstall.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
=== TEST ===
> ar-manager-ca-it-main@0.1.0 test
> vitest run

npm.cmd : (!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to 
become the default in a future major version of Vite:
At line:1 char:522
+ ... &1 | Select-Object -Last 4; "=== TEST ==="; npm.cmd test 2>&1 | Selec ...
+                                                 ~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ((!) Your Vite c...ersion of Vite::String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` 
in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.0.5 C:/Users/Dell/Desktop/Akanksha - Verve Advisory/Accountmanager/ar-manager-ca-it-main


 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  19:18:59
   Duration  1.84s (transform 49%, worker 24%, import 20%, tests 8%)
All 5 tests pass, though there's a leftover warning about module syntax in package.json. I'll add "type": "module" to fix it, then re-run the full test suite and build.
Edit C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\package.json
Added 1 line
PowerShell Rerun snapshot, tests, lint and build
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); "=== SNAPSHOT (rerun, data unchanged) ==="; node --env-file=.env.local scripts/snapshot.ts; git diff --stat -- tests/fixtures/sample.json; "=== TEST ==="; cmd /c "npm test 2>&1" | Select-Object -Last 6; "=== LINT ==="; cmd /c "npx eslint lib scripts tests vitest.config.ts 2>&1"; "lint exit $LASTEXITCODE"; "=== BUILD ==="; cmd /c "npm run build 2>&1" | Select-Object -Last 8; "=== package.json devDeps ==="; (Get-Content package.json -Raw | ConvertFrom-Json).devDependencies

OUT
=== SNAPSHOT (rerun, data unchanged) ===
customers: 8 rows
invoices: 29 rows
credit_notes: 1 rows
receipts: 17 rows
allocations: 18 rows
notes: 7 rows
Saved tests/fixtures/sample.json
=== TEST ===

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  19:19:27
   Duration  534ms (import 36%, transform 31%, tests 20%, worker 12%)

=== LINT ===
lint exit 0
=== BUILD ===
Route (app)
┌ ƒ /
└ ○ /_not-found


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

=== package.json devDeps ===


@tailwindcss/turbopack : ^4
@types/node            : ^24.19.2
@types/react           : ^19
@types/react-dom       : ^19
eslint                 : ^9
eslint-config-next     : 16.4.2
tailwindcss            : ^4
typescript             : ^5
vitest                 : ^5.0.5
7:20 PM
Step B1 is done. The data layer is built, the fixture is saved, and every check passes.

What I built
File	What it does
lib/ar/types.ts	Describes each record type (Customer, Invoice, CreditNote, Receipt, Allocation, Note). Every amount is in paise.
lib/ar/rows.ts	Converts database rows to the app's format: renames fields (invoice_date → invoiceDate) and converts rupees to paise once.
lib/ar/load.ts	Fetches all six tables from Supabase and runs them through rows.ts. The screens will call this.
scripts/snapshot.ts	Saves the six tables to tests/fixtures/sample.json.
tests/fixtures/sample.json	The saved copy of the pristine sample data, taken right after resetting your workspace.
tests/fixture.ts, tests/load.test.ts, vitest.config.ts	The test setup plus the first 5 tests.
What the tests check
Counts: 8 customers, 29 invoices, 1 credit note, 17 receipts, 18 allocations, 7 notes.
Paise conversion: for example, ₹88,500 becomes 8850000. Even the classic 0.1 + 0.2 problem comes out as exactly 30 paise.
Every amount in the data is a whole number of paise.
Known records mapped correctly:
Invoice 0001 has CGST 6,750 + SGST 6,750, total 88,500, due 05-May.
Receipt 0011 has bank 90,000 + TDS 10,000.
Invoice 0014 is flagged cancelled; invoice 0010 is flagged disputed.
Promise amounts: the three real ones are ₹69,600, ₹2,34,200 and ₹94,400; empty promises stay empty.
Problems I hit and fixed (worth knowing for your interview)
Vitest had never actually installed. Your earlier npm install -D vitest had failed with a version conflict: the newest Vitest needs Node type definitions version 22 or later, and the project had version 20. Since you run Node 24, I moved them to version 24. That's a proper fix, rather than forcing the install with --force.
Privacy: every database row carries your workspace ID. The snapshot script strips it before saving, because sample.json goes to GitHub. I confirmed your ID is not in the file.
Warnings: I added "type": "module" to package.json, which removed the yellow warnings. The tests, the lint check and the production build all pass cleanly.
One design choice to be able to explain: I split the brief's load.ts into two files. rows.ts does the conversion and load.ts does the fetching. That way the tests check the same conversion code the live app uses, without needing the internet.

Your turn
Look at the data. Open tests/fixtures/sample.json and find invoice BWA/26-27/0007: total 295000, credit note 29500.
Run the tests yourself. Type npm test in the terminal. You should see 5 passed.
Commit and push. Use the Source Control panel (Ctrl+Shift+G) with the message Add AR types, data loader and test fixture. Click Commit, then Sync Changes.
Check the file list first: .env.local must not be in it.
Next is B2: due date, GST split and document numbering. When you're ready, send the B2 prompt from the guide. Before you do, work out spot checks 1 and 2 on paper, so you can compare your figures with mine.



B2 prompt - Section 4.7, R2–R4. Build dueDate, gstSplit, fyLabel and nextNumber with Vitest tests, including spot checks 1 and 2 and the next numbers in R4.
7:27 PM
The plan for B2, before I write code:

Rule	Function	How it works
R2 due date	dueDate(invoiceDate, creditDays)	Adds calendar days to the date text. It never uses the computer's clock or time zone, so a date can't slip by one day (the brief's warning in 4.11).
R3 GST	gstSplit(state, taxable, ratePct)	Same state as the seller (Maharashtra): CGST = SGST = taxable × rate ÷ 2, each rounded to the paisa, halves up. Otherwise: IGST = taxable × rate. Done in whole paise, so the result is exact.
R4 FY label	fyLabel(date)	April–March: 1-Apr-2026 to 31-Mar-2027 gives 26-27.
R4 numbering	nextNumber(series, data, date)	Finds the highest number already used in that series and year, including cancelled invoices, and adds 1. Numbers are never reused.
I'll also add lib/seller.ts for Brightwater's details, so "Maharashtra" is written in one place only. The tests will also re-check every invoice and credit note in the sample data against my GST and due-date formulas. If my formulas match all of them, that's strong proof they're right.



Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\seller.ts
8 lines
// The seller's details (brief Part 1). Not editable in the tool.
export const SELLER = {
  name: 'Brightwater Advisory Pvt. Ltd.',
  address: 'Baner, Pune 411045',
  city: 'Pune',
  state: 'Maharashtra',
} as const;
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\dates.ts
25 lines
// Date arithmetic on 'YYYY-MM-DD' strings. Uses Date.UTC only, so results never depend
// on the time zone of the machine (brief section 4.11).

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from one 'YYYY-MM-DD' date to another. Never uses local time. */
export function daysBetween(from: string, to: string): number {
  return (toUtc(to) - toUtc(from)) / DAY_MS;
}

/** The date `days` calendar days after `date` (negative goes back). */
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** R2: due date = invoice date + the customer's credit days, in calendar days. */
export function dueDate(invoiceDate: string, creditDays: number): string {
  return addDays(invoiceDate, creditDays);
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\gst.ts
33 lines
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
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\numbering.ts
59 lines
import type { ArData } from './types';

export type Series = 'invoice' | 'creditNote' | 'receipt';

/** Longest invoice number GST Rule 46 allows (R4). */
export const MAX_DOCUMENT_NO_LENGTH = 16;

/** R4: the Indian financial year (April to March) of a 'YYYY-MM-DD' date, as 'YY-YY'. */
export function fyLabel(date: string): string {
  const [year, month] = date.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(start)}-${yy(start + 1)}`;
}

/** Prefix and digit count of each series, for the financial year of `date`. */
function format(series: Series, date: string): { prefix: string; digits: number } {
  const fy = fyLabel(date);
  switch (series) {
    case 'invoice':
      return { prefix: `BWA/${fy}/`, digits: 4 };
    case 'creditNote':
      return { prefix: `BWA/CN/${fy}/`, digits: 3 };
    case 'receipt':
      return { prefix: `RCT/${fy}/`, digits: 4 };
  }
}

function existingNumbers(series: Series, data: ArData): string[] {
  switch (series) {
    case 'invoice':
      return data.invoices.map((i) => i.invoiceNo); // cancelled ones too: never reused
    case 'creditNote':
      return data.creditNotes.map((c) => c.creditNoteNo);
    case 'receipt':
      return data.receipts.map((r) => r.receiptNo);
  }
}

/**
 * R4: the next document number in a series for a document dated `date`.
 * One more than the highest number used in that financial year, so a number is never
 * reused, even after cancellation. Restarts at 1 each 1 April.
 */
export function nextNumber(series: Series, data: ArData, date: string): string {
  const { prefix, digits } = format(series, date);
  let highest = 0;
  for (const no of existingNumbers(series, data)) {
    if (!no.startsWith(prefix)) continue;
    const rest = no.slice(prefix.length);
    if (/^\d+$/.test(rest)) highest = Math.max(highest, Number(rest));
  }
  const next = prefix + String(highest + 1).padStart(digits, '0');
  if (next.length > MAX_DOCUMENT_NO_LENGTH) {
    throw new Error(`${next} is longer than ${MAX_DOCUMENT_NO_LENGTH} characters (GST Rule 46).`);
  }
  return next;
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\rules.test.ts
130 lines
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, dueDate } from '@/lib/ar/dates';
import { gstSplit, totalWithGst } from '@/lib/ar/gst';
import { fyLabel, nextNumber } from '@/lib/ar/numbering';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const customerOf = (customerId: number) => data.customers.find((c) => c.id === customerId)!;
const invoice = (no: string) => data.invoices.find((i) => i.invoiceNo === no)!;

describe('dates', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween('2026-06-02', '2026-08-31')).toBe(90);
    expect(daysBetween('2026-08-31', '2026-08-31')).toBe(0);
    expect(daysBetween('2026-09-05', '2026-08-31')).toBe(-5);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('adds days across month, year and leap-year boundaries', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
    expect(addDays('2026-12-15', 45)).toBe('2027-01-29');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('R2 due date', () => {
  it('spot check 1: BWA/26-27/0001 is due 05-May-2026', () => {
    expect(dueDate('2026-04-05', 30)).toBe('2026-05-05');
  });

  it('is the invoice date itself when credit days are 0', () => {
    expect(dueDate('2026-04-05', 0)).toBe('2026-04-05');
  });

  it('matches the stored due date of every sample invoice', () => {
    for (const i of data.invoices) {
      expect(dueDate(i.invoiceDate, customerOf(i.customerId).creditDays), i.invoiceNo).toBe(i.dueDate);
    }
  });
});

describe('R3 GST', () => {
  it('spot check 1: BWA/26-27/0001 (C001, Maharashtra) is CGST 6,750 + SGST 6,750, total 88,500', () => {
    const gst = gstSplit('Maharashtra', 7500000, 18);
    expect(gst).toEqual({ cgst: 675000, sgst: 675000, igst: 0 });
    expect(totalWithGst(7500000, gst)).toBe(8850000);
  });

  it('spot check 2: BWA/26-27/0002 (C007, Telangana) is IGST 63,000, total 4,13,000', () => {
    const gst = gstSplit('Telangana', 35000000, 18);
    expect(gst).toEqual({ cgst: 0, sgst: 0, igst: 6300000 });
    expect(totalWithGst(35000000, gst)).toBe(41300000);
  });

  it('rounds each component to the paisa, halves up', () => {
    // ₹0.50 at 9% = 4.5 paise -> 5 paise each for CGST and SGST
    expect(gstSplit('Maharashtra', 50, 18)).toEqual({ cgst: 5, sgst: 5, igst: 0 });
    // ₹1,000.25 at 9% = 9,002.25 paise -> 9,002
    expect(gstSplit('Maharashtra', 100025, 18)).toEqual({ cgst: 9002, sgst: 9002, igst: 0 });
    // ₹1,000.25 at 18% = 18,004.5 paise -> 18,005
    expect(gstSplit('Karnataka', 100025, 18).igst).toBe(18005);
  });

  it('works with other rates', () => {
    expect(gstSplit('Maharashtra', 10000000, 5)).toEqual({ cgst: 250000, sgst: 250000, igst: 0 });
    expect(gstSplit('Gujarat', 10000000, 0)).toEqual({ cgst: 0, sgst: 0, igst: 0 });
  });

  it('matches the stored GST and total of every sample invoice', () => {
    for (const i of data.invoices) {
      const gst = gstSplit(customerOf(i.customerId).state, i.taxableValue, i.gstRatePct);
      expect({ cgst: i.cgst, sgst: i.sgst, igst: i.igst }, i.invoiceNo).toEqual(gst);
      expect(i.total, i.invoiceNo).toBe(totalWithGst(i.taxableValue, gst));
    }
  });

  it('matches the stored GST of the sample credit note (R7: invoice rate and split)', () => {
    for (const c of data.creditNotes) {
      const inv = data.invoices.find((i) => i.id === c.invoiceId)!;
      const gst = gstSplit(customerOf(inv.customerId).state, c.taxableValue, inv.gstRatePct);
      expect({ cgst: c.cgst, sgst: c.sgst, igst: c.igst }).toEqual(gst);
      expect(c.total).toBe(totalWithGst(c.taxableValue, gst));
    }
  });
});

describe('R4 financial year', () => {
  it('runs April to March', () => {
    expect(fyLabel('2026-04-01')).toBe('26-27');
    expect(fyLabel('2026-12-31')).toBe('26-27');
    expect(fyLabel('2027-03-31')).toBe('26-27');
    expect(fyLabel('2026-03-31')).toBe('25-26');
    expect(fyLabel('2099-04-01')).toBe('99-00');
  });
});

describe('R4 next numbers', () => {
  it('follow on from the sample data', () => {
    expect(nextNumber('invoice', data, '2026-10-20')).toBe('BWA/26-27/0025');
    expect(nextNumber('creditNote', data, '2026-10-20')).toBe('BWA/CN/26-27/002');
    expect(nextNumber('receipt', data, '2026-10-20')).toBe('RCT/26-27/0018');
  });

  it('restart each 1 April', () => {
    expect(nextNumber('invoice', data, '2027-04-01')).toBe('BWA/27-28/0001');
    expect(nextNumber('creditNote', data, '2027-04-01')).toBe('BWA/CN/27-28/001');
    expect(nextNumber('receipt', data, '2027-04-01')).toBe('RCT/27-28/0001');
  });

  it('continue the carried-over FY 2025-26 series for a document dated in that year', () => {
    expect(nextNumber('invoice', data, '2026-03-31')).toBe('BWA/25-26/0172');
  });

  it('never reuse the number of a cancelled invoice', () => {
    const withCancelledLast: ArData = {
      ...data,
      invoices: [...data.invoices, { ...invoice('BWA/26-27/0014'), id: -1, invoiceNo: 'BWA/26-27/0025' }],
    };
    expect(withCancelledLast.invoices.at(-1)!.isCancelled).toBe(true);
    expect(nextNumber('invoice', withCancelledLast, '2026-10-20')).toBe('BWA/26-27/0026');
  });

  it('are no longer than 16 characters (GST Rule 46)', () => {
    for (const s of ['invoice', 'creditNote', 'receipt'] as const) {
      expect(nextNumber(s, data, '2026-10-20').length).toBeLessThanOrEqual(16);
    }
  });
});
PowerShell Run tests verbosely, lint and type check
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npx vitest run --reporter=verbose 2>&1" | Select-Object -Last 45; "=== LINT ==="; cmd /c "npx eslint lib tests 2>&1"; "lint exit $LASTEXITCODE"; "=== TYPES ==="; cmd /c "npx tsc --noEmit 2>&1"; "tsc exit $LASTEXITCODE"

OUT
 RUN  v5.0.5 C:/Users/Dell/Desktop/Akanksha - Verve Advisory/Accountmanager/ar-manager-ca-it-main

 ✓ tests/load.test.ts > fixture > holds the sample data from brief Part 3.5 9ms
 ✓ tests/load.test.ts > paise conversion > turns rupees into whole paise 1ms
 ✓ tests/load.test.ts > paise conversion > converts every amount in the fixture to a whole number of paise 14ms
 ✓ tests/load.test.ts > paise conversion > maps known records correctly 6ms
 ✓ tests/load.test.ts > paise conversion > keeps an empty promise as null and converts a real one 2ms
 ✓ tests/rules.test.ts > dates > counts whole days between dates 7ms
 ✓ tests/rules.test.ts > dates > adds days across month, year and leap-year boundaries 3ms
 ✓ tests/rules.test.ts > R2 due date > spot check 1: BWA/26-27/0001 is due 05-May-2026 1ms
 ✓ tests/rules.test.ts > R2 due date > is the invoice date itself when credit days are 0 0ms
 ✓ tests/rules.test.ts > R2 due date > matches the stored due date of every sample invoice 2ms
 ✓ tests/rules.test.ts > R3 GST > spot check 1: BWA/26-27/0001 (C001, Maharashtra) is CGST 6,750 + SGST 6,750, total 88,500 2ms
 ✓ tests/rules.test.ts > R3 GST > spot check 2: BWA/26-27/0002 (C007, Telangana) is IGST 63,000, total 4,13,000 1ms
 ✓ tests/rules.test.ts > R3 GST > rounds each component to the paisa, halves up 1ms
 ✓ tests/rules.test.ts > R3 GST > works with other rates 1ms
 ✓ tests/rules.test.ts > R3 GST > matches the stored GST and total of every sample invoice 5ms
 ✓ tests/rules.test.ts > R3 GST > matches the stored GST of the sample credit note (R7: invoice rate and split) 1ms
 ✓ tests/rules.test.ts > R4 financial year > runs April to March 1ms
 ✓ tests/rules.test.ts > R4 next numbers > follow on from the sample data 1ms
 ✓ tests/rules.test.ts > R4 next numbers > restart each 1 April 0ms
 ✓ tests/rules.test.ts > R4 next numbers > continue the carried-over FY 2025-26 series for a document dated in that year 0ms
 ✓ tests/rules.test.ts > R4 next numbers > never reuse the number of a cancelled invoice 0ms
 ✓ tests/rules.test.ts > R4 next numbers > are no longer than 16 characters (GST Rule 46) 1ms

 Test Files  2 passed (2)
      Tests  22 passed (22)
   Start at  19:28:23
   Duration  930ms (transform 52%, import 26%, tests 13%, worker 9%)

=== LINT ===
lint exit 0
=== TYPES ===
tsc exit 0
7:29 PM
Step B2 is done. All 22 tests pass (5 from B1 + 17 new). The lint check and the type check are also clean.

What I built
File	Contents
lib/seller.ts	Brightwater's name, address and state (Maharashtra), written in one place only
lib/ar/dates.ts	daysBetween, addDays and dueDate (R2)
lib/ar/gst.ts	gstSplit (R3) and totalWithGst
lib/ar/numbering.ts	fyLabel and nextNumber (R4)
tests/rules.test.ts	17 tests
Results (compare with your paper workings)
Check	Expected (brief)	Result
Spot check 1, invoice 0001 (C001, Maharashtra)	CGST 6,750 + SGST 6,750, total 88,500, due 05-May-2026	✅ Matches
Spot check 2, invoice 0002 (C007, Telangana)	IGST 63,000, total 4,13,000	✅ Matches
Next invoice number	BWA/26-27/0025	✅
Next credit note number	BWA/CN/26-27/002	✅
Next receipt number	RCT/26-27/0018	✅
Beyond the spot checks
All 29 sample invoices and the 1 credit note: my GST and due-date formulas reproduce every stored GST amount, total and due date exactly. This is the strongest proof the formulas are right.
Rounding, halves up: for example, CGST of 4.5 paise becomes 5 paise, and IGST of 18,004.5 paise becomes 18,005.
Date edge cases: month-ends, year-ends, leap years, and 0 credit days (due on the invoice date).
Financial year: 31-Mar-2026 gives 25-26 and 1-Apr-2026 gives 26-27. Numbers restart at 0001 from 1-Apr-2027.
A cancelled invoice's number is never reused. Every number stays within 16 characters (GST Rule 46).
Points to understand for your interview
Why GST is calculated in whole paise. The rate becomes "basis points" (18% → 1800), so the multiplication uses only whole numbers and nothing is lost to decimal errors. Each half (CGST and SGST) is rounded separately, as R3 says. That's why they're always equal.
Why nextNumber takes the highest number + 1 instead of counting invoices. Counting would hand out a cancelled invoice's number again; R4 forbids that.
An assumption I made: if someone backdates an invoice into FY 2025-26 (for example, 31-Mar-2026), it continues the old series as BWA/25-26/0172. Note this under Assumptions in your README at the end.
What didn't go wrong
Nothing failed this time; all tests passed on the first run. That's partly because the formulas were checked against the stored sample data, which leaves little room for a hidden mistake.

Your turn
Check one formula yourself. Open lib/ar/gst.ts and read the gstSplit function. There are 8 lines with comments. Compare it with R3 in the brief.
Run npm test. You should see 22 passed.
Commit and push with the message Add due date, GST split and document numbering with tests.
Next is B3: invoice position and ageing. This is the heart of the tool. Before sending the B3 prompt, work out spot check 3 on paper (invoice 0003 as at 31-Aug-2026). The guide's working gives 69,600 outstanding, 90 days late, bucket 61–90, so you can see how my numbers compare.



Section 4.7: build invoicePositions and bucketFor exactly as given, plus tests for spot checks 3, 4 and 7 and the bucket boundaries (0, 1, 30, 31, 60, 61, 90, 91, 180, 181 days).
8:39 PM
The plan for B3: the brief gives invoicePositions and bucketFor in full (section 4.7), so I'll copy them exactly. The one change: daysBetween already lives in lib/ar/dates.ts from B2, so I'll import it from there rather than have two copies.

Then the tests: spot checks 3, 4 and 7, every bucket boundary, plus the two traps the brief warns about (invoice 0017 and "Due on the due date").



Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\positions.ts
57 lines
import { daysBetween } from './dates';
import type { ArData, Invoice, Paise } from './types';

export { daysBetween };

export type Bucket = 'Not due' | '1-30' | '31-60' | '61-90' | '91-180' | 'Over 180';

export interface InvoicePosition {
  invoice: Invoice;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
  daysPastDue: number;
  status: 'Paid' | 'Due' | 'Overdue';
  isPartPaid: boolean;
  bucket: Bucket | null;
}

export function bucketFor(daysPastDue: number): Bucket {
  if (daysPastDue <= 0) return 'Not due';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  if (daysPastDue <= 180) return '91-180';
  return 'Over 180';
}

/** R11 + R12: the position of every live invoice at the end of asOf ('YYYY-MM-DD'). */
export function invoicePositions(data: ArData, asOf: string): InvoicePosition[] {
  const received = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) received.set(a.invoiceId, (received.get(a.invoiceId) ?? 0) + a.amount);
  }
  const credited = new Map<number, Paise>();
  for (const c of data.creditNotes) {
    if (c.creditNoteDate <= asOf) credited.set(c.invoiceId, (credited.get(c.invoiceId) ?? 0) + c.total);
  }
  return data.invoices
    .filter((i) => !i.isCancelled && i.invoiceDate <= asOf)
    .map((i) => {
      const rec = received.get(i.id) ?? 0;
      const cred = credited.get(i.id) ?? 0;
      const outstanding = i.total - rec - cred;
      const daysPastDue = daysBetween(i.dueDate, asOf);
      return {
        invoice: i,
        received: rec,
        credited: cred,
        outstanding,
        daysPastDue,
        status: outstanding === 0 ? 'Paid' : daysPastDue >= 1 ? 'Overdue' : 'Due',
        isPartPaid: outstanding > 0 && rec + cred > 0,
        bucket: outstanding === 0 ? null : bucketFor(daysPastDue),
      };
    });
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\positions.test.ts
111 lines
import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/ar/dates';
import { bucketFor, invoicePositions } from '@/lib/ar/positions';
import { sampleData as data } from './fixture';

const position = (invoiceNo: string, asOf: string) =>
  invoicePositions(data, asOf).find((p) => p.invoice.invoiceNo === invoiceNo);

describe('R12 bucket boundaries', () => {
  it.each([
    [-5, 'Not due'],
    [0, 'Not due'],
    [1, '1-30'],
    [30, '1-30'],
    [31, '31-60'],
    [60, '31-60'],
    [61, '61-90'],
    [90, '61-90'],
    [91, '91-180'],
    [180, '91-180'],
    [181, 'Over 180'],
    [400, 'Over 180'],
  ])('%i days past due is %s', (days, bucket) => {
    expect(bucketFor(days)).toBe(bucket);
  });
});

describe('R11 invoice position: spot checks', () => {
  it('3: BWA/26-27/0003 as at 31-Aug-2026 is 69,600 outstanding, Overdue, part-paid, 90 days, 61-90', () => {
    expect(position('BWA/26-27/0003', '2026-08-31')).toMatchObject({
      received: 7200000,
      credited: 0,
      outstanding: 6960000,
      status: 'Overdue',
      isPartPaid: true,
      daysPastDue: 90,
      bucket: '61-90',
    });
  });

  it('4: BWA/26-27/0021 as at 31-Aug-2026 is Due, 88,500', () => {
    expect(position('BWA/26-27/0021', '2026-08-31')).toMatchObject({
      outstanding: 8850000, status: 'Due', isPartPaid: false, bucket: 'Not due',
    });
  });

  it('4: BWA/26-27/0021 as at 06-Sep-2026 is Overdue 2 days, 88,500', () => {
    expect(position('BWA/26-27/0021', '2026-09-06')).toMatchObject({
      outstanding: 8850000, status: 'Overdue', daysPastDue: 2, bucket: '1-30',
    });
  });

  it('4: BWA/26-27/0021 as at 15-Sep-2026 is Paid', () => {
    expect(position('BWA/26-27/0021', '2026-09-15')).toMatchObject({
      received: 8850000, outstanding: 0, status: 'Paid', isPartPaid: false, bucket: null,
    });
  });

  it('7: BWA/26-27/0007 as at 31-Aug-2026 is 3,000 outstanding after the credit note and TDS receipt', () => {
    expect(position('BWA/26-27/0007', '2026-08-31')).toMatchObject({
      invoice: expect.objectContaining({ total: 29500000 }),
      credited: 2950000, // credit note 29,500.00
      received: 26250000, // receipt 2,40,000.00 + 22,500.00 TDS
      outstanding: 300000,
      status: 'Overdue',
      isPartPaid: true,
    });
  });
});

describe('R10 / R11 traps the brief warns about', () => {
  it('BWA/26-27/0017 as at 31-Aug-2026 is unpaid: the allocation is dated 5 Sep, not the receipt date', () => {
    expect(position('BWA/26-27/0017', '2026-08-31')).toMatchObject({
      received: 0, outstanding: 11800000, isPartPaid: false,
    });
    expect(position('BWA/26-27/0017', '2026-09-05')).toMatchObject({
      received: 10000000, outstanding: 1800000, isPartPaid: true,
    });
  });

  it('is still Due on its due date and Overdue from the next day', () => {
    const due = position('BWA/26-27/0021', '2026-08-31')!.invoice.dueDate;
    expect(due).toBe('2026-09-04');
    expect(position('BWA/26-27/0021', due)).toMatchObject({ status: 'Due', daysPastDue: 0, bucket: 'Not due' });
    expect(position('BWA/26-27/0021', '2026-09-05')).toMatchObject({ status: 'Overdue', daysPastDue: 1, bucket: '1-30' });
  });

  it('leaves out cancelled invoices', () => {
    expect(position('BWA/26-27/0014', '2026-10-31')).toBeUndefined();
  });

  it('leaves out invoices dated after the as-at date, and includes them from their date', () => {
    expect(position('BWA/26-27/0024', '2026-09-04')).toBeUndefined();
    expect(position('BWA/26-27/0024', '2026-09-05')).toBeDefined();
  });

  it('applies a credit note only from its own date', () => {
    expect(position('BWA/26-27/0007', '2026-07-24')!.credited).toBe(0);
    expect(position('BWA/26-27/0007', '2026-07-25')!.credited).toBe(2950000);
  });

  it('never shows outstanding below zero or above the total, on any day of the year', () => {
    for (let d = '2026-01-01'; d <= '2026-10-31'; d = addDays(d, 1)) {
      for (const p of invoicePositions(data, d)) {
        expect(p.outstanding, `${p.invoice.invoiceNo} on ${d}`).toBeGreaterThanOrEqual(0);
        expect(p.outstanding, `${p.invoice.invoiceNo} on ${d}`).toBeLessThanOrEqual(p.invoice.total);
      }
    }
  });
});
PowerShell Run the new tests, all tests, lint, types
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npx vitest run tests/positions.test.ts --reporter=verbose 2>&1" | Select-Object -Last 35; "=== ALL ==="; cmd /c "npm test 2>&1" | Select-Object -Last 5; "=== LINT/TYPES ==="; cmd /c "npx eslint lib tests 2>&1"; "lint exit $LASTEXITCODE"; cmd /c "npx tsc --noEmit 2>&1"; "tsc exit $LASTEXITCODE"

OUT
 RUN  v5.0.5 C:/Users/Dell/Desktop/Akanksha - Verve Advisory/Accountmanager/ar-manager-ca-it-main

 ✓ tests/positions.test.ts > R12 bucket boundaries > -5 days past due is Not due 3ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 0 days past due is Not due 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 1 days past due is 1-30 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 30 days past due is 1-30 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 31 days past due is 31-60 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 60 days past due is 31-60 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 61 days past due is 61-90 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 90 days past due is 61-90 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 91 days past due is 91-180 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 180 days past due is 91-180 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 181 days past due is Over 180 0ms
 ✓ tests/positions.test.ts > R12 bucket boundaries > 400 days past due is Over 180 0ms
 ✓ tests/positions.test.ts > R11 invoice position: spot checks > 3: BWA/26-27/0003 as at 31-Aug-2026 is 69,600 outstanding, Overdue, part-paid, 90 days, 61-90 4ms
 ✓ tests/positions.test.ts > R11 invoice position: spot checks > 4: BWA/26-27/0021 as at 31-Aug-2026 is Due, 88,500 1ms
 ✓ tests/positions.test.ts > R11 invoice position: spot checks > 4: BWA/26-27/0021 as at 06-Sep-2026 is Overdue 2 days, 88,500 1ms
 ✓ tests/positions.test.ts > R11 invoice position: spot checks > 4: BWA/26-27/0021 as at 15-Sep-2026 is Paid 1ms
 ✓ tests/positions.test.ts > R11 invoice position: spot checks > 7: BWA/26-27/0007 as at 31-Aug-2026 is 3,000 outstanding after the credit note and TDS receipt 1ms
 ✓ tests/positions.test.ts > R10 / R11 traps the brief warns about > BWA/26-27/0017 as at 31-Aug-2026 is unpaid: the allocation is dated 5 Sep, not the receipt date 1ms
 ✓ tests/positions.test.ts > R10 / R11 traps the brief warns about > is still Due on its due date and Overdue from the next day 1ms
 ✓ tests/positions.test.ts > R10 / R11 traps the brief warns about > leaves out cancelled invoices 1ms
 ✓ tests/positions.test.ts > R10 / R11 traps the brief warns about > leaves out invoices dated after the as-at date, and includes them from their date 1ms
 ✓ tests/positions.test.ts > R10 / R11 traps the brief warns about > applies a credit note only from its own date 0ms
 ✓ tests/positions.test.ts > R10 / R11 traps the brief warns about > never shows outstanding below zero or above the total, on any day of the year 203ms

 Test Files  1 passed (1)
      Tests  23 passed (23)
   Start at  20:40:28
   Duration  905ms (tests 50%, transform 33%, import 14%, worker 3%)

=== ALL ===
 Test Files  3 passed (3)
      Tests  45 passed (45)
   Start at  20:40:32
   Duration  1.33s (tests 53%, import 26%, transform 12%, worker 9%)

=== LINT/TYPES ===
lint exit 0
tsc exit 0
8:41 PM
Step B3 is done. All 45 tests pass (22 earlier + 23 new). Lint and type checks are clean.

What I built
lib/ar/positions.ts: invoicePositions and bucketFor, copied exactly from section 4.7 of the brief. The only difference is that daysBetween is imported from lib/ar/dates.ts (written in B2) instead of being written twice. The result is the same.
tests/positions.test.ts: 23 tests.
Spot check results
#	Check	Expected (brief)	Result
3	Invoice 0003 as at 31-Aug-2026	69,600 outstanding, Overdue · part-paid, 90 days late, bucket 61–90	✅ Received 72,000, outstanding 69,600, Overdue, part-paid, 90 days, 61–90
4	Invoice 0021 as at 31-Aug	Due 88,500	✅
4	Invoice 0021 as at 06-Sep	Overdue 2 days, 88,500	✅ bucket 1–30
4	Invoice 0021 as at 15-Sep	Paid	✅ received 88,500 on 10 Sep, outstanding 0
7	Invoice 0007 as at 31-Aug	Outstanding 3,000	✅ Total 2,95,000 − credit note 29,500 − receipt (2,40,000 + 22,500 TDS) = 3,000
Bucket boundaries
Every boundary falls in the right bucket: −5 and 0 days → Not due; 1 and 30 → 1–30; 31 and 60 → 31–60; 61 and 90 → 61–90; 91 and 180 → 91–180; 181 and 400 → Over 180.

The traps the brief warns about, all tested
Invoice 0017. As at 31-Aug it shows fully unpaid (1,18,000), because the money is allocated on 5 Sep. From 5 Sep it shows 18,000 outstanding, part-paid. The allocation date counts, not the receipt date.
On the due date (4-Sep for invoice 0021) the status is Due with 0 days late. On 5-Sep it becomes Overdue, 1 day, bucket 1–30.
Cancelled invoice 0014 never appears.
An invoice dated after the as-at date doesn't exist yet. Invoice 0024 (5-Sep) is absent on 4-Sep and present on 5-Sep.
A credit note counts only from its own date. Invoice 0007's credit note shows nothing on 24-Jul and 29,500 on 25-Jul.
A safety test runs every invoice on every day from 1-Jan to 31-Oct-2026 and checks that the outstanding amount is never negative and never more than the invoice total.
For your interview: how the as-at rule works
In invoicePositions, look at the line if (a.allocationDate <= asOf). Dates are stored as text like 2026-08-31, and text in this format sorts in date order. So this one comparison means "only count allocations made on or before the as-at date". That is R10. Every date filter in the module works the same way.

Your turn
Compare these results with your paper working for spot check 3.
Run npm test. You should see 45 passed.
Commit and push with the message Add invoice positions and ageing buckets with tests.
Next is B4: customer balance and the control check (R13, R14). This is where TDS, unapplied credit and Cr balances come in. Before sending the B4 prompt, work out spot check 6 on paper: C005 as at 12-Jul-2026 should be 1,00,000 Cr.



B4 - Section 4.7: build receiptPositions, customerPositions, balanceByDocuments and balanceCheck. Test spot checks 5, 6, 10, and a loop proving balanceCheck is empty for every day from 2026-01-01 to 2026-10-31.
8:45 PM
The plan for B4, in plain terms:

Function	What it calculates (as at date D)
receiptPositions	For each receipt dated ≤ D: settlement = bank + TDS (R5), minus the amount allocated by D, gives the unapplied amount
customerPositions	For each customer: the six ageing buckets, total outstanding, unapplied credit (in its own column, not netted off the oldest bucket), net balance = outstanding − unapplied, overdue = outstanding − Not due bucket, over-limit flag, and % of the limit used
balanceByDocuments	R14's second route: invoices − credit notes − receipt settlements
balanceCheck	Lists any customer where the two routes disagree. It must always be empty.
I'll put these in a new file, lib/ar/balances.ts. Besides the spot checks, I'll add one test that deliberately corrupts the data, to prove the control check actually catches errors rather than passing trivially.



Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\balances.ts
112 lines
import { invoicePositions, type Bucket, type InvoicePosition } from './positions';
import type { ArData, Customer, Paise, Receipt } from './types';

export const BUCKETS: Bucket[] = ['Not due', '1-30', '31-60', '61-90', '91-180', 'Over 180'];

export interface ReceiptPosition {
  receipt: Receipt;
  settlement: Paise; // bank + TDS (R5)
  allocated: Paise;
  unapplied: Paise;
}

export interface CustomerPosition {
  customer: Customer;
  buckets: Record<Bucket, Paise>;
  outstanding: Paise; // Σ invoice outstanding, before unapplied credit
  unapplied: Paise;
  netBalance: Paise; // negative is a credit balance (Cr)
  overdue: Paise;
  overLimit: boolean;
  creditUsedPct: number | null; // net balance as a % of the credit limit; null when the limit is 0
}

export interface BalanceDifference {
  customer: Customer;
  netBalance: Paise;
  byDocuments: Paise;
  difference: Paise;
}

/** R5 + R13: every receipt dated on or before asOf, with what has been allocated from it by then. */
export function receiptPositions(data: ArData, asOf: string): ReceiptPosition[] {
  const allocated = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) allocated.set(a.receiptId, (allocated.get(a.receiptId) ?? 0) + a.amount);
  }
  return data.receipts
    .filter((r) => r.receiptDate <= asOf)
    .map((r) => {
      const settlement = r.bankAmount + r.tdsAmount;
      const alloc = allocated.get(r.id) ?? 0;
      return { receipt: r, settlement, allocated: alloc, unapplied: settlement - alloc };
    });
}

const emptyBuckets = (): Record<Bucket, Paise> =>
  Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, Paise>;

/**
 * R13: one entry per customer (active or not), built by adding up invoicePositions and
 * receiptPositions. Unapplied credit is kept in its own figure, never netted off a bucket.
 */
export function customerPositions(
  data: ArData,
  asOf: string,
  invoices: InvoicePosition[] = invoicePositions(data, asOf),
  receipts: ReceiptPosition[] = receiptPositions(data, asOf),
): CustomerPosition[] {
  return data.customers.map((customer) => {
    const buckets = emptyBuckets();
    let outstanding = 0;
    for (const p of invoices) {
      if (p.invoice.customerId !== customer.id || p.bucket === null) continue;
      buckets[p.bucket] += p.outstanding;
      outstanding += p.outstanding;
    }
    let unapplied = 0;
    for (const r of receipts) {
      if (r.receipt.customerId === customer.id) unapplied += r.unapplied;
    }
    const netBalance = outstanding - unapplied;
    return {
      customer,
      buckets,
      outstanding,
      unapplied,
      netBalance,
      overdue: outstanding - buckets['Not due'],
      overLimit: netBalance > customer.creditLimit,
      creditUsedPct: customer.creditLimit > 0 ? (netBalance / customer.creditLimit) * 100 : null,
    };
  });
}

/** R14: a customer's balance straight from the documents, without using allocations. */
export function balanceByDocuments(data: ArData, customerId: number, asOf: string): Paise {
  const invoiceIds = new Set<number>();
  let balance = 0;
  for (const i of data.invoices) {
    if (i.customerId !== customerId || i.isCancelled) continue;
    invoiceIds.add(i.id);
    if (i.invoiceDate <= asOf) balance += i.total;
  }
  for (const c of data.creditNotes) {
    if (invoiceIds.has(c.invoiceId) && c.creditNoteDate <= asOf) balance -= c.total;
  }
  for (const r of data.receipts) {
    if (r.customerId === customerId && r.receiptDate <= asOf) balance -= r.bankAmount + r.tdsAmount;
  }
  return balance;
}

/** R14 control check: the customers whose net balance disagrees with the documents. Must always be empty. */
export function balanceCheck(data: ArData, asOf: string): BalanceDifference[] {
  return customerPositions(data, asOf)
    .map((p) => {
      const byDocuments = balanceByDocuments(data, p.customer.id, asOf);
      return { customer: p.customer, netBalance: p.netBalance, byDocuments, difference: p.netBalance - byDocuments };
    })
    .filter((d) => d.difference !== 0);
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\balances.test.ts
138 lines
import { describe, expect, it } from 'vitest';
import {
  BUCKETS,
  balanceByDocuments,
  balanceCheck,
  customerPositions,
  receiptPositions,
} from '@/lib/ar/balances';
import { addDays } from '@/lib/ar/dates';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const customer = (code: string) => data.customers.find((c) => c.code === code)!;
const customerPosition = (code: string, asOf: string) =>
  customerPositions(data, asOf).find((p) => p.customer.code === code)!;
const receiptPosition = (receiptNo: string, asOf: string) =>
  receiptPositions(data, asOf).find((p) => p.receipt.receiptNo === receiptNo);

/** Every date from `from` to `to`, inclusive. */
function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

describe('receiptPositions (R5)', () => {
  it('settles with bank + TDS, and leaves the rest unapplied until it is allocated', () => {
    // RCT/26-27/0011, C005: 90,000 bank + 10,000 TDS, allocated on 5 Sep
    expect(receiptPosition('RCT/26-27/0011', '2026-08-31')).toMatchObject({
      settlement: 10000000, allocated: 0, unapplied: 10000000,
    });
    expect(receiptPosition('RCT/26-27/0011', '2026-09-05')).toMatchObject({
      settlement: 10000000, allocated: 10000000, unapplied: 0,
    });
  });

  it('adds up a receipt split across two invoices', () => {
    // RCT/26-27/0009, C007: 5,72,400 + 53,000 TDS = 6,25,400 = 4,13,000 + 2,12,400
    expect(receiptPosition('RCT/26-27/0009', '2026-06-25')).toMatchObject({
      settlement: 62540000, allocated: 62540000, unapplied: 0,
    });
  });

  it('leaves out receipts dated after the as-at date', () => {
    expect(receiptPosition('RCT/26-27/0011', '2026-07-09')).toBeUndefined();
    expect(receiptPosition('RCT/26-27/0011', '2026-07-10')).toBeDefined();
  });
});

describe('customerPositions (R13): spot checks', () => {
  it('5: C005 as at 31-Aug-2026 is outstanding 1,88,800, unapplied 1,00,000, net 88,800 Dr', () => {
    expect(customerPosition('C005', '2026-08-31')).toMatchObject({
      outstanding: 18880000,
      unapplied: 10000000,
      netBalance: 8880000,
    });
  });

  it('6: C005 as at 12-Jul-2026 is net 1,00,000 Cr (advance received, invoice not yet raised)', () => {
    expect(customerPosition('C005', '2026-07-12')).toMatchObject({
      outstanding: 0,
      unapplied: 10000000,
      netBalance: -10000000,
      overdue: 0,
    });
  });

  it('keeps unapplied credit out of the buckets', () => {
    const p = customerPosition('C005', '2026-08-31');
    const bucketTotal = BUCKETS.reduce((sum, b) => sum + p.buckets[b], 0);
    expect(bucketTotal).toBe(p.outstanding); // 1,88,800, not 88,800
  });

  it('works out overdue as outstanding less the Not due bucket', () => {
    // C001 as at 31-Aug: only BWA/26-27/0021 (88,500, due 4 Sep) is open, so nothing is overdue
    expect(customerPosition('C001', '2026-08-31')).toMatchObject({ outstanding: 8850000, overdue: 0 });
    // C002 as at 31-Aug: 0003 (69,600, 90 days), 0009 (94,400, due 6 Jul), 0018 (59,000, due 3 Sep)
    expect(customerPosition('C002', '2026-08-31')).toMatchObject({
      outstanding: 22300000,
      overdue: 16400000,
      buckets: expect.objectContaining({ 'Not due': 5900000, '31-60': 9440000, '61-90': 6960000 }),
    });
  });

  it('flags a customer only when the net balance is above the credit limit', () => {
    for (const asOf of eachDay('2026-01-01', '2026-10-31')) {
      for (const p of customerPositions(data, asOf)) {
        expect(p.overLimit).toBe(p.netBalance > p.customer.creditLimit);
      }
    }
  });

  it('includes inactive customers', () => {
    expect(customerPosition('C008', '2026-04-01')).toMatchObject({ outstanding: 5310000, netBalance: 5310000 });
    expect(customerPosition('C008', '2026-04-25')).toMatchObject({ outstanding: 0, netBalance: 0 });
  });

  it('keeps the six buckets adding up to outstanding on every day', () => {
    for (const asOf of eachDay('2026-01-01', '2026-10-31')) {
      for (const p of customerPositions(data, asOf)) {
        expect(BUCKETS.reduce((s, b) => s + p.buckets[b], 0)).toBe(p.outstanding);
      }
    }
  });
});

describe('R14 control check', () => {
  it('balanceByDocuments for C005 matches spot checks 5 and 6', () => {
    expect(balanceByDocuments(data, customer('C005').id, '2026-08-31')).toBe(8880000);
    expect(balanceByDocuments(data, customer('C005').id, '2026-07-12')).toBe(-10000000);
  });

  it('10: balanceCheck is empty for every day from 2026-01-01 to 2026-10-31', () => {
    const days = eachDay('2026-01-01', '2026-10-31');
    expect(days).toHaveLength(304);
    for (const asOf of days) {
      expect(balanceCheck(data, asOf), asOf).toEqual([]);
    }
  });

  it('catches corrupted data: a receipt from C005 allocated to a C001 invoice', () => {
    const c001Invoice = data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0021')!;
    const rct11 = data.receipts.find((r) => r.receiptNo === 'RCT/26-27/0011')!;
    const corrupted: ArData = {
      ...data,
      allocations: [
        ...data.allocations,
        { id: -1, receiptId: rct11.id, invoiceId: c001Invoice.id, allocationDate: '2026-08-31', amount: 100000 },
      ],
    };
    const differences = balanceCheck(corrupted, '2026-08-31');
    expect(differences.map((d) => [d.customer.code, d.difference])).toEqual([
      ['C001', -100000],
      ['C005', 100000],
    ]);
  });
});
PowerShell Run balance tests, all tests, lint, types
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npx vitest run tests/balances.test.ts --reporter=verbose 2>&1" | Select-Object -Last 30; "=== ALL ==="; cmd /c "npm test 2>&1" | Select-Object -Last 5; cmd /c "npx eslint lib tests 2>&1"; "lint exit $LASTEXITCODE"; cmd /c "npx tsc --noEmit 2>&1"; "tsc exit $LASTEXITCODE"

OUT
 RUN  v5.0.5 C:/Users/Dell/Desktop/Akanksha - Verve Advisory/Accountmanager/ar-manager-ca-it-main

 ✓ tests/balances.test.ts > receiptPositions (R5) > settles with bank + TDS, and leaves the rest unapplied until it is allocated 7ms
 ✓ tests/balances.test.ts > receiptPositions (R5) > adds up a receipt split across two invoices 0ms
 ✓ tests/balances.test.ts > receiptPositions (R5) > leaves out receipts dated after the as-at date 1ms
 ✓ tests/balances.test.ts > customerPositions (R13): spot checks > 5: C005 as at 31-Aug-2026 is outstanding 1,88,800, unapplied 1,00,000, net 88,800 Dr 2ms
 ✓ tests/balances.test.ts > customerPositions (R13): spot checks > 6: C005 as at 12-Jul-2026 is net 1,00,000 Cr (advance received, invoice not yet raised) 1ms
 ✓ tests/balances.test.ts > customerPositions (R13): spot checks > keeps unapplied credit out of the buckets 1ms
 ✓ tests/balances.test.ts > customerPositions (R13): spot checks > works out overdue as outstanding less the Not due bucket 1ms
 ✓ tests/balances.test.ts > customerPositions (R13): spot checks > flags a customer only when the net balance is above the credit limit 178ms
 ✓ tests/balances.test.ts > customerPositions (R13): spot checks > includes inactive customers 1ms
 ✓ tests/balances.test.ts > customerPositions (R13): spot checks > keeps the six buckets adding up to outstanding on every day 246ms
 ✓ tests/balances.test.ts > R14 control check > balanceByDocuments for C005 matches spot checks 5 and 6 2ms
 ✓ tests/balances.test.ts > R14 control check > 10: balanceCheck is empty for every day from 2026-01-01 to 2026-10-31 134ms
 ✓ tests/balances.test.ts > R14 control check > catches corrupted data: a receipt from C005 allocated to a C001 invoice 1ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  20:46:01
   Duration  1.47s (tests 71%, transform 20%, import 7%, worker 2%)

=== ALL ===
 Test Files  4 passed (4)
      Tests  58 passed (58)
   Start at  20:46:06
   Duration  1.78s (transform 39%, tests 36%, import 22%, worker 3%)

lint exit 0
tsc exit 0
Tests all pass. Now I'll print each customer's position as at 31-Aug-2026 so you can review the figures directly, using a temporary file I'll delete afterward.
PowerShell Print all customer positions as at 31-Aug, then remove
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); $f = 'tests\zz_print.test.ts'; @'
import { it } from 'vitest';
import { customerPositions } from '@/lib/ar/balances';
import { sampleData as data } from './fixture';
const r = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
it('print', () => {
  const rows = customerPositions(data, '2026-08-31');
  console.log(['Code', 'Outstanding', 'NotDue', '1-30', '31-60', '61-90', '91-180', '>180', 'Unapplied', 'Net', 'Overdue', 'Limit%', 'Over?'].join(' | '));
  for (const p of rows) {
    const b = p.buckets;
    console.log([p.customer.code, r(p.outstanding), r(b['Not due']), r(b['1-30']), r(b['31-60']), r(b['61-90']), r(b['91-180']), r(b['Over 180']), r(p.unapplied),
      r(Math.abs(p.netBalance)) + (p.netBalance < 0 ? ' Cr' : p.netBalance > 0 ? ' Dr' : ''), r(p.overdue), p.creditUsedPct?.toFixed(1), p.overLimit ? 'YES' : 'no'].join(' | '));
  }
  const t = (k: 'outstanding' | 'unapplied' | 'netBalance' | 'overdue') => r(rows.reduce((s, p) => s + p[k], 0));
  console.log(`TOTAL outstanding ${t('outstanding')} | unapplied ${t('unapplied')} | net ${t('netBalance')} | overdue ${t('overdue')}`);
});
'@ | Set-Content -Encoding utf8 $f; cmd /c "npx vitest run tests/zz_print.test.ts --silent=false 2>&1" | Select-String -Pattern '\|' | ForEach-Object { $_.Line }; Remove-Item $f; "temp file removed: " + -not (Test-Path $f)

OUT
stdout | tests/zz_print.test.ts > print
Code | Outstanding | NotDue | 1-30 | 31-60 | 61-90 | 91-180 | >180 | Unapplied | Net | Overdue | Limit% | Over?
C001 | 88,500.00 | 88,500.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 88,500.00 Dr | 0.00 | 17.7 | no
C002 | 2,23,000.00 | 59,000.00 | 0.00 | 94,400.00 | 69,600.00 | 0.00 | 0.00 | 0.00 | 2,23,000.00 Dr | 1,64,000.00 | 74.3 | no
C003 | 4,46,600.00 | 0.00 | 0.00 | 82,600.00 | 0.00 | 1,87,000.00 | 1,77,000.00 | 0.00 | 4,46,600.00 Dr | 4,46,600.00 | 111.7 | YES
C004 | 4,04,200.00 | 3,54,000.00 | 0.00 | 50,200.00 | 0.00 | 0.00 | 0.00 | 0.00 | 4,04,200.00 Dr | 50,200.00 | 67.4 | no
C005 | 1,88,800.00 | 70,800.00 | 1,18,000.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1,00,000.00 | 88,800.00 Dr | 1,18,000.00 | 35.5 | no
C006 | 35,400.00 | 0.00 | 35,400.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 35,400.00 Dr | 35,400.00 | 35.4 | no
C007 | 7,31,600.00 | 2,59,600.00 | 4,72,000.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 7,31,600.00 Dr | 4,72,000.00 | 91.5 | no
C008 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.0 | no
TOTAL outstanding 21,18,100.00 | unapplied 1,00,000.00 | net 20,18,100.00 | overdue 12,86,200.00
temp file removed: True
8:47 PM
Step B4 is done. All 58 tests pass (45 earlier + 13 new). Lint and type checks are clean.

What I built
lib/ar/balances.ts: receiptPositions, customerPositions, balanceByDocuments and balanceCheck.
tests/balances.test.ts: 13 tests.
Spot check results
#	Check	Expected (brief)	Result
5	C005 as at 31-Aug-2026	Outstanding 1,88,800, unapplied 1,00,000, net 88,800 Dr	✅ Matches
6	C005 as at 12-Jul-2026	Net 1,00,000 Cr	✅ Outstanding 0, unapplied 1,00,000, net −1,00,000 (Cr)
10	Control check, every day	No differences	✅ Empty on all 304 days, 1-Jan to 31-Oct-2026
Other checks
TDS counts as payment: receipt 0011 settles 1,00,000 (90,000 bank + 10,000 TDS).
One receipt across two invoices: receipt 0009 (5,72,400 + 53,000 TDS = 6,25,400) is fully used by invoices 0002 and 0008, leaving 0 unapplied.
Unapplied credit stays in its own column: C005's buckets add up to 1,88,800, not 88,800.
The buckets always add up to outstanding, for every customer on every day.
The over-limit flag is correct on every day.
Inactive C008 is still included.
The control check catches errors. I fed it deliberately corrupted data, with a C005 receipt allocated to a C001 invoice. It flagged both customers, with the right differences (₹1,000 each way). So it isn't passing trivially.
Your accounting review: all customers as at 31-Aug-2026
Code	Outstanding	Not due	1–30	31–60	61–90	91–180	>180	Unapplied	Net	Overdue	Limit used
C001	88,500	88,500							88,500 Dr	0	17.7%
C002	2,23,000	59,000		94,400	69,600				2,23,000 Dr	1,64,000	74.3%
C003	4,46,600			82,600		1,87,000	1,77,000		4,46,600 Dr	4,46,600	111.7% ⚠ over limit
C004	4,04,200	3,54,000		50,200					4,04,200 Dr	50,200	67.4%
C005	1,88,800	70,800	1,18,000					1,00,000	88,800 Dr	1,18,000	35.5%
C006	35,400		35,400						35,400 Dr	35,400	35.4%
C007	7,31,600	2,59,600	4,72,000						7,31,600 Dr	4,72,000	91.5%
C008	0								0	0	0%
Total	21,18,100							1,00,000	20,18,100	12,86,200	
Cross-checks that tie out:

C002's net 2,23,000 Dr is exactly the closing balance of spot check 8, the C002 statement we build in B5.
C003's figures:
Invoice 0141: 1,77,000, more than 180 days late.
Invoice 0156: 1,06,200 − 49,000 paid = 57,200.
Together those are 2,34,200, which is exactly the promise amount in C003's 10-Aug note ("will clear both FY 25-26 invoices").
C004's 50,200 in 31–60 = invoice 0007's 3,000 short-payment + invoice 0010's 47,200 (the disputed workshop invoice).
These all match the stories in the sample notes. That's a good sign the data and the calculations agree.

For your interview: why the control check works
customerPositions gets the balance through allocations: invoice outstanding minus unapplied credit. balanceByDocuments ignores allocations entirely: invoices − credit notes − receipts.

Every allocation reduces an invoice's outstanding and the receipt's unapplied amount by the same figure, so the two routes always agree, unless something is wrong. It's the same idea as a debtors control account reconciling with the sales ledger.

Your turn
Run npm test. You should see 58 passed.
Commit and push with the message Add customer positions and control check with tests.
Next is B5, the statement of account (spot check 8). Before sending the B5 prompt, try listing C002's 7 statement lines (1-Apr to 31-Aug-2026) on paper from the brief's CSV data. Use the opening balance of 70,800 Dr and check that you end at 2,23,000 Dr.



B5- R15 and section 4.7: build statement(). Test spot check 8, the same-date line ordering rule, and that the closing balance equals balanceByDocuments at the To date.
8:54 PM
The plan for B5, the statement of account (R15):

Opening balance = the R14 balance (documents route) as at the day before the From date.

Lines for the period:

Line	Amount	Side
Invoice	total	debit
Credit note	total	credit
"Payment received"	bank amount only	credit
"TDS deducted by you"	TDS	credit; separate line, only when TDS > 0
Order: by date. On the same date: invoices, then credit notes, then receipts, then TDS lines, then by document number.

Running balance on each line, a closing balance, and a footer with the closing balance split by ageing bucket plus any unapplied credit.

Left out: cancelled invoices, allocations and notes.

I'll check spot check 8 by hand first, using the brief's CSV data for C002:

Date	Line	Debit	Credit	Balance
Opening (invoice 0162 from March, unpaid on 31-Mar)			70,800 Dr
18-Apr	Invoice 0003	1,41,600		2,12,400
20-May	Payment received, RCT 0005		64,800	1,47,600
20-May	TDS deducted, RCT 0005		6,000	1,41,600
22-May	Invoice 0009	94,400		2,36,000
15-Jun	Payment received, RCT 0007		60,000	1,76,000
15-Jun	TDS deducted, RCT 0007		12,000	1,64,000
20-Jul	Invoice 0018	59,000		2,23,000 Dr
That's 7 lines, closing at 2,23,000 Dr, matching the brief. Now the code:



Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\statement.ts
113 lines
import { balanceByDocuments, customerPositions } from './balances';
import { addDays } from './dates';
import type { Bucket } from './positions';
import type { ArData, Customer, Paise } from './types';

export type StatementLineType = 'Invoice' | 'Credit note' | 'Payment received' | 'TDS deducted by you';

export interface StatementLine {
  date: string;
  type: StatementLineType;
  documentNo: string;
  particulars: string;
  debit: Paise;
  credit: Paise;
  balance: Paise; // running balance after this line; negative is Cr
}

export interface Statement {
  customer: Customer;
  from: string;
  to: string;
  opening: Paise;
  lines: StatementLine[];
  totalDebit: Paise;
  totalCredit: Paise;
  closing: Paise;
  /** Footer: the outstanding invoices behind the closing balance, by ageing bucket as at `to`. */
  ageing: Record<Bucket, Paise>;
  unapplied: Paise;
}

/** R15: same-date lines go invoices, then credit notes, then receipts, then TDS lines. */
const TYPE_ORDER: Record<StatementLineType, number> = {
  Invoice: 0,
  'Credit note': 1,
  'Payment received': 2,
  'TDS deducted by you': 3,
};

/**
 * R15: statement of account for one customer from `from` to `to` ('YYYY-MM-DD', inclusive).
 * Opening and closing balances are the R14 balance, so the statement always ties to the control check.
 * Cancelled invoices, allocations and notes are left out.
 */
export function statement(data: ArData, customerId: number, from: string, to: string): Statement {
  if (from > to) throw new Error(`The From date (${from}) is after the To date (${to}).`);
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) throw new Error(`Customer ${customerId} not found.`);

  const inPeriod = (date: string) => from <= date && date <= to;
  const lines: Omit<StatementLine, 'balance'>[] = [];

  const invoiceNos = new Map<number, string>();
  for (const i of data.invoices) {
    if (i.customerId !== customerId || i.isCancelled) continue;
    invoiceNos.set(i.id, i.invoiceNo);
    if (inPeriod(i.invoiceDate)) {
      lines.push({ date: i.invoiceDate, type: 'Invoice', documentNo: i.invoiceNo, particulars: i.description, debit: i.total, credit: 0 });
    }
  }
  for (const c of data.creditNotes) {
    const invoiceNo = invoiceNos.get(c.invoiceId);
    if (invoiceNo === undefined || !inPeriod(c.creditNoteDate)) continue;
    lines.push({
      date: c.creditNoteDate, type: 'Credit note', documentNo: c.creditNoteNo,
      particulars: `Against ${invoiceNo}: ${c.reason}`, debit: 0, credit: c.total,
    });
  }
  for (const r of data.receipts) {
    if (r.customerId !== customerId || !inPeriod(r.receiptDate)) continue;
    const reference = [r.mode, r.reference].filter(Boolean).join(' ');
    lines.push({ date: r.receiptDate, type: 'Payment received', documentNo: r.receiptNo, particulars: reference, debit: 0, credit: r.bankAmount });
    if (r.tdsAmount > 0) {
      lines.push({
        date: r.receiptDate, type: 'TDS deducted by you', documentNo: r.receiptNo,
        particulars: `TDS on ${r.receiptNo}`, debit: 0, credit: r.tdsAmount,
      });
    }
  }

  lines.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.documentNo.localeCompare(b.documentNo),
  );

  const opening = balanceByDocuments(data, customerId, addDays(from, -1));
  let balance = opening;
  let totalDebit = 0;
  let totalCredit = 0;
  const withBalance = lines.map((l) => {
    balance += l.debit - l.credit;
    totalDebit += l.debit;
    totalCredit += l.credit;
    return { ...l, balance };
  });

  const position = customerPositions(data, to).find((p) => p.customer.id === customerId)!;
  return {
    customer,
    from,
    to,
    opening,
    lines: withBalance,
    totalDebit,
    totalCredit,
    closing: balance,
    ageing: position.buckets,
    unapplied: position.unapplied,
  };
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\statement.test.ts
131 lines
import { describe, expect, it } from 'vitest';
import { BUCKETS, balanceByDocuments } from '@/lib/ar/balances';
import { addDays } from '@/lib/ar/dates';
import { statement } from '@/lib/ar/statement';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const customer = (code: string) => data.customers.find((c) => c.code === code)!;
const invoice = (no: string) => data.invoices.find((i) => i.invoiceNo === no)!;

describe('R15 statement: spot check 8', () => {
  const s = statement(data, customer('C002').id, '2026-04-01', '2026-08-31');

  it('C002, 01-Apr-2026 to 31-Aug-2026: opening 70,800 Dr, closing 2,23,000 Dr, 7 lines', () => {
    expect(s.opening).toBe(7080000);
    expect(s.closing).toBe(22300000);
    expect(s.lines).toHaveLength(7);
  });

  it('shows each line, in order, with its running balance', () => {
    expect(s.lines.map((l) => [l.date, l.type, l.documentNo, l.debit, l.credit, l.balance])).toEqual([
      ['2026-04-18', 'Invoice', 'BWA/26-27/0003', 14160000, 0, 21240000],
      ['2026-05-20', 'Payment received', 'RCT/26-27/0005', 0, 6480000, 14760000],
      ['2026-05-20', 'TDS deducted by you', 'RCT/26-27/0005', 0, 600000, 14160000],
      ['2026-05-22', 'Invoice', 'BWA/26-27/0009', 9440000, 0, 23600000],
      ['2026-06-15', 'Payment received', 'RCT/26-27/0007', 0, 6000000, 17600000],
      ['2026-06-15', 'TDS deducted by you', 'RCT/26-27/0007', 0, 1200000, 16400000],
      ['2026-07-20', 'Invoice', 'BWA/26-27/0018', 5900000, 0, 22300000],
    ]);
    expect(s.totalDebit).toBe(29500000);
    expect(s.totalCredit).toBe(14280000);
    expect(s.opening + s.totalDebit - s.totalCredit).toBe(s.closing);
  });

  it('footer: the closing balance by ageing bucket, with no unapplied credit', () => {
    expect(s.unapplied).toBe(0);
    expect(s.ageing).toMatchObject({ 'Not due': 5900000, '31-60': 9440000, '61-90': 6960000 });
  });
});

describe('R15 statement: what goes in and what is left out', () => {
  it('leaves out the TDS line when no TDS was deducted', () => {
    // C006 deducts no TDS: 2 invoices + 2 receipts, and no TDS lines
    const s = statement(data, customer('C006').id, '2026-04-01', '2026-07-31');
    expect(s.lines.map((l) => l.type)).toEqual(['Invoice', 'Payment received', 'Invoice', 'Payment received']);
  });

  it('shows a credit note as a credit of its total', () => {
    const s = statement(data, customer('C004').id, '2026-07-01', '2026-07-31');
    expect(s.lines.find((l) => l.type === 'Credit note')).toMatchObject({
      date: '2026-07-25', documentNo: 'BWA/CN/26-27/001', debit: 0, credit: 2950000,
    });
  });

  it('leaves out cancelled invoices', () => {
    const s = statement(data, customer('C007').id, '2026-07-01', '2026-07-31');
    expect(s.lines.map((l) => l.documentNo)).toEqual(['BWA/26-27/0015']); // not 0014
  });

  it('shows an advance as a credit balance (C005, July)', () => {
    const s = statement(data, customer('C005').id, '2026-07-01', '2026-07-12');
    expect(s.opening).toBe(0);
    expect(s.closing).toBe(-10000000); // 1,00,000 Cr
    expect(s.unapplied).toBe(10000000);
  });

  it('refuses a From date after the To date', () => {
    expect(() => statement(data, customer('C002').id, '2026-08-31', '2026-04-01')).toThrow();
  });
});

describe('R15 same-date ordering', () => {
  it('goes invoices, credit notes, receipts, TDS lines, then document number', () => {
    const c001 = customer('C001');
    const template = invoice('BWA/26-27/0021');
    const day = '2026-10-01';
    // Records on one day, deliberately added out of order
    const extra: ArData = {
      ...data,
      receipts: [
        ...data.receipts,
        { id: -2, receiptNo: 'RCT/26-27/0019', customerId: c001.id, receiptDate: day, bankAmount: 100000, tdsAmount: 10000, mode: 'NEFT', reference: 'B' },
        { id: -1, receiptNo: 'RCT/26-27/0018', customerId: c001.id, receiptDate: day, bankAmount: 200000, tdsAmount: 20000, mode: 'NEFT', reference: 'A' },
      ],
      creditNotes: [
        ...data.creditNotes,
        { id: -3, creditNoteNo: 'BWA/CN/26-27/002', invoiceId: -4, creditNoteDate: day, taxableValue: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000, reason: 'Test' },
      ],
      invoices: [
        ...data.invoices,
        { ...template, id: -5, invoiceNo: 'BWA/26-27/0026', invoiceDate: day, dueDate: '2026-10-31' },
        { ...template, id: -4, invoiceNo: 'BWA/26-27/0025', invoiceDate: day, dueDate: '2026-10-31' },
      ],
    };
    const s = statement(extra, c001.id, day, day);
    expect(s.lines.map((l) => `${l.type} ${l.documentNo}`)).toEqual([
      'Invoice BWA/26-27/0025',
      'Invoice BWA/26-27/0026',
      'Credit note BWA/CN/26-27/002',
      'Payment received RCT/26-27/0018',
      'Payment received RCT/26-27/0019',
      'TDS deducted by you RCT/26-27/0018',
      'TDS deducted by you RCT/26-27/0019',
    ]);
  });
});

describe('R15 statement ties to the control check (R14)', () => {
  it('opening and closing equal balanceByDocuments, for every customer and every To date', () => {
    for (const c of data.customers) {
      for (const from of ['2026-01-01', '2026-04-01', '2026-07-15']) {
        for (let to = from; to <= '2026-10-31'; to = addDays(to, 1)) {
          const s = statement(data, c.id, from, to);
          expect(s.opening, `${c.code} opening ${from}`).toBe(balanceByDocuments(data, c.id, addDays(from, -1)));
          expect(s.closing, `${c.code} ${from} to ${to}`).toBe(balanceByDocuments(data, c.id, to));
        }
      }
    }
  });

  it('footer ageing less unapplied credit equals the closing balance', () => {
    for (const c of data.customers) {
      for (const to of ['2026-03-31', '2026-06-30', '2026-07-12', '2026-08-31', '2026-10-31']) {
        const s = statement(data, c.id, '2026-04-01', to);
        const ageingTotal = BUCKETS.reduce((sum, b) => sum + s.ageing[b], 0);
        expect(ageingTotal - s.unapplied, `${c.code} ${to}`).toBe(s.closing);
      }
    }
  });
});
PowerShell Run statement tests, all tests, lint, types
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npx vitest run tests/statement.test.ts --reporter=verbose 2>&1" | Select-Object -Last 40; "=== ALL ==="; cmd /c "npm test 2>&1" | Select-Object -Last 5; cmd /c "npx eslint lib tests 2>&1"; "lint exit $LASTEXITCODE"; cmd /c "npx tsc --noEmit 2>&1"; "tsc exit $LASTEXITCODE"

OUT
 RUN  v5.0.5 C:/Users/Dell/Desktop/Akanksha - Verve Advisory/Accountmanager/ar-manager-ca-it-main

 ✓ tests/statement.test.ts > R15 statement: spot check 8 > C002, 01-Apr-2026 to 31-Aug-2026: opening 70,800 Dr, closing 2,23,000 Dr, 7 lines 9ms
 ✓ tests/statement.test.ts > R15 statement: spot check 8 > shows each line, in order, with its running balance 8ms
 ✓ tests/statement.test.ts > R15 statement: spot check 8 > footer: the closing balance by ageing bucket, with no unapplied credit 4ms
 ✓ tests/statement.test.ts > R15 statement: what goes in and what is left out > leaves out the TDS line when no TDS was deducted 2ms
 ✓ tests/statement.test.ts > R15 statement: what goes in and what is left out > shows a credit note as a credit of its total 3ms
 ✓ tests/statement.test.ts > R15 statement: what goes in and what is left out > leaves out cancelled invoices 3ms
 ✓ tests/statement.test.ts > R15 statement: what goes in and what is left out > shows an advance as a credit balance (C005, July) 1ms
 ✓ tests/statement.test.ts > R15 statement: what goes in and what is left out > refuses a From date after the To date 5ms
 ✓ tests/statement.test.ts > R15 same-date ordering > goes invoices, credit notes, receipts, TDS lines, then document number 3ms
 ✓ tests/statement.test.ts > R15 statement ties to the control check (R14) > opening and closing equal balanceByDocuments, for every customer and every To date 881ms
 × tests/statement.test.ts > R15 statement ties to the control check (R14) > footer ageing less unapplied credit equals the closing balance 13ms
   → The From date (2026-04-01) is after the To date (2026-03-31).

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/statement.test.ts > R15 statement ties to the control check (R14) > footer ageing less unapplied credit equals the closing balance
Error: The From date (2026-04-01) is after the To date (2026-03-31).
 ❯ statement lib/ar/statement.ts:46:24
     44|  */
     45| export function statement(data: ArData, customerId: number, from: stri…
     46|   if (from > to) throw new Error(`The From date (${from}) is after the…
       |                        ^
     47|   const customer = data.customers.find((c) => c.id === customerId);
     48|   if (!customer) throw new Error(`Customer ${customerId} not found.`);
 ❯ tests/statement.test.ts:124:19

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
   Start at  20:55:17
   Duration  1.93s (tests 69%, transform 20%, import 10%, worker 1%)

=== ALL ===
   Duration  2.20s (tests 74%, import 16%, transform 6%, worker 5%)

    Isolate  5 workers spawned · ~582ms startup each (spawn + environment, per file)
             at least ~388ms faster with isolate: false — reuses workers across files instead of one per file

lint exit 0
tsc exit 0
One test failure was my own error—I'd set a From date after the To date, and the statement correctly rejected it as invalid. I'll fix the test to use 1-Jan as the From date instead.
Edit C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\statement.test.ts
Modified
PowerShell Rerun statement tests and full suite
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npx vitest run tests/statement.test.ts 2>&1" | Select-Object -Last 5; "=== ALL ==="; cmd /c "npm test 2>&1" | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }

OUT
 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  20:56:27
   Duration  1.79s (tests 78%, transform 12%, import 8%, worker 2%)

=== ALL ===
 Test Files  5 passed (5)
      Tests  69 passed (69)
   Duration  2.35s (tests 73%, import 15%, worker 6%, transform 5%)
8:56 PM
Step B5 is done. All 69 tests pass (58 earlier + 11 new). Lint and type checks are clean.

What I built
lib/ar/statement.ts: the statement(data, customerId, from, to) function.
tests/statement.test.ts: 11 tests.
Spot check 8: matches your paper working
C002, 01-Apr to 31-Aug-2026: opening 70,800 Dr, 7 lines, closing 2,23,000 Dr ✅

The test checks every line: date, type, document number, debit, credit and running balance. All match the hand-worked table above. Totals are debit 2,95,000 and credit 1,42,800, so 70,800 + 2,95,000 − 1,42,800 = 2,23,000.

Footer: Not due 59,000, 31–60 94,400, 61–90 69,600, with no unapplied credit. These are the same figures as C002's ageing in B4.
The same-date ordering rule
I built a test day with records deliberately added in the wrong order: two invoices, a credit note, and two receipts with TDS. The statement sorted them correctly:


Invoice      BWA/26-27/0025
Invoice      BWA/26-27/0026
Credit note  BWA/CN/26-27/002
Payment      RCT/26-27/0018
Payment      RCT/26-27/0019
TDS          RCT/26-27/0018
TDS          RCT/26-27/0019
Both receipts come before both TDS lines, as R15 says: "receipts, then TDS lines".

Ties to the control check
For every customer, from three different start dates, to every day up to 31-Oct (thousands of statements), the opening and closing balances equal balanceByDocuments.
Footer: ageing total − unapplied credit = closing balance, for every customer.
Other rules tested
No TDS line when TDS is zero. C006 deducts no TDS, so its statement has no TDS lines.
The credit note shows as a credit of 29,500 on C004's statement.
Cancelled invoice 0014 is left off C007's statement.
The C005 advance shows as a closing balance of 1,00,000 Cr.
A backwards date range (From after To) is refused with a clear message.
The one failure (worth keeping in your log)
One test failed on the first run. My test asked for a statement from 1-Apr to 31-Mar, which is backwards, and the code's own safety check refused it. I corrected the test, not the code. This shows why the brief says to check AI-written work: AI can make mistakes in tests too.

For your interview: one design point
The statement's opening and closing balances come from balanceByDocuments, the same function as the control check (R14). So by design, a statement can never disagree with the customer balance shown elsewhere in the tool. The brief requires this: "a closing balance that equals the R14 balance as at T".

Your turn
Run npm test. You should see 69 passed.
Commit and push with the message Add statement of account with tests.
Next is B6: notes, follow-ups and promises (spot check 9). Before sending the B6 prompt, think through the C003 promise:

The note is dated 10-Aug, promising 2,34,200 by 30-Sep.
What should its status be as at 31-Aug, and as at 15-Oct?
Hint: look at C003's receipts after 10-Aug in the brief's data.


B6- R16: build followUpsDue and promiseStatuses with tests, including spot check 9.
9:01 PM
The plan for B6 (R16), in lib/ar/notes.ts:

followUpsDue(data, D) lists notes whose follow-up date is on or before D and which are not marked done.

It also respects R10: a note dated after D doesn't exist yet, so it can't appear.
Each one shows how many days the follow-up is overdue, oldest first.
promiseStatuses(data, D) gives each promise to pay (only notes dated ≤ D) one of three statuses:

Status	When
Kept	The customer's receipts (bank + TDS) dated from the note date to the earlier of the promise date and D add up to at least the promised amount
Broken	Not kept, and the promise date is before D
Pending	Anything else, including on the promise date itself
The answer to your C003 homework:

The promise is 2,34,200 by 30-Sep, noted 10-Aug, and C003 has no receipts after 10-Aug.
As at 31-Aug it's Pending, because the promise date hasn't passed.
As at 15-Oct it's Broken, because 30-Sep has passed with nothing received.
On 30-Sep itself it's still Pending. It becomes Broken from 1-Oct.


Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\notes.ts
53 lines
import { daysBetween } from './dates';
import type { ArData, Note, Paise } from './types';

export type PromiseStatus = 'Kept' | 'Broken' | 'Pending';

export interface FollowUp {
  note: Note;
  daysOverdue: number; // 0 when the follow-up is due today
}

export interface PromiseToPay {
  note: Note;
  promiseDate: string;
  promiseAmount: Paise;
  received: Paise; // settlement value received from note_date to min(promise_date, asOf)
  status: PromiseStatus;
}

/**
 * R16: open follow-ups as at asOf: follow_up_date on or before asOf and not marked done.
 * A note dated after asOf does not exist yet (R10). Oldest follow-up first.
 */
export function followUpsDue(data: ArData, asOf: string): FollowUp[] {
  return data.notes
    .filter((n) => n.noteDate <= asOf && n.followUpDate !== null && n.followUpDate <= asOf && !n.followUpDone)
    .map((note) => ({ note, daysOverdue: daysBetween(note.followUpDate!, asOf) }))
    .sort((a, b) => a.note.followUpDate!.localeCompare(b.note.followUpDate!) || a.note.id - b.note.id);
}

/**
 * R16: every promise to pay noted on or before asOf, with its status.
 * Kept when the customer's receipts (bank + TDS) dated from the note date to the earlier of
 * the promise date and asOf reach the promised amount; Broken when not kept and the promise
 * date has passed; otherwise Pending.
 */
export function promiseStatuses(data: ArData, asOf: string): PromiseToPay[] {
  const promises: PromiseToPay[] = [];
  for (const note of data.notes) {
    if (note.noteDate > asOf || note.promiseDate === null || note.promiseAmount === null) continue;
    const windowEnd = note.promiseDate < asOf ? note.promiseDate : asOf;
    let received = 0;
    for (const r of data.receipts) {
      if (r.customerId === note.customerId && note.noteDate <= r.receiptDate && r.receiptDate <= windowEnd) {
        received += r.bankAmount + r.tdsAmount;
      }
    }
    const status: PromiseStatus =
      received >= note.promiseAmount ? 'Kept' : note.promiseDate < asOf ? 'Broken' : 'Pending';
    promises.push({ note, promiseDate: note.promiseDate, promiseAmount: note.promiseAmount, received, status });
  }
  return promises;
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\notes.test.ts
120 lines
import { describe, expect, it } from 'vitest';
import { followUpsDue, promiseStatuses } from '@/lib/ar/notes';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

const codeOf = (customerId: number) => data.customers.find((c) => c.id === customerId)!.code;

/** The promise noted for a customer on a date, as at asOf. */
const promise = (code: string, noteDate: string, asOf: string) =>
  promiseStatuses(data, asOf).find((p) => codeOf(p.note.customerId) === code && p.note.noteDate === noteDate);

describe('R16 promise status', () => {
  it('9: the promise noted by C002 on 20-Jul-2026 is Broken as at 31-Aug-2026', () => {
    expect(promise('C002', '2026-07-20', '2026-08-31')).toMatchObject({
      promiseDate: '2026-08-01', promiseAmount: 6960000, received: 0, status: 'Broken',
    });
  });

  it('is Pending up to and on the promise date, and Broken from the next day', () => {
    expect(promise('C002', '2026-07-20', '2026-07-31')!.status).toBe('Pending');
    expect(promise('C002', '2026-07-20', '2026-08-01')!.status).toBe('Pending');
    expect(promise('C002', '2026-07-20', '2026-08-02')!.status).toBe('Broken');
  });

  it('stays Broken when the money arrives after the promise date', () => {
    // C002 paid 94,400 on 9 Sep, but the promise of 20 Jul was due by 1 Aug
    expect(promise('C002', '2026-07-20', '2026-09-30')).toMatchObject({ received: 0, status: 'Broken' });
  });

  it('C003 promise (2,34,200 by 30-Sep): Pending on 31-Aug and 30-Sep, Broken from 1-Oct', () => {
    expect(promise('C003', '2026-08-10', '2026-08-31')!.status).toBe('Pending');
    expect(promise('C003', '2026-08-10', '2026-09-30')!.status).toBe('Pending');
    expect(promise('C003', '2026-08-10', '2026-10-01')!.status).toBe('Broken');
    expect(promise('C003', '2026-08-10', '2026-10-15')).toMatchObject({ promiseAmount: 23420000, received: 0, status: 'Broken' });
  });

  it('is Kept as soon as receipts (bank + TDS) reach the promised amount', () => {
    // C002 promised 94,400 by 10 Sep on 2 Sep; RCT/26-27/0016 on 9 Sep is 86,400 + 8,000 TDS
    expect(promise('C002', '2026-09-02', '2026-09-08')).toMatchObject({ received: 0, status: 'Pending' });
    expect(promise('C002', '2026-09-02', '2026-09-09')).toMatchObject({ received: 9440000, status: 'Kept' });
    expect(promise('C002', '2026-09-02', '2026-10-31')!.status).toBe('Kept');
  });

  it('does not exist before its note date', () => {
    expect(promise('C002', '2026-09-02', '2026-09-01')).toBeUndefined();
  });

  it('lists every promise in the sample data once all notes exist', () => {
    expect(promiseStatuses(data, '2026-10-31').map((p) => [codeOf(p.note.customerId), p.status])).toEqual([
      ['C002', 'Broken'],
      ['C003', 'Broken'],
      ['C002', 'Kept'],
    ]);
  });

  it('counts only receipts on or after the note date, and only for that customer', () => {
    const c002 = data.customers.find((c) => c.code === 'C002')!;
    const c003 = data.customers.find((c) => c.code === 'C003')!;
    const withReceipts: ArData = {
      ...data,
      receipts: [
        ...data.receipts,
        // Before the 20-Jul note: does not count
        { id: -1, receiptNo: 'T1', customerId: c002.id, receiptDate: '2026-07-19', bankAmount: 9999900, tdsAmount: 0, mode: 'NEFT', reference: null },
        // Another customer: does not count
        { id: -2, receiptNo: 'T2', customerId: c003.id, receiptDate: '2026-07-25', bankAmount: 9999900, tdsAmount: 0, mode: 'NEFT', reference: null },
        // On the note date, part of the amount: counts, but not enough
        { id: -3, receiptNo: 'T3', customerId: c002.id, receiptDate: '2026-07-20', bankAmount: 5000000, tdsAmount: 0, mode: 'NEFT', reference: null },
        // On the promise date, the rest with TDS: now kept
        { id: -4, receiptNo: 'T4', customerId: c002.id, receiptDate: '2026-08-01', bankAmount: 1760000, tdsAmount: 200000, mode: 'NEFT', reference: null },
      ],
    };
    const at = (asOf: string) => promiseStatuses(withReceipts, asOf).find((p) => p.note.noteDate === '2026-07-20')!;
    expect(at('2026-07-31')).toMatchObject({ received: 5000000, status: 'Pending' });
    expect(at('2026-08-31')).toMatchObject({ received: 6960000, status: 'Kept' });
  });
});

describe('R16 follow-ups due', () => {
  const due = (asOf: string, d: ArData = data) =>
    followUpsDue(d, asOf).map((f) => [codeOf(f.note.customerId), f.note.followUpDate, f.daysOverdue]);

  it('has none as at 31-Aug-2026: every follow-up date is later', () => {
    expect(due('2026-08-31')).toEqual([]);
  });

  it('lists open follow-ups dated on or before the as-at date, oldest first', () => {
    expect(due('2026-09-10')).toEqual([
      ['C006', '2026-09-01', 9],
      ['C004', '2026-09-05', 5],
      ['C004', '2026-09-10', 0],
    ]);
    expect(due('2026-09-15')).toHaveLength(4);
  });

  it('leaves out follow-ups marked done', () => {
    const doneData: ArData = {
      ...data,
      notes: data.notes.map((n) => (n.followUpDate === '2026-09-01' ? { ...n, followUpDone: true } : n)),
    };
    expect(due('2026-09-10', doneData).map((f) => f[1])).toEqual(['2026-09-05', '2026-09-10']);
  });

  it('leaves out notes dated after the as-at date', () => {
    const c001 = data.customers.find((c) => c.code === 'C001')!;
    const laterNote: ArData = {
      ...data,
      notes: [
        ...data.notes,
        {
          id: -1, customerId: c001.id, invoiceId: null, noteDate: '2026-09-20', noteType: 'Call', body: 'Test',
          followUpDate: '2026-09-01', followUpDone: false, promiseDate: null, promiseAmount: null,
        },
      ],
    };
    expect(due('2026-09-10', laterNote)).toHaveLength(3);
    expect(due('2026-09-20', laterNote)).toHaveLength(5);
  });
});
PowerShell Run notes tests, all tests, lint, types
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npx vitest run tests/notes.test.ts --reporter=verbose 2>&1" | Select-Object -Last 30; "=== ALL ==="; cmd /c "npm test 2>&1" | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }; cmd /c "npx eslint lib tests 2>&1"; "lint exit $LASTEXITCODE"; cmd /c "npx tsc --noEmit 2>&1"; "tsc exit $LASTEXITCODE"

OUT
 RUN  v5.0.5 C:/Users/Dell/Desktop/Akanksha - Verve Advisory/Accountmanager/ar-manager-ca-it-main

 ✓ tests/notes.test.ts > R16 promise status > 9: the promise noted by C002 on 20-Jul-2026 is Broken as at 31-Aug-2026 8ms
 ✓ tests/notes.test.ts > R16 promise status > is Pending up to and on the promise date, and Broken from the next day 1ms
 ✓ tests/notes.test.ts > R16 promise status > stays Broken when the money arrives after the promise date 0ms
 ✓ tests/notes.test.ts > R16 promise status > C003 promise (2,34,200 by 30-Sep): Pending on 31-Aug and 30-Sep, Broken from 1-Oct 1ms
 ✓ tests/notes.test.ts > R16 promise status > is Kept as soon as receipts (bank + TDS) reach the promised amount 1ms
 ✓ tests/notes.test.ts > R16 promise status > does not exist before its note date 0ms
 ✓ tests/notes.test.ts > R16 promise status > lists every promise in the sample data once all notes exist 1ms
 ✓ tests/notes.test.ts > R16 promise status > counts only receipts on or after the note date, and only for that customer 1ms
 ✓ tests/notes.test.ts > R16 follow-ups due > has none as at 31-Aug-2026: every follow-up date is later 1ms
 ✓ tests/notes.test.ts > R16 follow-ups due > lists open follow-ups dated on or before the as-at date, oldest first 32ms
 ✓ tests/notes.test.ts > R16 follow-ups due > leaves out follow-ups marked done 1ms
 ✓ tests/notes.test.ts > R16 follow-ups due > leaves out notes dated after the as-at date 1ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  21:02:25
   Duration  812ms (transform 59%, import 19%, tests 17%, worker 5%)

=== ALL ===
 Test Files  6 passed (6)
      Tests  81 passed (81)
   Duration  2.44s (tests 77%, import 14%, transform 5%, worker 4%)
lint exit 0
tsc exit 0
9:03 PM
Step B6 is done. All 81 tests pass (69 earlier + 12 new). Lint and type checks are clean.

What I built
lib/ar/notes.ts: followUpsDue and promiseStatuses.
tests/notes.test.ts: 12 tests.
Spot check 9
C002's promise of 20-Jul-2026, as at 31-Aug-2026: Broken ✅

The promise was ₹69,600 by 1-Aug.
C002's receipts between 20-Jul and 1-Aug add up to 0.
1-Aug is before 31-Aug, so the promise is broken.
All three promises in the sample data
Promise	31-Aug	Later
C002, 20-Jul: 69,600 by 1-Aug	Broken	Pending on 31-Jul and on 1-Aug itself; Broken from 2-Aug. Stays Broken even after C002 pays on 9-Sep, because that's after the promise date.
C003, 10-Aug: 2,34,200 by 30-Sep (your homework)	Pending	Still Pending on 30-Sep; Broken from 1-Oct (and on 15-Oct), with nothing received
C002, 2-Sep: 94,400 by 10-Sep	Doesn't exist yet (noted 2-Sep)	Pending on 8-Sep; Kept from 9-Sep, when receipt 0016 brings 86,400 + 8,000 TDS = 94,400 exactly
The last row also shows that TDS counts towards a promise: bank 86,400 alone would fall short.

Follow-ups due
As at	Due	Days overdue
31-Aug	None (all follow-up dates are later)	
10-Sep	C006 (1-Sep)	9
C004 (5-Sep)	5
C004 (10-Sep)	0, due today
15-Sep	All 4, adding C003 (15-Sep)	
Also tested:

Follow-ups marked done disappear from the list.
A note dated after the as-at date doesn't appear, even if its follow-up date is earlier.
For promises, receipts before the note date or from another customer don't count. Receipts on the note date and on the promise date do count.
For your interview: two judgement points
The promise "window". Only receipts from the note date up to the earlier of the promise date and D count. Money arriving late doesn't turn a Broken promise into Kept. That matches how an AR analyst would judge a customer's reliability.
"Done" isn't dated. The database's follow-up-done flag has no date. So if you mark a follow-up done today and look back at an earlier date, it won't show as due on that date either. Note this under Assumptions in your README.
Your turn
Run npm test. You should see 81 passed.
Commit and push with the message Add follow-ups and promise status with tests.
Next is B7, DSO (R17), the last calculation. Before sending the B7 prompt, try calculating DSO as at 31-Aug-2026 on paper:

Outstanding (before unapplied credit): 21,18,100, from the B4 table total.
S = totals of non-cancelled invoices dated 3-Jun to 31-Aug-2026 (the 90 days ending on 31-Aug), minus credit notes in the same window.
DSO = 21,18,100 ÷ S × 90, rounded to whole days.


B7- R17: build dso() with tests: one date worked by hand, and a date where sales in the window are zero.
9:05 PM
I'll work out the hand calculation first. As at 31-Aug-2026, the 90-day window runs from 3-Jun to 31-Aug-2026, since 31-Aug minus 89 days is 3-Jun, and both ends count.

S: invoices in the window (non-cancelled), less credit notes

Invoice	Date	Total
0011	05-Jun	88,500
0012	15-Jun	29,500
0013	28-Jun	82,600
0014	01-Jul	cancelled, excluded
0015	02-Jul	4,72,000
0016	05-Jul	88,500
0017	15-Jul	1,18,000
0018	20-Jul	59,000
0019	30-Jul	3,54,000
0020	01-Aug	35,400
0021	05-Aug	88,500
0022	20-Aug	70,800
0023	25-Aug	2,59,600
Invoices		17,46,400
Less credit note CN/001	25-Jul	(29,500)
S		17,16,900
DSO = 21,18,100 ÷ 17,16,900 × 90 = 111.03, which rounds to 111 days.

For the zero-sales date: the last invoice is 0024 on 5-Sep-2026. So as at 4-Dec-2026 the window runs from 6-Sep to 4-Dec, with no sales at all, while money is still outstanding. DSO should show "—".

The function works in whole paise, multiplies before dividing, and rounds once. I'll also export the window and S on their own (salesWindow), so the dashboard can show how DSO was worked out.



Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\lib\ar\dso.ts
38 lines
import { addDays } from './dates';
import { invoicePositions } from './positions';
import type { ArData, Paise } from './types';

export const DSO_WINDOW_DAYS = 90;

export interface SalesWindow {
  from: string; // asOf − 89 days
  to: string; // asOf
  sales: Paise; // S: non-cancelled invoice totals less credit-note totals dated in the window
}

/** R17: S, the net sales of the 90 days ending on asOf (both ends included). */
export function salesWindow(data: ArData, asOf: string): SalesWindow {
  const from = addDays(asOf, -(DSO_WINDOW_DAYS - 1));
  const inWindow = (date: string) => from <= date && date <= asOf;
  let sales = 0;
  for (const i of data.invoices) {
    if (!i.isCancelled && inWindow(i.invoiceDate)) sales += i.total;
  }
  for (const c of data.creditNotes) {
    if (inWindow(c.creditNoteDate)) sales -= c.total;
  }
  return { from, to: asOf, sales };
}

/**
 * R17: DSO = Σ invoice outstanding (before unapplied credit) ÷ S × 90, to the nearest whole day.
 * Returns null (shown as "—") when there are no net sales in the window.
 */
export function dso(data: ArData, asOf: string): number | null {
  const { sales } = salesWindow(data, asOf);
  // S below zero (credit notes larger than sales) would give a meaningless negative DSO, so it is treated like zero.
  if (sales <= 0) return null;
  const outstanding = invoicePositions(data, asOf).reduce((sum, p) => sum + p.outstanding, 0);
  return Math.round((outstanding * DSO_WINDOW_DAYS) / sales);
}
Write C:\Users\Dell\Desktop\Akanksha - Verve Advisory\Accountmanager\ar-manager-ca-it-main\tests\dso.test.ts
58 lines
import { describe, expect, it } from 'vitest';
import { customerPositions } from '@/lib/ar/balances';
import { dso, salesWindow } from '@/lib/ar/dso';
import type { ArData } from '@/lib/ar/types';
import { sampleData as data } from './fixture';

describe('R17 DSO', () => {
  it('as at 31-Aug-2026, worked by hand: 21,18,100 ÷ 17,16,900 × 90 = 111.03 → 111 days', () => {
    // Window 03-Jun to 31-Aug: invoices 0011–0023 except cancelled 0014 = 17,46,400,
    // less credit note BWA/CN/26-27/001 (29,500) = 17,16,900
    expect(salesWindow(data, '2026-08-31')).toEqual({ from: '2026-06-03', to: '2026-08-31', sales: 171690000 });
    // Outstanding is before unapplied credit: 21,18,100, not the net 20,18,100
    const outstanding = customerPositions(data, '2026-08-31').reduce((s, p) => s + p.outstanding, 0);
    expect(outstanding).toBe(211810000);
    expect(dso(data, '2026-08-31')).toBe(111);
  });

  it('shows "—" (null) when there are no sales in the window', () => {
    // The last invoice is BWA/26-27/0024 on 05-Sep-2026, so the window 06-Sep to 04-Dec is empty
    expect(salesWindow(data, '2026-12-04')).toMatchObject({ from: '2026-09-06', sales: 0 });
    expect(dso(data, '2026-12-04')).toBeNull();
    // One day earlier the window still reaches 05-Sep and includes that invoice
    expect(salesWindow(data, '2026-12-03').sales).toBe(8850000);
    expect(dso(data, '2026-12-03')).not.toBeNull();
  });

  it('shows "—" before any invoice exists', () => {
    expect(dso(data, '2026-01-19')).toBeNull();
  });

  it('uses a 90-day window including both ends', () => {
    // BWA/26-27/0011 is dated 05-Jun: inside the window as at 02-Sep (05-Jun + 89), outside on 03-Sep
    const has0011 = (asOf: string) => salesWindow(data, asOf).from <= '2026-06-05';
    expect(salesWindow(data, '2026-09-02').from).toBe('2026-06-05');
    expect(has0011('2026-09-02')).toBe(true);
    expect(has0011('2026-09-03')).toBe(false);
  });

  it('leaves the cancelled invoice out of S', () => {
    // BWA/26-27/0014 (01-Jul, 2,36,000) is cancelled; 0015 (02-Jul, 4,72,000) is the only other sale on those days
    const asOf = '2026-07-02';
    const julyOnly = (d: ArData) => salesWindow(d, asOf).sales - salesWindow(d, '2026-06-30').sales;
    expect(julyOnly(data)).toBe(47200000);
  });

  it('treats net sales below zero like zero', () => {
    const bigCreditNote: ArData = {
      ...data,
      creditNotes: [
        ...data.creditNotes,
        { ...data.creditNotes[0], id: -1, creditNoteNo: 'TEST', creditNoteDate: '2026-12-01', total: 99999900 },
      ],
    };
    expect(salesWindow(bigCreditNote, '2026-12-04').sales).toBeLessThan(0);
    expect(dso(bigCreditNote, '2026-12-04')).toBeNull();
  });
});
PowerShell Run DSO tests, all tests, lint, types
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npx vitest run tests/dso.test.ts --reporter=verbose 2>&1" | Select-Object -Last 25; "=== ALL ==="; cmd /c "npm test 2>&1" | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }; cmd /c "npx eslint lib tests 2>&1"; "lint exit $LASTEXITCODE"; cmd /c "npx tsc --noEmit 2>&1"; "tsc exit $LASTEXITCODE"

OUT
 RUN  v5.0.5 C:/Users/Dell/Desktop/Akanksha - Verve Advisory/Accountmanager/ar-manager-ca-it-main

 ✓ tests/dso.test.ts > R17 DSO > as at 31-Aug-2026, worked by hand: 21,18,100 ÷ 17,16,900 × 90 = 111.03 → 111 days 14ms
 ✓ tests/dso.test.ts > R17 DSO > shows "—" (null) when there are no sales in the window 4ms
 ✓ tests/dso.test.ts > R17 DSO > shows "—" before any invoice exists 1ms
 ✓ tests/dso.test.ts > R17 DSO > uses a 90-day window including both ends 1ms
 ✓ tests/dso.test.ts > R17 DSO > leaves the cancelled invoice out of S 1ms
 ✓ tests/dso.test.ts > R17 DSO > treats net sales below zero like zero 1ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  21:06:11
   Duration  1.58s (transform 60%, import 25%, worker 8%, tests 7%, environment 1%)

=== ALL ===
 Test Files  7 passed (7)
      Tests  87 passed (87)
   Duration  3.26s (tests 79%, import 12%, transform 6%, worker 3%)
lint exit 0
tsc exit 0
9:06 PM
All 6 DSO tests pass. As the B8 final check for Phase B, I'll run the production build, which is what Vercel runs.



PowerShell Run production build and show uncommitted files
IN
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); cmd /c "npm run build 2>&1" | Select-Object -Last 9; "build exit $LASTEXITCODE"; git status --short

OUT
Route (app)
┌ ƒ /
└ ○ /_not-found


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

build exit 0
?? lib/ar/dso.ts
?? tests/dso.test.ts
9:07 PM
Step B7 is done, and with it all of Phase B. All 87 tests pass across 7 test files, and the lint check, type check and production build are all clean.

B7 results
lib/ar/dso.ts: dso(), plus salesWindow(), which shows the window dates and S so the dashboard can explain the figure.
tests/dso.test.ts: 6 tests.
Test	Result
As at 31-Aug-2026, worked by hand	✅ Window 03-Jun to 31-Aug, S = 17,16,900, outstanding 21,18,100, so DSO = 111.03, rounded to 111 days
No sales in the window (as at 4-Dec-2026)	✅ S = 0, so it shows "—". One day earlier (3-Dec) the window still catches the 5-Sep invoice, so DSO has a value.
Before any invoice exists	✅ "—"
Window boundary	✅ Exactly 90 days, both ends included
Cancelled invoice 0014	✅ Left out of S
Two points for your interview:

DSO uses outstanding before unapplied credit: 21,18,100, not the net 20,18,100. R17 says so explicitly.
An assumption: if credit notes ever exceed sales in the window, S becomes negative. I treat that like zero and show "—", since a negative DSO is meaningless. Add this to the Assumptions list in your README.
Phase B is complete: the calculation engine
Spot check	Rule	Status
1, 2	GST and due date	✅
3, 4, 7	Invoice position and ageing	✅
5, 6	Customer balance and advances (Cr)	✅
8	Statement of account	✅
9	Promise status	✅
10	Control check, all 304 days	✅
All ten published spot checks pass, plus 77 more tests on boundaries, traps and invariants.

Your Git history shows you've committed every step up to B6. Only the DSO files are waiting.

Your turn: finish Phase B (B8)
Run npm test. You should see 87 passed.
Commit and push with the message Add DSO calculation with tests.
Save the chat log:
Create ai-logs/session-02-calculations.md.
Paste everything in this chat from your "give me step by step guidance for Phase B" message down to here.
Commit it with the message Add AI chat log for calculations session and push.
What's next: Phase C, the screens
The engine is done. From here, the screens only display what lib/ar returns. The first step is Part 5, step 5: layout and as-at date. It covers:

the header with navigation;
the date picker, which keeps ?asof= in the web address;
formatting helpers: ₹1,23,456.00, 31-Aug-2026, and the Dr / Cr suffixes, with their tests.
When you're ready, ask: "Give me step-by-step guidance for Phase C", and I'll lay it out the same way as Phase B.



