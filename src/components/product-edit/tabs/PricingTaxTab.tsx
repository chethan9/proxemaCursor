import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div>
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
        <p className="text-[11px] text-muted-foreground mt-2">Tax settings have moved to the Inventory & Shipping step.</p>
      </div>
    </div>
    </TooltipProvider>
  );
}