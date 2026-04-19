import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import { ProductFormState } from "@/services/productEditService";

export function LivePreviewCard({ form }: { form: ProductFormState }) {
  const main = form.images[0];
  const hasOffer = form.sale_price && Number(form.sale_price) > 0 && Number(form.sale_price) < Number(form.regular_price || 0);
  const discountPct = hasOffer ? Math.round((1 - Number(form.sale_price) / Number(form.regular_price)) * 100) : 0;

  const sizeAttr = form.attributes.find((a) => a.name.toLowerCase() === "size");
  const colorAttr = form.attributes.find((a) => a.name.toLowerCase() === "color");

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="aspect-square rounded-lg bg-muted/50 overflow-hidden flex items-center justify-center">
          {main ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          )}
        </div>
        <div>
          <div className="font-semibold text-base truncate">{form.name || "Product name"}</div>
          {form.short_description && (
            <div className="text-xs text-muted-foreground line-clamp-3 mt-0.5">{form.short_description}</div>
          )}
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold">{hasOffer ? form.sale_price : form.regular_price || "0.00"} KD</span>
          {hasOffer && (
            <>
              <span className="text-xs text-muted-foreground line-through">{form.regular_price} KD</span>
              <span className="text-[10px] font-medium bg-success/10 text-success px-1.5 py-0.5 rounded">{discountPct}% Off</span>
            </>
          )}
        </div>
        {sizeAttr && sizeAttr.options.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Size</div>
            <div className="flex flex-wrap gap-1.5">
              {sizeAttr.options.map((o) => (
                <div key={o} className="text-xs px-2 py-1 rounded border border-border">{o}</div>
              ))}
            </div>
          </div>
        )}
        {colorAttr && colorAttr.options.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Color</div>
            <div className="flex flex-wrap gap-1.5">
              {colorAttr.options.map((o) => (
                <div key={o} className="text-xs px-2 py-1 rounded border border-border">{o}</div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Stock</div>
            <div className="font-semibold text-sm">{form.stock_quantity ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Weight</div>
            <div className="font-semibold text-sm">{form.weight || "—"} {form.weight ? "kg" : ""}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">SKU</div>
            <div className="font-mono text-xs truncate">{form.sku || "—"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}