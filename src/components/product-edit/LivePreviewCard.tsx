import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageIcon, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductFormState } from "@/services/productEditService";

export function LivePreviewCard({ form }: { form: ProductFormState }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const images = form.images;
  const count = images.length;

  useEffect(() => {
    if (activeIdx >= count && count > 0) setActiveIdx(0);
    if (count === 0 && activeIdx !== 0) setActiveIdx(0);
  }, [count, activeIdx]);

  const prev = () => setActiveIdx((i) => (i - 1 + count) % count);
  const next = () => setActiveIdx((i) => (i + 1) % count);

  const active = images[activeIdx];
  const hasOffer = form.sale_price && Number(form.sale_price) > 0 && Number(form.sale_price) < Number(form.regular_price || 0);
  const discountPct = hasOffer ? Math.round((1 - Number(form.sale_price) / Number(form.regular_price)) * 100) : 0;

  const sizeAttr = form.attributes.find((a) => a.name.toLowerCase() === "size");
  const colorAttr = form.attributes.find((a) => a.name.toLowerCase() === "color");

  const onKey = (e: React.KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            className="aspect-square rounded-lg bg-muted/50 overflow-hidden flex items-center justify-center relative group outline-none"
            tabIndex={0}
            onKeyDown={onKey}
          >
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.src} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            )}

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/90 border border-border shadow hover:bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/90 border border-border shadow hover:bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {count > 0 && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute bottom-2 left-2 h-8 w-8 rounded-full bg-background/90 border border-border shadow hover:bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Click to enlarge"
                title="Click to enlarge"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}

            {count > 1 && (
              <div className="absolute top-2 right-2 text-[10px] font-medium bg-background/90 border border-border rounded px-1.5 py-0.5 tabular-nums">
                {activeIdx + 1}/{count}
              </div>
            )}
          </div>

          {count > 1 && (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id ?? `${img.src}-${i}`}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`h-14 w-14 rounded-md overflow-hidden shrink-0 border transition-all ${i === activeIdx ? "ring-2 ring-primary ring-offset-1 border-transparent" : "border-border hover:border-primary/40"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="font-semibold text-base truncate">{form.name || "Product name"}</div>
            {form.short_description && (
              <div
                className="text-xs text-muted-foreground line-clamp-3 mt-0.5 [&_p]:m-0"
                dangerouslySetInnerHTML={{ __html: form.short_description }}
              />
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

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[95vw] w-[95vw] h-[92vh] p-0 bg-black/95 border-neutral-800 [&>button]:hidden"
          onKeyDown={onKey}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-col h-full">
            <div className="flex-1 relative flex items-center justify-center min-h-0">
              {active && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.src} alt="" className="max-h-full max-w-full object-contain" />
              )}
              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <div className="absolute top-4 left-4 text-white/80 text-sm tabular-nums bg-white/10 rounded px-2 py-1">
                    {activeIdx + 1} / {count}
                  </div>
                </>
              )}
            </div>
            {count > 1 && (
              <div className="p-4 flex gap-2 justify-center overflow-x-auto bg-black/50">
                {images.map((img, i) => (
                  <button
                    key={img.id ?? `lb-${img.src}-${i}`}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`h-20 w-20 rounded overflow-hidden shrink-0 border-2 transition-all ${i === activeIdx ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}