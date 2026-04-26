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
  { key: "pricing", label: "Pricing" },
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

  const steps = form.type === "variable"
    ? ALL_STEPS.filter((s) => s.key !== "pricing")
    : ALL_STEPS;

  // Clamp activeTab when type toggles and current tab is no longer in steps
  useEffect(() => {
    if (!steps.find((s) => s.key === activeTab)) {
      setActiveTab(steps[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  const currentIdx = Math.max(0, steps.findIndex((t) => t.key === activeTab));
  const isLast = currentIdx === steps.length - 1;
  const activeLabel = steps[currentIdx]?.label ?? "";
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === form.status) ?? STATUS_OPTIONS[0];

  const goNext = () => {
    if (!canAdvance(activeTab)) {
      setErrors(`Please complete the required fields in ${activeLabel} before continuing.`);
      return;
    }
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
        <CardContent className="p-6 space-y-6">
          {/* Stepper */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            {steps.map((step, i) => {
              const stepIdx = i;
              const isActive = stepIdx === currentIdx;
              const completed = canAdvance(step.key) && !isActive;
              const isLastStep = stepIdx === steps.length - 1;
              const nextCompleted = !isLastStep && canAdvance(steps[stepIdx + 1].key) && stepIdx + 1 !== currentIdx;
              const connectorDone = completed && (nextCompleted || stepIdx + 1 === currentIdx);

              return (
                <div key={step.key} className={cn("flex items-center", isLastStep ? "" : "flex-1")}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(step.key)}
                    className="group flex flex-col items-center gap-2 outline-none"
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
                        isActive && "bg-primary text-primary-foreground border-primary ring-4 ring-primary/15 shadow-sm",
                        completed && "bg-success text-success-foreground border-success",
                        !isActive && !completed && "bg-muted text-muted-foreground border-border group-hover:border-foreground/30"
                      )}
                    >
                      {completed ? <Check className="h-4 w-4" strokeWidth={3} /> : stepIdx + 1}
                    </div>
                    <div className={cn(
                      "text-[11px] font-medium whitespace-nowrap transition-colors",
                      isActive && "text-foreground",
                      completed && "text-success",
                      !isActive && !completed && "text-muted-foreground"
                    )}>
                      {step.label}
                    </div>
                  </button>
                  {!isLastStep && (
                    <div className={cn(
                      "h-0.5 flex-1 mx-2 -mt-5 rounded-full transition-colors",
                      connectorDone ? "bg-success" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border" />

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
                  Next Step <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              ) : (
                <Button onClick={onPublish} disabled={saving || !form.name.trim()} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving…" : "Publishing…"}</> : (isEdit ? "Save Changes" : "Publish Product")}
                  {!saving && <ArrowRight className="h-4 w-4 ml-1.5" />}
                </Button>
              )}
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