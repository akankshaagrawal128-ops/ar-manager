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
