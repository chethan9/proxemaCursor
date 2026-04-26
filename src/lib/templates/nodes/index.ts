import type { Extensions } from "@tiptap/core";
import { OrderItemsTable } from "./order-items-table";
import { TotalsBlock } from "./totals-block";
import { AddressBlock } from "./address-block";
import { Barcode } from "./barcode";
import { QrCode } from "./qr-code";
import { SignatureLine } from "./signature-line";
import { PageBreak } from "./page-break";

export { OrderItemsTable, TotalsBlock, AddressBlock, Barcode, QrCode, SignatureLine, PageBreak };

export function wooExtensions(): Extensions {
  return [OrderItemsTable, TotalsBlock, AddressBlock, Barcode, QrCode, SignatureLine, PageBreak] as Extensions;
}