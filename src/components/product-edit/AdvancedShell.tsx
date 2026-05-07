import { ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
import { LivePreviewCard } from "@/components/product-edit/LivePreviewCard";
import { Eye, PanelRightOpen, Trash2 } from "lucide-react";

export type AdvancedTabKey = "basic" | "pricing" | "inventory" | "variants";

const SECTIONS: { key: AdvancedTabKey; label: string }[] = [
  { key: "basic", label: "Basics" },
  { key: "pricing", label: "Pricing & tax" },
  { key: "inventory", label: "Inventory & shipping" },
  { key: "variants", label: "Variants" },
];

const PREVIEW_OPEN_KEY = "product-edit-live-preview-open";

type Props = {
  form: ProductFormState;
  /** Snapshot when the editor opened (or last explicit reset). Section chrome stays neutral until a section differs from this. */
  baselineForm: ProductFormState | null;
  setForm?: (updater: (prev: ProductFormState) => ProductFormState) => void;
  tabContent: Record<AdvancedTabKey, ReactNode>;
  canAdvance: (tab: AdvancedTabKey) => boolean;
  /** Leave editor without saving (new product draft only). */
  onCancel?: () => void;
  /** Open delete confirmation (edit existing product only). */
  onRequestDelete?: () => void;
  storeId: string;
  productId?: string | null;
};

export function AdvancedShell({
  form,
  baselineForm: _baselineForm,
  setForm,
  tabContent,
  canAdvance: _canAdvance,
  onCancel,
  onRequestDelete,
  storeId,
  productId,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(PREVIEW_OPEN_KEY) === "0") setPreviewOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  const persistPreviewOpen = (open: boolean) => {
    setPreviewOpen(open);
    try {
      localStorage.setItem(PREVIEW_OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <>
    <div
      className={cn(
        "relative grid grid-cols-1 gap-5 w-full lg:items-start",
        previewOpen && "lg:grid-cols-[1fr_minmax(260px,360px)]",
      )}
    >
      <div className="min-w-0 overflow-visible pb-4">
        <div className="flex flex-col gap-3">
          {SECTIONS.filter((section) => form.type === "variable" || section.key !== "variants").map((section) => (
            <section
              key={section.key}
              id={`product-edit-section-${section.key}`}
              className={cn(
                section.key === "basic" || section.key === "variants"
                  ? "overflow-visible border-0 bg-transparent p-0 shadow-none text-foreground"
                  : "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-polaris-sm",
              )}
            >
              <div
                className={cn(
                  "text-foreground",
                  section.key === "basic" || section.key === "variants"
                    ? "p-0"
                    : "px-4 py-5 sm:px-5 sm:py-6",
                )}
              >
                {tabContent[section.key]}
              </div>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-start border-t border-border/80 px-0 py-3 sm:py-4">
          {productId && onRequestDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRequestDelete}
              className="-ml-2 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5 opacity-70" aria-hidden />
              Delete product
            </Button>
          ) : onCancel ? (
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground -ml-2">
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {previewOpen && (
        <div className="min-w-0 lg:sticky lg:top-4 h-fit lg:self-start space-y-2 lg:pb-24">
          <LivePreviewCard
            form={form}
            storeId={storeId}
            productId={productId}
            setForm={setForm}
            onHidePreview={() => persistPreviewOpen(false)}
          />
        </div>
      )}
    </div>

    {!previewOpen && (
      <Button
        type="button"
        variant="outline"
        className="fixed right-3 top-1/2 z-[85] h-14 w-14 -translate-y-1/2 overflow-hidden rounded-full border-border/70 bg-background/95 p-0 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90 hover:scale-[1.02] hover:bg-accent"
        onClick={() => persistPreviewOpen(true)}
        title="Show live preview"
        aria-label="Show live preview"
      >
        {form.images[0]?.src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.images[0].src} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-black/35" aria-hidden />
            <span className="absolute bottom-0.5 right-0.5 rounded-full bg-background/95 p-1 shadow-sm">
              <PanelRightOpen className="h-3 w-3 text-foreground" />
            </span>
          </>
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-muted/40">
            <Eye className="h-5 w-5 text-muted-foreground" />
          </span>
        )}
      </Button>
    )}
    </>
  );
}
