import React from "react";
import ExcelJS from "exceljs";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProductExportPdfDocument } from "@/components/export/ProductExportPdfDocument";

function escapeCsvCell(v: string): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function encodeProductExportCsv(headers: string[], rows: string[][]): Buffer {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((r) => r.map((c) => escapeCsvCell(String(c))).join(","));
  const csv = `\uFEFF${headerLine}\r\n${bodyLines.join("\r\n")}`;
  return Buffer.from(csv, "utf-8");
}

export async function encodeProductExportXlsx(headers: string[], rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

export async function encodeProductExportPdf(headers: string[], rows: string[][]): Promise<Buffer> {
  const element = React.createElement(ProductExportPdfDocument, { headers, rows });
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}
