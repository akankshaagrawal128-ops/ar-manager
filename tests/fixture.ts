// The sample data as ArData, for every test. Comes from tests/fixtures/sample.json,
// so tests run offline and are not affected by records added to the workspace.
import sample from './fixtures/sample.json';
import { toArData, type RawTables } from '@/lib/ar/rows';

export const sampleData = toArData(sample as RawTables);
