import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const setQty = (raw: string) => {
    setForm((p) => {
      const qty = clampNonNegNum(raw);
      if (qty == null) return { ...p, stock_quantity: null };
      const nextStatus: typeof p.stock_status = qty === 0 ? "outofstock" : (p.stock_status === "onbackorder" ? "onbackorder" : "instock");
      return { ...p, stock_quantity: qty, manage_stock: true, stock_status: nextStatus };
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-medium text-primary mb-2">Inventory</div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs" required>SKU</Label>
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
              <Label className="text-xs" required>Quantity</Label>
              <Input type="number" min="0" value={form.stock_quantity ?? ""} onChange={(e) => setQty(e.target.value)} />
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

      <div>
        <div className="text-sm font-medium text-primary mb-2">Tax</div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.tax_status === "taxable"} onCheckedChange={(v) => setForm((p) => ({ ...p, tax_status: v ? "taxable" : "none" }))} />
            Charge tax on this product
          </label>
          {form.tax_status === "taxable" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Class</Label>
                <Select value={form.tax_class || "standard"} onValueChange={(v) => setForm((p) => ({ ...p, tax_class: v === "standard" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="reduced-rate">Reduced rate</SelectItem>
                    <SelectItem value="zero-rate">Zero rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}