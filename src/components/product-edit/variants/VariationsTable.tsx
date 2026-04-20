import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
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
    setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <MoreVertical className="h-3.5 w-3.5 mr-1" />Bulk actions {selected.size > 0 ? `(${selected.size})` : ""}
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
            <Input className="h-8 w-40" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder={bulkMode === "stock_quantity" ? "Qty" : "Price"} />
            <Button size="sm" type="button" onClick={applyBulk} className="bg-foreground text-background hover:bg-foreground/90">Apply {selected.size > 0 ? `to ${selected.size}` : "to all"}</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => { setBulkMode(null); setBulkValue(""); }}>Cancel</Button>
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[32px_1fr_120px_110px_90px_48px] gap-0 text-xs text-muted-foreground px-4 py-2 border-b bg-muted/30 items-center">
            <Checkbox checked={selected.size === variations.length && variations.length > 0} onCheckedChange={toggleAll} />
            <div>Options</div>
            <div>SKU</div>
            <div>Price</div>
            <div>Stock</div>
            <div></div>
          </div>
          {variations.map((v, i) => {
            const isDisabled = v.enabled === false;
            return (
              <div key={v.key} className={`grid grid-cols-[32px_1fr_120px_110px_90px_48px] gap-0 items-center px-4 py-2 border-b last:border-b-0 text-sm ${isDisabled ? "opacity-50" : ""}`}>
                <Checkbox checked={selected.has(v.key)} onCheckedChange={() => toggle(v.key)} />
                <div className="truncate flex items-center gap-2">
                  <span>{variationLabel(v)}</span>
                  {isDisabled && <span className="text-[10px] uppercase bg-muted rounded px-1.5 py-0.5">disabled</span>}
                </div>
                <Input className="h-8" value={v.sku} onChange={(e) => onUpdate(i, { sku: e.target.value })} placeholder="—" />
                <Input className="h-8" value={v.regular_price} onChange={(e) => onUpdate(i, { regular_price: e.target.value })} placeholder="0.00" />
                <Input className="h-8" type="number" value={v.stock_quantity ?? ""} onChange={(e) => onUpdate(i, { stock_quantity: e.target.value ? Number(e.target.value) : null, manage_stock: true })} placeholder="—" />
                <button type="button" onClick={() => onEdit(i)} className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}