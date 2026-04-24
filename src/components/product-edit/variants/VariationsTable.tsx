import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit2, MoreVertical } from "lucide-react";
import { Variation } from "@/services/productEditService";
import { variationLabel } from "./utils";

type Props = {
  variations: Variation[];
  onEdit: (idx: number) => void;
  onUpdate: (idx: number, patch: Partial<Variation>) => void;
  onBulk: (patch: Partial<Variation>, onlySelected: boolean, selectedIds: Set<string>) => void;
};

export function VariationsTable({ variations, onEdit, onUpdate, onBulk }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState("");
  const [bulkMode, setBulkMode] = useState<null | "regular_price" | "sale_price" | "stock_quantity">(null);

  const toggleAll = () => {
    if (selected.size === variations.length) setSelected(new Set());
    else setSelected(new Set(variations.map((v) => v.key)));
  };
  const toggle = (k: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const applyBulk = () => {
    if (!bulkMode) return;
    const val = bulkValue.trim();
    if (!val && bulkMode !== "stock_quantity") return;
    const patch: Partial<Variation> = {};
    if (bulkMode === "regular_price") patch.regular_price = val;
    if (bulkMode === "sale_price") patch.sale_price = val;
    if (bulkMode === "stock_quantity") {
      patch.stock_quantity = val ? Number(val) : null;
      patch.manage_stock = true;
    }
    onBulk(patch, selected.size > 0, selected);
    setBulkMode(null);
    setBulkValue("");
  };

  const setAllEnabled = (enabled: boolean) => {
    onBulk({ enabled }, selected.size > 0, selected);
  };

  const cellInput = "h-9 border-0 bg-muted/40 rounded-md text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background placeholder:text-muted-foreground/50";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="rounded-full">
              <MoreVertical className="h-3.5 w-3.5 mr-1.5" />Bulk actions {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setBulkMode("regular_price")}>Set regular price</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkMode("sale_price")}>Set sale price</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkMode("stock_quantity")}>Set stock quantity</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAllEnabled(true)}>Enable all</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAllEnabled(false)}>Disable all</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {bulkMode && (
          <>
            <Input className="h-9 w-40" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder={bulkMode === "stock_quantity" ? "Qty" : "Price"} />
            <Button size="sm" type="button" onClick={applyBulk} className="bg-foreground text-background hover:bg-foreground/90 rounded-full">Apply {selected.size > 0 ? `to ${selected.size}` : "to all"}</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => { setBulkMode(null); setBulkValue(""); }}>Cancel</Button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-background">
        <div className="grid grid-cols-[32px_2fr_1.2fr_90px_90px_80px_32px] gap-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-3 py-3 border-b bg-muted/30 items-center">
          <Checkbox checked={selected.size === variations.length && variations.length > 0} onCheckedChange={toggleAll} />
          <div>Options</div>
          <div>SKU</div>
          <div>Price <span className="text-destructive">*</span></div>
          <div>Sale Price</div>
          <div>Stock</div>
          <div></div>
        </div>
        {variations.map((v, i) => {
          const isDisabled = v.enabled === false;
          const priceMissing = v.enabled !== false && (!v.regular_price || Number(v.regular_price) <= 0);
          return (
            <div key={v.key} className={`grid grid-cols-[32px_2fr_1.2fr_90px_90px_80px_32px] gap-3 items-center px-3 py-2.5 border-b last:border-b-0 text-sm hover:bg-muted/20 transition-colors ${isDisabled ? "opacity-50" : ""} ${priceMissing ? "bg-destructive/5" : ""}`}>
              <Checkbox checked={selected.has(v.key)} onCheckedChange={() => toggle(v.key)} />
              <div className="truncate flex items-center gap-2 font-medium">
                <span className="truncate">{variationLabel(v)}</span>
                {isDisabled && <span className="text-[9px] uppercase bg-muted rounded-full px-2 py-0.5 font-normal shrink-0">off</span>}
                {priceMissing && <span className="text-[9px] uppercase bg-destructive/10 text-destructive rounded-full px-2 py-0.5 font-medium shrink-0">no price</span>}
              </div>
              <Input className={cellInput} value={v.sku} onChange={(e) => onUpdate(i, { sku: e.target.value })} placeholder="—" />
              <Input className={`${cellInput} ${priceMissing ? "ring-1 ring-destructive/30" : ""}`} value={v.regular_price} onChange={(e) => onUpdate(i, { regular_price: e.target.value })} placeholder="—" />
              <Input className={cellInput} value={v.sale_price} onChange={(e) => onUpdate(i, { sale_price: e.target.value })} placeholder="—" />
              <Input
                className={`${cellInput} ${!v.manage_stock ? "bg-muted/30 text-muted-foreground cursor-not-allowed" : ""}`}
                type="number"
                min="0"
                value={v.manage_stock ? (v.stock_quantity ?? "") : ""}
                disabled={!v.manage_stock}
                title={!v.manage_stock ? "Enable Manage Stock to set quantity" : undefined}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") { onUpdate(i, { stock_quantity: null }); return; }
                  const n = Number(raw);
                  if (Number.isNaN(n)) return;
                  const qty = Math.max(0, n);
                  const nextStatus: Variation["stock_status"] = qty === 0 ? "outofstock" : (v.stock_status === "onbackorder" ? "onbackorder" : "instock");
                  onUpdate(i, { stock_quantity: qty, manage_stock: true, stock_status: nextStatus });
                }}
                placeholder="—"
              />
              <button type="button" onClick={() => onEdit(i)} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}