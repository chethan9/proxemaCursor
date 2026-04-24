import { ReactNode, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
import { LivePreviewCard } from "@/components/product-edit/LivePreviewCard";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export type AdvancedTabKey = "basic" | "pricing" | "inventory" | "variants";

const TABS: { key: AdvancedTabKey; label: string }[] = [
  { key: "basic", label: "Basic Info" },
  { key: "pricing", label: "Pricing & Tax" },
  { key: "inventory", label: "Inventory & Shipping" },
  { key: "variants", label: "Variants" },
];

const STATUS_OPTIONS: { value: ProductFormState["status"]; label: string }[] = [
  { value: "publish", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "private", label: "Private" },
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
  const currentIdx = TABS.findIndex((t) => t.key === activeTab);
  const isLast = currentIdx === TABS.length - 1;

  const goNext = () => {
    if (!canAdvance(activeTab)) {
      setErrors("Please complete the required fields on this tab before continuing.");
      return;
    }
    setErrors(null);
    if (!isLast) setActiveTab(TABS[currentIdx + 1].key);
  };

  const goBack = () => {
    setErrors(null);
    if (currentIdx > 0) setActiveTab(TABS[currentIdx - 1].key);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4 border-b pb-2">
            <div className="flex items-center gap-6 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "pb-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-[1px] transition-colors",
                    activeTab === t.key ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {setForm && (
              <div className="flex items-center gap-1 shrink-0">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, status: s.value }))}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md border transition-colors",
                      form.status === s.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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

      <div className="lg:sticky lg:top-4 h-fit">
        <LivePreviewCard form={form} />
      </div>
    </div>
  );
}