import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";

type Props = {
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

function clampNonNegNum(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.max(0, n);
}
function clampNonNegStr(v: string): string {
  if (v === "" || v === "-") return "";
  const n = parseFloat(v);
  if (Number.isNaN(n)) return v;
  return n < 0 ? "0" : v;
}

const STOCK_STATUSES: { value: ProductFormState["stock_status"]; label: string }[] = [
  { value: "instock", label: "In Stock" },
  { value: "outofstock", label: "Out Of Stock" },
  { value: "onbackorder", label: "On Backorder" },
];

export function InventoryShippingTab({ form, setForm }: Props) {
  const autoSku = () => {
    const base = (form.name || "SKU").slice(0, 3).toUpperCase().replace(/\s/g, "");
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    setForm((p) => ({ ...p, sku: `${base}${rand}` }));
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-medium text-primary mb-2">Inventory</div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">SKU</Label>
            <div className="flex gap-2">
              <Input value={form.sku || ""} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
              <Button type="button" variant="outline" onClick={autoSku} className="gap-1.5 shrink-0">
                <Sparkles className="h-3.5 w-3.5" />Auto SKU
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.manage_stock} onCheckedChange={(v) => setForm((p) => ({ ...p, manage_stock: !!v }))} />
            Track stock quantity for this product
          </label>
          {form.manage_stock && (
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min="0" value={form.stock_quantity ?? ""} onChange={(e) => setForm((p) => ({ ...p, stock_quantity: clampNonNegNum(e.target.value) }))} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Stock Status</Label>
            <div className="flex flex-wrap gap-2">
              {STOCK_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, stock_status: s.value }))}
                  className={cn(
                    "px-4 py-2 text-xs rounded-md border transition-colors",
                    form.stock_status === s.value ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.sold_individually} onCheckedChange={(v) => setForm((p) => ({ ...p, sold_individually: !!v }))} />
            Limit purchases to 1 item per order
          </label>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-primary mb-2">Shipping</div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Weight <span className="text-muted-foreground">(kg)</span></Label>
            <Input type="number" min="0" step="0.01" value={form.weight} onChange={(e) => setForm((p) => ({ ...p, weight: clampNonNegStr(e.target.value) }))} placeholder="0.000" />
          </div>
          <div>
            <Label className="text-xs">Dimensions <span className="text-muted-foreground">(cm)</span></Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <Input type="number" min="0" step="0.01" placeholder="Length" value={form.dimensions.length} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, length: clampNonNegStr(e.target.value) } }))} />
              <Input type="number" min="0" step="0.01" placeholder="Width" value={form.dimensions.width} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, width: clampNonNegStr(e.target.value) } }))} />
              <Input type="number" min="0" step="0.01" placeholder="Height" value={form.dimensions.height} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, height: clampNonNegStr(e.target.value) } }))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}