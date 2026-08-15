// Output formatting for the AygaCRM CLI: pretty JSON, an aligned-column table,
// and an NDJSON line printer used by `--page-all`.

export type OutputFormat = "json" | "table";

/**
 * Formats an API response for terminal output.
 *  - "json": pretty-printed JSON (2-space indent).
 *  - "table": aligned columns of the top-level fields, flattened one level.
 *    For paginated list responses (an object with a `data` array), the rows
 *    are the array's items; otherwise the value itself (or its single object)
 *    is used as the row set.
 */
export function formatOutput(data: unknown, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return formatTable(data);
}

/** Formats a single value as one NDJSON line (used by `--page-all`). */
export function formatNdjsonLine(data: unknown): string {
  return JSON.stringify(data);
}

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map(toRow);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return obj.data.map(toRow);
    }
    return [toRow(obj)];
  }
  if (data === undefined || data === null) {
    return [];
  }
  return [{ value: data }];
}

function toRow(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function flattenCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    // Flatten one level: nested objects/arrays are shown as compact JSON
    // rather than being recursed into further columns.
    return JSON.stringify(value);
  }
  return String(value);
}

function formatTable(data: unknown): string {
  const rows = extractRows(data);
  if (rows.length === 0) {
    return "No results.";
  }

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  const cells = rows.map((row) => columns.map((col) => flattenCell(row[col])));

  const widths = columns.map((col, i) =>
    Math.max(col.length, ...cells.map((row) => row[i].length))
  );

  const headerLine = columns.map((col, i) => col.padEnd(widths[i])).join("  ");
  const dividerLine = widths.map((w) => "-".repeat(w)).join("  ");
  const bodyLines = cells.map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join("  "));

  return [headerLine, dividerLine, ...bodyLines].join("\n");
}
