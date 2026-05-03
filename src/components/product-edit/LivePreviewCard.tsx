import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageIcon, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductFormState, ProductAttribute } from "@/services/productEditService";
import { resolveMirroredProductImageUrl, type ImageVariantName } from "@/lib/product-image-urls";
import { AIProductImageAssistant } from "@/components/product-edit/ai/AIProductImageAssistant";

const MAX_PREVIEW_ATTRS = 4;

export type LivePreviewCardProps = {
  form: ProductFormState;
  storeId?: string;
  productId?: string | null;
  setForm?: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

export function LivePreviewCard({ form, storeId, productId, setForm }: LivePreviewCardProps) {
  const mirrorMap = form.image_mirror_urls;
  const previewSrc = (rawSrc: string, variant: ImageVariantName) =>
    resolveMirroredProductImageUrl(rawSrc, mirrorMap, variant) || rawSrc;

  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const images = form.images;
  const count = images.length;

  useEffect(() => {
    if (activeIdx >= count && count > 0) setActiveIdx(0);
    if (count === 0 && activeIdx !== 0) setActiveIdx(0);
  }, [count, activeIdx]);

  useEffect(() => {
    const btn = thumbRefs.current[activeIdx];
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeIdx]);

  const prev = () => setActiveIdx((i) => (i - 1 + count) % count);
  const next = () => setActiveIdx((i) => (i + 1) % count);

  const active = images[activeIdx];
  const hasOffer = form.sale_price && Number(form.sale_price) > 0 && Number(form.sale_price) < Number(form.regular_price || 0);
  const discountPct = hasOffer ? Math.round((1 - Number(form.sale_price) / Number(form.regular_price)) * 100) : 0;

  const visibleAttrs: ProductAttribute[] = form.attributes.filter(
    (a) => a.visible !== false && a.name.trim().length > 0 && a.options.length > 0
  );
  const shownAttrs = visibleAttrs.slice(0, MAX_PREVIEW_ATTRS);
  const overflowCount = visibleAttrs.length - shownAttrs.length;

  const onKey = (e: React.KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  };

  const showAi = !!storeId && !!setForm;

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground">Live preview</div>
            {showAi && (
              <AIProductImageAssistant storeId={storeId} productId={productId ?? undefined} form={form} setForm={setForm} />
            )}
          </div>
          <div
            className="aspect-square rounded-lg bg-muted/50 overflow-hidden flex items-center justify-center relative group outline-none"
            tabIndex={0}
            onKeyDown={onKey}
          >
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc(active.src, "edit")} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            )}

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/95 border border-border shadow-md hover:bg-background hover:scale-105 flex items-center justify-center transition-all z-10"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/95 border border-border shadow-md hover:bg-background hover:scale-105 flex items-center justify-center transition-all z-10"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
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
            <div className="relative">
              <div
                ref={thumbStripRef}
                className="flex gap-1.5 overflow-x-auto px-2.5 pt-2.5 pb-2.5 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
              >
                {images.map((img, i) => (
                  <button
                    key={img.id ?? `${img.src}-${i}`}
                    ref={(el) => { thumbRefs.current[i] = el; }}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`h-14 w-14 rounded-md overflow-hidden shrink-0 snap-start border transition-all ${i === activeIdx ? "ring-2 ring-primary ring-offset-2 border-transparent" : "border-border hover:border-primary/40"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewSrc(img.src, "thumb")} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              {count > 5 && (
                <div className="pointer-events-none absolute top-2 bottom-2 right-0 w-6 bg-gradient-to-l from-card to-transparent rounded-r" />
              )}
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

          {shownAttrs.map((attr) => (
            <div key={attr.name}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{attr.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {attr.options.map((o) => (
                  <div key={o} className="text-xs px-2 py-1 rounded border border-border">{o}</div>
                ))}
              </div>
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="text-[10px] text-muted-foreground">+{overflowCount} more attribute{overflowCount === 1 ? "" : "s"}</div>
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
                <img src={previewSrc(active.src, "zoom")} alt="" className="max-h-full max-w-full object-contain" />
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
                    <img src={previewSrc(img.src, "thumb")} alt="" className="h-full w-full object-cover" />
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