import { ReactNode, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
import { validateProductForm } from "@/services/productValidation";
import { LivePreviewCard } from "@/components/product-edit/LivePreviewCard";
import { isTabDirty } from "@/lib/product-edit/tab-slices";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export type AdvancedTabKey = "basic" | "pricing" | "inventory" | "variants";

const ALL_STEPS: { key: AdvancedTabKey; label: string }[] = [
  { key: "basic", label: "Basics" },
  { key: "inventory", label: "Inventory" },
  { key: "variants", label: "Variants" },
];

const STATUS_OPTIONS: { value: ProductFormState["status"]; label: string; dot: string }[] = [
  { value: "publish", label: "Active", dot: "bg-success" },
  { value: "draft", label: "Draft", dot: "bg-muted-foreground" },
  { value: "pending", label: "Pending", dot: "bg-warning" },
  { value: "private", label: "Private", dot: "bg-foreground/60" },
];

type Props = {
  form: ProductFormState;
  /** Snapshot when the editor opened (or last explicit reset). Tab chrome stays neutral until a tab differs from this. */
  baselineForm: ProductFormState | null;
  setForm?: (updater: (prev: ProductFormState) => ProductFormState) => void;
  activeTab: AdvancedTabKey;
  setActiveTab: (k: AdvancedTabKey) => void;
  tabContent: Record<AdvancedTabKey, ReactNode>;
  canAdvance: (tab: AdvancedTabKey) => boolean;
  onCancel: () => void;
  onPublish: () => void;
  saving: boolean;
  isEdit: boolean;
  storeId: string;
  productId?: string | null;
};

export function AdvancedShell({ form, baselineForm, setForm, activeTab, setActiveTab, tabContent, canAdvance, onCancel, onPublish, saving, isEdit, storeId, productId }: Props) {
  const [errors, setErrors] = useState<string | null>(null);

  const validation = useMemo(() => validateProductForm(form), [form]);
  const publishing = form.status === "publish";
  const publishBlocked = publishing && !validation.ok;

  const steps = ALL_STEPS;

  useEffect(() => {
    if (!steps.find((s) => s.key === activeTab)) {
      setActiveTab(steps[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  const currentIdx = Math.max(0, steps.findIndex((t) => t.key === activeTab));
  const isLast = currentIdx === steps.length - 1;

  const goNext = () => {
    setErrors(null);
    if (!isLast) setActiveTab(steps[currentIdx + 1].key);
  };

  const goBack = () => {
    setErrors(null);
    if (currentIdx > 0) setActiveTab(steps[currentIdx - 1].key);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <Card>
        <CardContent className="p-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 sm:px-5 border-b border-border overflow-x-auto scrollbar-none">
            {steps.map((step) => {
              const isActive = step.key === activeTab;
              const dirty = baselineForm ? isTabDirty(baselineForm, form, step.key) : false;
              const complete = canAdvance(step.key);
              const incomplete = dirty && !complete;

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => { setErrors(null); setActiveTab(step.key); }}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={
                    incomplete
                      ? `${step.label}, required fields incomplete`
                      : step.label
                  }
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{step.label}</span>
                  {incomplete && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "absolute inset-x-3 -bottom-px h-0.5 transition-all rounded-full",
                      isActive ? "bg-foreground" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div className="p-6 space-y-6">
            <div>{tabContent[activeTab]}</div>

            {errors && <div className="text-sm text-destructive">{errors}</div>}

            <div className="flex items-center justify-between pt-3 border-t">
              <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">Cancel</Button>
              <div className="flex items-center gap-2">
                {currentIdx > 0 && (
                  <Button variant="outline" onClick={goBack} className="rounded-full"><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
                )}
                {!isLast ? (
                  <Button onClick={goNext} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                    Next <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Button onClick={onPublish} disabled={saving || !form.name.trim() || publishBlocked} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving…" : "Publishing…"}</> : (isEdit ? "Save Changes" : "Publish Product")}
                    </Button>
                    {publishBlocked && validation.errors[0] && (
                      <span className="text-xs text-destructive max-w-[280px] text-right">{validation.errors[0].message}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-4 h-fit space-y-3">
        {setForm && (
          <Card>
            <CardContent className="p-4 space-y-2.5">
              <div className="text-xs font-medium text-muted-foreground">Status</div>
              <div className="grid grid-cols-4 gap-1">
                {STATUS_OPTIONS.map((s) => {
                  const selected = form.status === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, status: s.value }))}
                      className={cn(
                        "px-2 py-1.5 text-[11px] rounded-full border font-medium transition-all whitespace-nowrap",
                        selected
                          ? "bg-foreground text-background border-foreground shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        <LivePreviewCard form={form} storeId={storeId} productId={productId} setForm={setForm} />
      </div>
    </div>
  );
}