export interface CsvColumn<T> {
  key: string;
  label: string;
  accessor: (row: T) => unknown;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename?: string
): void {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.accessor(row))).join(","))
    .join("\r\n");
  const csv = `\uFEFF${header}\r\n${body}`;

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = filename || `export-${ts}.csv`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name.endsWith(".csv") ? name : `${name}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}