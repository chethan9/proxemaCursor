import { ReactNode, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
import { LivePreviewCard } from "@/components/product-edit/LivePreviewCard";
import { isTabDirty } from "@/lib/product-edit/tab-slices";
import { Eye, PanelRightOpen, Package, CircleDollarSign, Truck, Boxes } from "lucide-react";

export type AdvancedTabKey = "basic" | "pricing" | "inventory" | "variants";

const SECTIONS: { key: AdvancedTabKey; label: string }[] = [
  { key: "basic", label: "Basics" },
  { key: "pricing", label: "Pricing & tax" },
  { key: "inventory", label: "Inventory & shipping" },
  { key: "variants", label: "Variants" },
];

const SECTION_ICON: Record<AdvancedTabKey, typeof Package> = {
  basic: Package,
  pricing: CircleDollarSign,
  inventory: Truck,
  variants: Boxes,
};

const PREVIEW_OPEN_KEY = "product-edit-live-preview-open";

type Props = {
  form: ProductFormState;
  /** Snapshot when the editor opened (or last explicit reset). Section chrome stays neutral until a section differs from this. */
  baselineForm: ProductFormState | null;
  setForm?: (updater: (prev: ProductFormState) => ProductFormState) => void;
  tabContent: Record<AdvancedTabKey, ReactNode>;
  canAdvance: (tab: AdvancedTabKey) => boolean;
  onCancel: () => void;
  storeId: string;
  productId?: string | null;
};

export function AdvancedShell({ form, baselineForm, setForm, tabContent, canAdvance, onCancel, storeId, productId }: Props) {
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
        previewOpen && "lg:grid-cols-[1fr_minmax(240px,304px)]",
      )}
    >
      <Card className="overflow-visible min-w-0 border-0 bg-transparent shadow-none">
        <CardContent className="p-0 pb-4">
          <div className="space-y-4 p-1 sm:p-2">
            {SECTIONS.filter((section) => form.type === "variable" || section.key !== "variants").map((section) => {
              const dirty = baselineForm ? isTabDirty(baselineForm, form, section.key) : false;
              const complete = canAdvance(section.key);
              const incomplete = dirty && !complete;
              const Icon = SECTION_ICON[section.key];
              return (
                <section
                  key={section.key}
                  className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"
                >
                  <div className="flex items-center justify-between border-b bg-background px-4 py-3 sm:px-5">
                    <span className="flex min-w-0 items-center gap-2.5 text-left">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-semibold tracking-tight">{section.label}</span>
                      {dirty && complete && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                          title="Unsaved changes in this section"
                          aria-hidden
                        />
                      )}
                      {incomplete && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0"
                          title="Required fields incomplete"
                          aria-hidden
                        />
                      )}
                    </span>
                  </div>
                  <div className="px-4 py-5 text-foreground sm:px-5 sm:py-6">{tabContent[section.key]}</div>
                </section>
              );
            })}
          </div>

          <div className="flex items-center justify-start border-t px-4 sm:px-5 py-3">
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

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
