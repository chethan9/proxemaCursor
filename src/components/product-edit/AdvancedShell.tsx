import { ReactNode, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
import { validateProductForm } from "@/services/productValidation";
import { LivePreviewCard } from "@/components/product-edit/LivePreviewCard";
import { isTabDirty } from "@/lib/product-edit/tab-slices";
import { Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type AdvancedTabKey = "basic" | "pricing" | "inventory" | "variants";

const SECTIONS: { key: AdvancedTabKey; label: string }[] = [
  { key: "basic", label: "Basics" },
  { key: "pricing", label: "Pricing & tax" },
  { key: "inventory", label: "Inventory & shipping" },
  { key: "variants", label: "Variants" },
];

type Props = {
  form: ProductFormState;
  /** Snapshot when the editor opened (or last explicit reset). Section chrome stays neutral until a section differs from this. */
  baselineForm: ProductFormState | null;
  setForm?: (updater: (prev: ProductFormState) => ProductFormState) => void;
  tabContent: Record<AdvancedTabKey, ReactNode>;
  canAdvance: (tab: AdvancedTabKey) => boolean;
  onCancel: () => void;
  onPublish: () => void;
  saving: boolean;
  isEdit: boolean;
  storeId: string;
  productId?: string | null;
};

export function AdvancedShell({ form, baselineForm, setForm, tabContent, canAdvance, onCancel, onPublish, saving, isEdit, storeId, productId }: Props) {
  const [errors, setErrors] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(() =>
    form.type === "variable" ? ["basic", "variants"] : ["basic"],
  );

  const validation = useMemo(() => validateProductForm(form), [form]);
  const saveBlocked = !validation.ok;
  const publishing = form.status === "publish";

  useEffect(() => {
    if (form.type !== "variable") {
      setOpenSections((prev) => prev.filter((k) => k !== "variants"));
    }
  }, [form.type]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <Card className="overflow-visible">
        <CardContent className="p-0 pb-28">
          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="w-full">
            {SECTIONS.map((section) => {
              const dirty = baselineForm ? isTabDirty(baselineForm, form, section.key) : false;
              const complete = canAdvance(section.key);
              const incomplete = dirty && !complete;
              return (
                <AccordionItem key={section.key} value={section.key} className="border-b px-0">
                  <AccordionTrigger className="px-4 sm:px-5 py-3.5 hover:no-underline">
                    <span className="flex items-center gap-2 text-left">
                      <span className="text-sm font-medium">{section.label}</span>
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
                  </AccordionTrigger>
                  <AccordionContent className="px-4 sm:px-5 text-foreground">
                    <div className="pb-2">{tabContent[section.key]}</div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {errors && <div className="text-sm text-destructive px-4 sm:px-5 pt-2">{errors}</div>}

          <div className="flex items-center justify-between border-t px-4 sm:px-5 py-4 mt-2">
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-4 h-fit space-y-3">
        <LivePreviewCard form={form} storeId={storeId} productId={productId} setForm={setForm} />
      </div>

      <div className="fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
        <div className="pointer-events-auto flex flex-col items-end gap-1 rounded-2xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90">
          <Button
            onClick={() => {
              setErrors(null);
              onPublish();
            }}
            disabled={saving || saveBlocked || (publishing && !form.name.trim())}
            className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-5 h-11 min-w-[132px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEdit ? "Saving…" : "Publishing…"}
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Publish product"
            )}
          </Button>
          {saveBlocked && validation.errors[0] && (
            <span className="text-xs text-destructive max-w-[240px] text-right px-1">{validation.errors[0].message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
