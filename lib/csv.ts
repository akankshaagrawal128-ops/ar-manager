// CSV building for the exports (brief section 4.12).

/** Byte order mark, so Excel reads the file as UTF-8. */
export const BOM = '﻿';

/** Quotes a field when it contains a comma, a quote or a line break; quotes inside are doubled. */
export function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole CSV file: BOM, then one line per row, separated by CRLF. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return BOM + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
