import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageIcon, ChevronLeft, ChevronRight, Maximize2, PanelRightClose, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductFormState, ProductAttribute } from "@/services/productEditService";
import { resolveMirroredProductImageUrl, type ImageVariantName } from "@/lib/product-image-urls";
import { AIProductImageAssistant } from "@/components/product-edit/ai/AIProductImageAssistant";
import { cn } from "@/lib/utils";

const MAX_PREVIEW_ATTRS = 4;

export type LivePreviewCardProps = {
  form: ProductFormState;
  storeId?: string;
  productId?: string | null;
  setForm?: (updater: (prev: ProductFormState) => ProductFormState) => void;
  onHidePreview?: () => void;
};

export function LivePreviewCard({ form, storeId, productId, setForm, onHidePreview }: LivePreviewCardProps) {
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
        <CardContent className="space-y-3 p-4">
          <div
            className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted/40 outline-none dark:bg-muted/25"
            tabIndex={0}
            onKeyDown={onKey}
          >
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc(active.src, "edit")} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}

            {/* Toolbar on image — saves vertical space vs a separate header row */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2">
              {(onHidePreview || showAi) && (
                <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/25 bg-black/45 p-1 shadow-lg backdrop-blur-sm">
                  {onHidePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onHidePreview}
                      className="h-7 w-7 shrink-0 rounded-md p-0 text-white hover:bg-white/15 hover:text-white"
                      title="Hide preview"
                      aria-label="Hide preview"
                    >
                      <PanelRightClose className="h-3.5 w-3.5 text-white" />
                    </Button>
                  )}
                  {showAi && (
                    <AIProductImageAssistant
                      storeId={storeId}
                      productId={productId ?? undefined}
                      form={form}
                      setForm={setForm}
                      tone="overlay"
                      label="AI image"
                      triggerIcon="wand"
                    />
                  )}
                </div>
              )}
              {count > 1 && (
                <div className="pointer-events-none rounded-full border border-white/25 bg-black/70 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white shadow-md backdrop-blur-md">
                  {activeIdx + 1}/{count}
                </div>
              )}
            </div>

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105"
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
                className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white opacity-0 shadow-md backdrop-blur-sm transition-colors hover:bg-black/70 group-hover:opacity-100"
                aria-label="Enlarge preview"
                title="Enlarge preview"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
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
                    className={`h-14 w-14 rounded-md overflow-hidden shrink-0 snap-start border bg-muted/90 transition-all ring-offset-0 ${i === activeIdx ? "ring-2 ring-primary border-primary/40" : "border-border hover:border-primary/40"}`}
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
              <div className="font-semibold text-sm">
                {form.manage_stock === true && form.stock_quantity != null ? form.stock_quantity : "—"}
              </div>
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
          showClose={false}
          overlayClassName="z-[100]"
          className={cn(
            /* Override dialog defaults: grid + gap breaks flex layout and clips thumbs */
            "!flex !flex-col !gap-0 overflow-hidden border-neutral-800 bg-neutral-950 p-0 shadow-2xl sm:rounded-lg",
            "fixed left-1/2 top-1/2 z-[101] h-[min(92dvh,880px)] max-h-[92dvh] w-[min(96vw,1200px)] max-w-[96vw] -translate-x-1/2 -translate-y-1/2",
          )}
          onKeyDown={onKey}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex min-h-0 flex-1 flex-col">
            {/* Image stage only — nav overlay height excludes thumb strip so arrows stay aligned */}
            <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
              <div className="absolute inset-0 flex items-center justify-center p-2 pb-2 pt-14 sm:p-4 sm:pt-14">
                {active && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSrc(active.src, "zoom")}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    draggable={false}
                  />
                )}
              </div>

              {count > 1 && (
                <>
                  <div className="pointer-events-none absolute left-3 top-14 z-20 rounded-md bg-black/55 px-2 py-1 text-sm tabular-nums text-white/95 ring-1 ring-white/15 backdrop-blur-sm sm:left-4">
                    {activeIdx + 1} / {count}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 top-14 z-20 flex items-center justify-between px-2 sm:px-4">
                    <button
                      type="button"
                      onClick={prev}
                      className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/70 sm:h-12 sm:w-12"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/70 sm:h-12 sm:w-12"
                      aria-label="Next"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {count > 1 && (
              <div className="shrink-0 border-t border-white/10 bg-black/70 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex max-w-full justify-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                  {images.map((img, i) => (
                    <button
                      key={img.id ?? `lb-${img.src}-${i}`}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={cn(
                        "h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all sm:h-[4.5rem] sm:w-[4.5rem]",
                        i === activeIdx ? "border-white ring-2 ring-white/30" : "border-transparent opacity-65 hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewSrc(img.src, "thumb")} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}