import { ReactNode, useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
import { validateProductForm } from "@/services/productValidation";
import { LivePreviewCard } from "@/components/product-edit/LivePreviewCard";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";

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

export function AdvancedShell({ form, setForm, activeTab, setActiveTab, tabContent, canAdvance, onCancel, onPublish, saving, isEdit, storeId, productId }: Props) {
  const [errors, setErrors] = useState<string | null>(null);
  /** Tabs the user has opened at least once (drives red / green / neutral chrome). */
  const [visitedTabs, setVisitedTabs] = useState<Set<AdvancedTabKey>>(() => new Set([activeTab]));

  const validation = useMemo(() => validateProductForm(form), [form]);
  const publishing = form.status === "publish";
  const publishBlocked = publishing && !validation.ok;

  const steps = ALL_STEPS;

  const markTabVisited = useCallback((key: AdvancedTabKey) => {
    setVisitedTabs((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    markTabVisited(activeTab);
  }, [activeTab, markTabVisited]);

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
          <div className="flex items-center gap-4 sm:gap-6 px-6 border-b border-border overflow-x-auto scrollbar-none">
            {steps.map((step) => {
              const isActive = step.key === activeTab;
              const visited = visitedTabs.has(step.key);
              const complete = canAdvance(step.key);
              const neutral = !visited;
              const incomplete = visited && !complete;
              const done = visited && complete;

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => { setErrors(null); setActiveTab(step.key); }}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={
                    neutral
                      ? `${step.label}, not opened yet`
                      : incomplete
                        ? `${step.label}, opened — required fields incomplete`
                        : `${step.label}, complete`
                  }
                  className={cn(
                    "relative flex items-center gap-1.5 py-3.5 pr-1 text-sm font-medium transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
                    neutral && !isActive && "text-muted-foreground hover:text-foreground",
                    incomplete && !isActive && "text-destructive bg-destructive/[0.07] px-2 -mx-1 ring-1 ring-destructive/25",
                    incomplete && isActive && "text-destructive",
                    done && !isActive && "text-emerald-700/90 dark:text-emerald-400/95 bg-emerald-500/[0.09] px-2 -mx-1 ring-1 ring-emerald-500/20",
                    done && isActive && "text-emerald-800 dark:text-emerald-300",
                    isActive && neutral && "text-foreground",
                  )}
                >
                  <span>{step.label}</span>
                  {done && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600/85 dark:text-emerald-400/90" strokeWidth={2.75} aria-hidden />
                  )}
                  <span
                    className={cn(
                      "absolute inset-x-0 -bottom-px h-0.5 transition-all rounded-full",
                      isActive ? "bg-foreground" : "bg-transparent",
                      incomplete && isActive && "bg-destructive",
                      done && isActive && "bg-emerald-600/70 dark:bg-emerald-500/80",
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