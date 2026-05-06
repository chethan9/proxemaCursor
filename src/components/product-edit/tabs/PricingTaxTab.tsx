import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductFormState } from "@/services/productEditService";

type Props = {
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

function clampNonNegative(v: string): string {
  if (v === "" || v === "-") return "";
  const n = parseFloat(v);
  if (Number.isNaN(n)) return v;
  return n < 0 ? "0" : v;
}

export function PricingTaxTab({ form, setForm }: Props) {
  const reg = parseFloat(String(form.regular_price ?? "").trim() || "0");
  const sale = parseFloat(String(form.sale_price ?? "").trim() || "0");
  const invalidOffer = reg > 0 && sale > 0 && sale >= reg;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="text-sm font-medium text-primary mb-2">Price</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs" required>Regular Price</Label>
            <Input type="number" min="0.01" step="0.01" value={form.regular_price} onChange={(e) => setForm((p) => ({ ...p, regular_price: clampNonNegative(e.target.value) }))} />
            {form.regular_price !== "" && (parseFloat(form.regular_price) || 0) <= 0 && (
              <div className="text-[11px] text-destructive">Must be greater than 0.</div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Offer Price</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sale_price}
                  onChange={(e) => setForm((p) => ({ ...p, sale_price: clampNonNegative(e.target.value) }))}
                  aria-invalid={invalidOffer}
                  title={invalidOffer ? "Sale price must be lower than regular price." : undefined}
                  className={invalidOffer ? "border-destructive ring-1 ring-destructive/30" : ""}
                />
              </TooltipTrigger>
              {invalidOffer && (
                <TooltipContent side="top" className="max-w-[260px]">
                  Sale price must be lower than regular price.
                </TooltipContent>
              )}
            </Tooltip>
            {invalidOffer && <div className="text-[11px] text-destructive">Sale price must be lower than regular price.</div>}
          </div>
        </div>
        <div className="space-y-3 border-t border-border/70 pt-3">
          <div className="text-sm font-medium text-primary">Tax</div>
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
    </TooltipProvider>
  );
}