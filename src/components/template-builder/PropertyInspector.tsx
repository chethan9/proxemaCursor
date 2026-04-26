import type { AnyBlock, TextBlock, HeadingBlock, ImageBlock, DividerBlock, SpacerBlock, ColumnsBlock, AddressBlock, OrderItemsTableBlock, TotalsBlock, BarcodeBlock, QrCodeBlock, SignatureLineBlock, HtmlBlock } from "@/lib/templates/document";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Props {
  block: AnyBlock;
  onChange: (updates: Partial<AnyBlock["props"]>) => void;
  onBack: () => void;
}

export function PropertyInspector({ block, onChange, onBack }: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /></Button>
        <div className="text-xs font-semibold capitalize">{block.type.replace(/_/g, " ")}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {renderFields(block, onChange)}
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function renderFields(block: AnyBlock, onChange: (u: Partial<AnyBlock["props"]>) => void) {
  switch (block.type) {
    case "text": return <TextFields b={block} onChange={onChange} />;
    case "heading": return <HeadingFields b={block} onChange={onChange} />;
    case "image": return <ImageFields b={block} onChange={onChange} />;
    case "divider": return <DividerFields b={block} onChange={onChange} />;
    case "spacer": return <SpacerFields b={block} onChange={onChange} />;
    case "columns": return <ColumnsFields b={block} onChange={onChange} />;
    case "address_block": return <AddressFields b={block} onChange={onChange} />;
    case "order_items_table": return <ItemsTableFields b={block} onChange={onChange} />;
    case "totals_block": return <TotalsFields b={block} onChange={onChange} />;
    case "barcode": return <BarcodeFields b={block} onChange={onChange} />;
    case "qr_code": return <QrFields b={block} onChange={onChange} />;
    case "signature_line": return <SignatureFields b={block} onChange={onChange} />;
    case "html": return <HtmlFields b={block} onChange={onChange} />;
    default: return <div className="text-xs text-muted-foreground">No properties</div>;
  }
}

type Setter = (u: Partial<AnyBlock["props"]>) => void;

function TextFields({ b, onChange }: { b: TextBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Text"><Textarea value={b.props.text} onChange={(e) => onChange({ text: e.target.value })} className="text-xs min-h-20" /></FieldRow>
      <FieldRow label="Align">
        <Select value={b.props.align ?? "left"} onValueChange={(v) => onChange({ align: v as "left" | "center" | "right" })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
        </Select>
      </FieldRow>
      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Size"><Input type="number" value={b.props.fontSize ?? 11} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} className="h-8 text-xs" /></FieldRow>
        <FieldRow label="Weight">
          <Select value={b.props.fontWeight ?? "normal"} onValueChange={(v) => onChange({ fontWeight: v as "normal" | "medium" | "semibold" | "bold" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="semibold">Semibold</SelectItem><SelectItem value="bold">Bold</SelectItem></SelectContent>
          </Select>
        </FieldRow>
      </div>
      <FieldRow label="Color"><Input type="color" value={b.props.color ?? "#0F172A"} onChange={(e) => onChange({ color: e.target.value })} className="h-8 p-1" /></FieldRow>
    </>
  );
}

function HeadingFields({ b, onChange }: { b: HeadingBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Text"><Input value={b.props.text} onChange={(e) => onChange({ text: e.target.value })} className="h-8 text-xs" /></FieldRow>
      <FieldRow label="Level">
        <Select value={String(b.props.level)} onValueChange={(v) => onChange({ level: Number(v) as 1 | 2 | 3 })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="1">H1 — Large</SelectItem><SelectItem value="2">H2 — Medium</SelectItem><SelectItem value="3">H3 — Small</SelectItem></SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Align">
        <Select value={b.props.align ?? "left"} onValueChange={(v) => onChange({ align: v as "left" | "center" | "right" })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Color"><Input type="color" value={b.props.color ?? "#0F172A"} onChange={(e) => onChange({ color: e.target.value })} className="h-8 p-1" /></FieldRow>
    </>
  );
}

function ImageFields({ b, onChange }: { b: ImageBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Image URL or variable"><Input value={b.props.src} onChange={(e) => onChange({ src: e.target.value })} placeholder="{{store.logo}}" className="h-8 text-xs" /></FieldRow>
      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Width"><Input type="number" value={b.props.width ?? ""} onChange={(e) => onChange({ width: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-xs" /></FieldRow>
        <FieldRow label="Height"><Input type="number" value={b.props.height ?? ""} onChange={(e) => onChange({ height: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-xs" /></FieldRow>
      </div>
      <FieldRow label="Align">
        <Select value={b.props.align ?? "left"} onValueChange={(v) => onChange({ align: v as "left" | "center" | "right" })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
        </Select>
      </FieldRow>
    </>
  );
}

function DividerFields({ b, onChange }: { b: DividerBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Color"><Input type="color" value={b.props.color ?? "#E2E8F0"} onChange={(e) => onChange({ color: e.target.value })} className="h-8 p-1" /></FieldRow>
      <FieldRow label="Thickness"><Input type="number" value={b.props.thickness ?? 1} onChange={(e) => onChange({ thickness: Number(e.target.value) })} className="h-8 text-xs" /></FieldRow>
    </>
  );
}

function SpacerFields({ b, onChange }: { b: SpacerBlock; onChange: Setter }) {
  return <FieldRow label="Height (px)"><Input type="number" value={b.props.height} onChange={(e) => onChange({ height: Number(e.target.value) })} className="h-8 text-xs" /></FieldRow>;
}

function ColumnsFields({ b, onChange }: { b: ColumnsBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Columns">
        <Select value={String(b.props.count)} onValueChange={(v) => {
          const n = Number(v) as 2 | 3;
          const cols = b.props.columns.slice(0, n);
          while (cols.length < n) cols.push([]);
          onChange({ count: n, columns: cols });
        }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="2">2 columns</SelectItem><SelectItem value="3">3 columns</SelectItem></SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Gap (px)"><Input type="number" value={b.props.gap ?? 16} onChange={(e) => onChange({ gap: Number(e.target.value) })} className="h-8 text-xs" /></FieldRow>
    </>
  );
}

function AddressFields({ b, onChange }: { b: AddressBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Source">
        <Select value={b.props.source} onValueChange={(v) => onChange({ source: v as "billing" | "shipping" })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="billing">Billing</SelectItem><SelectItem value="shipping">Shipping</SelectItem></SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Label"><Input value={b.props.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-xs" /></FieldRow>
      <ToggleRow label="Show name" v={b.props.showName !== false} onChange={(v) => onChange({ showName: v })} />
      <ToggleRow label="Show phone" v={!!b.props.showPhone} onChange={(v) => onChange({ showPhone: v })} />
    </>
  );
}

function ItemsTableFields({ b, onChange }: { b: OrderItemsTableBlock; onChange: Setter }) {
  return (
    <>
      <ToggleRow label="Show image" v={!!b.props.showImage} onChange={(v) => onChange({ showImage: v })} />
      <ToggleRow label="Show SKU" v={!!b.props.showSku} onChange={(v) => onChange({ showSku: v })} />
      <ToggleRow label="Show qty" v={!!b.props.showQty} onChange={(v) => onChange({ showQty: v })} />
      <ToggleRow label="Show price" v={!!b.props.showPrice} onChange={(v) => onChange({ showPrice: v })} />
      <ToggleRow label="Show total" v={!!b.props.showTotal} onChange={(v) => onChange({ showTotal: v })} />
      <FieldRow label="Header bg"><Input type="color" value={b.props.headerColor ?? "#F1F5F9"} onChange={(e) => onChange({ headerColor: e.target.value })} className="h-8 p-1" /></FieldRow>
    </>
  );
}

function TotalsFields({ b, onChange }: { b: TotalsBlock; onChange: Setter }) {
  return (
    <>
      <ToggleRow label="Subtotal" v={!!b.props.showSubtotal} onChange={(v) => onChange({ showSubtotal: v })} />
      <ToggleRow label="Shipping" v={!!b.props.showShipping} onChange={(v) => onChange({ showShipping: v })} />
      <ToggleRow label="Tax" v={!!b.props.showTax} onChange={(v) => onChange({ showTax: v })} />
      <ToggleRow label="Discount" v={!!b.props.showDiscount} onChange={(v) => onChange({ showDiscount: v })} />
      <ToggleRow label="Total" v={!!b.props.showTotal} onChange={(v) => onChange({ showTotal: v })} />
    </>
  );
}

function BarcodeFields({ b, onChange }: { b: BarcodeBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Source">
        <Select value={b.props.source} onValueChange={(v) => onChange({ source: v as "order_number" | "custom" })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="order_number">Order number</SelectItem><SelectItem value="custom">Custom value</SelectItem></SelectContent>
        </Select>
      </FieldRow>
      {b.props.source === "custom" && <FieldRow label="Value"><Input value={b.props.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} className="h-8 text-xs" /></FieldRow>}
    </>
  );
}

function QrFields({ b, onChange }: { b: QrCodeBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Value"><Input value={b.props.value} onChange={(e) => onChange({ value: e.target.value })} className="h-8 text-xs" /></FieldRow>
      <FieldRow label="Size (px)"><Input type="number" value={b.props.size ?? 80} onChange={(e) => onChange({ size: Number(e.target.value) })} className="h-8 text-xs" /></FieldRow>
    </>
  );
}

function SignatureFields({ b, onChange }: { b: SignatureLineBlock; onChange: Setter }) {
  return (
    <>
      <FieldRow label="Label"><Input value={b.props.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-xs" /></FieldRow>
      <FieldRow label="Width %"><Input type="number" value={b.props.widthPercent ?? 60} onChange={(e) => onChange({ widthPercent: Number(e.target.value) })} className="h-8 text-xs" /></FieldRow>
    </>
  );
}

function HtmlFields({ b, onChange }: { b: HtmlBlock; onChange: Setter }) {
  return <FieldRow label="Raw HTML"><Textarea value={b.props.html} onChange={(e) => onChange({ html: e.target.value })} className="text-xs font-mono min-h-32" /></FieldRow>;
}

function ToggleRow({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs font-normal">{label}</Label>
      <Switch checked={v} onCheckedChange={onChange} />
    </div>
  );
}