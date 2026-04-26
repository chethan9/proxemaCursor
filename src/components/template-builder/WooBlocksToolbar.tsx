import { Button } from "@/components/ui/button";
import { Package, Receipt, MapPin, Barcode as BarcodeIcon, QrCode } from "lucide-react";
import type { Editor } from "@tiptap/core";

interface Props {
  editor: Editor | null;
}

const INSERTS = [
  { type: "order_items_table", label: "Order Items", icon: Package, attrs: { showImage: true, showSku: true, showQty: true, showPrice: true, showTotal: true, headerColor: "#F8FAFC" } },
  { type: "totals_block", label: "Totals", icon: Receipt, attrs: { showSubtotal: true, showShipping: true, showTax: true, showDiscount: true, showTotal: true } },
  { type: "address_block", label: "Billing Address", icon: MapPin, attrs: { source: "billing", label: "Billing Address" } },
  { type: "address_block", label: "Shipping Address", icon: MapPin, attrs: { source: "shipping", label: "Shipping Address" } },
  { type: "barcode", label: "Barcode", icon: BarcodeIcon, attrs: { source: "order_number", value: "", format: "code128", width: 200, height: 60 } },
  { type: "qr_code", label: "QR Code", icon: QrCode, attrs: { value: "{{order.number}}", size: 120 } },
];

export function WooBlocksToolbar({ editor }: Props) {
  const insert = (type: string, attrs: Record<string, unknown>) => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type, attrs }).run();
  };

  return (
    <div className="border-b border-border bg-card px-3 py-2 flex items-center gap-2 flex-wrap shrink-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">WooCommerce blocks</span>
      {INSERTS.map((ins) => (
        <Button key={`${ins.type}-${ins.label}`} variant="outline" size="sm" className="h-7" onClick={() => insert(ins.type, ins.attrs)}>
          <ins.icon className="h-3.5 w-3.5 mr-1.5" />
          {ins.label}
        </Button>
      ))}
    </div>
  );
}