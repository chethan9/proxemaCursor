import { ReactNode, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
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
};

export function AdvancedShell({ form, setForm, activeTab, setActiveTab, tabContent, canAdvance, onCancel, onPublish, saving, isEdit }: Props) {
  const [errors, setErrors] = useState<string | null>(null);

  const steps = ALL_STEPS;

  useEffect(() => {
    if (!steps.find((s) => s.key === activeTab)) {
      setActiveTab(steps[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  const currentIdx = Math.max(0, steps.findIndex((t) => t.key === activeTab));
  const isLast = currentIdx === steps.length - 1;
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === form.status) ?? STATUS_OPTIONS[0];

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
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-border overflow-x-auto">
            {steps.map((step) => {
              const isActive = step.key === activeTab;
              const completed = canAdvance(step.key);
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => { setErrors(null); setActiveTab(step.key); }}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors whitespace-nowrap",
                    isActive
                      ? "text-foreground bg-background border-x border-t border-border -mb-px"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span>{step.label}</span>
                  {completed && (
                    <span className={cn(
                      "h-4 w-4 rounded-full flex items-center justify-center shrink-0",
                      isActive ? "bg-success text-success-foreground" : "bg-success/15 text-success"
                    )}>
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                    </span>
                  )}
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
                  <Button onClick={onPublish} disabled={saving || !form.name.trim()} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                    {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving…" : "Publishing…"}</> : (isEdit ? "Save Changes" : "Publish Product")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-4 h-fit space-y-4">
        {setForm && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Status</div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", currentStatus.dot)} />
                  <span className="text-xs text-foreground">{currentStatus.label}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {STATUS_OPTIONS.map((s) => {
                  const selected = form.status === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, status: s.value }))}
                      className={cn(
                        "px-3 py-2 text-xs rounded-md border font-medium transition-all",
                        selected
                          ? "bg-foreground text-background border-foreground ring-2 ring-foreground/15 ring-offset-1 ring-offset-background shadow-sm"
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
        <LivePreviewCard form={form} />
      </div>
    </div>
  );
}