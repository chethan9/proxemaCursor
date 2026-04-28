import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Info } from "lucide-react";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, formatPrice, type Plan } from "@/services/planService";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onSave: (payload: Partial<Plan>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  saving?: boolean;
}

const FEATURE_KEYS = ["priority_support", "custom_domain", "advanced_webhooks", "sla", "dedicated_csm"] as const;

export function PlanDialog({ open, onOpenChange, plan, onSave, onDelete, saving }: PlanDialogProps) {
  const { t } = useTranslation("settings");
  const isEdit = !!plan;

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [trialDays, setTrialDays] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isCustom, setIsCustom] = useState(false);
  const [isDefaultTrial, setIsDefaultTrial] = useState(false);
  const [prices, setPrices] = useState<Record<string, number | "">>({});
  const [maxSites, setMaxSites] = useState<number | "">("");
  const [maxProducts, setMaxProducts] = useState<number | "">("");
  const [maxUsers, setMaxUsers] = useState<number | "">("");
  const [maxApi, setMaxApi] = useState<number | "">("");
  const [maxHistory, setMaxHistory] = useState<number | "">("");
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setSlug(plan?.slug ?? "");
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    setInterval((plan?.billing_interval as "month" | "year") ?? "month");
    setTrialDays(plan?.trial_days ?? 0);
    setSortOrder(plan?.sort_order ?? 0);
    setIsActive(plan?.is_active ?? true);
    setIsCustom(plan?.is_custom ?? false);
    setIsDefaultTrial(plan?.is_default_trial ?? false);
    const p = (plan?.prices as Record<string, number>) || {};
    const initialPrices: Record<string, number | ""> = {};
    SUPPORTED_CURRENCIES.forEach((c) => { initialPrices[c] = typeof p[c] === "number" ? p[c] : ""; });
    setPrices(initialPrices);
    setMaxSites(plan?.max_sites ?? "");
    setMaxProducts(plan?.max_products_per_site ?? "");
    setMaxUsers(plan?.max_users ?? "");
    setMaxApi(plan?.max_api_calls_per_month ?? "");
    setMaxHistory(plan?.max_initial_history_days ?? "");
    const f = (plan?.features as Record<string, boolean>) || {};
    const fInit: Record<string, boolean> = {};
    FEATURE_KEYS.forEach((k) => { fInit[k] = !!f[k]; });
    setFeatures(fInit);
  }, [open, plan]);

  function setPrice(currency: string, value: string) {
    const num = value === "" ? "" : Number(value);
    setPrices((p) => ({ ...p, [currency]: num }));
  }

  async function handleSave() {
    const cleanPrices: Record<string, number> = {};
    Object.entries(prices).forEach(([cur, val]) => {
      if (typeof val === "number" && !isNaN(val)) cleanPrices[cur] = val;
    });
    const payload: Partial<Plan> = {
      slug: slug.trim(),
      name: name.trim(),
      description: description.trim() || null,
      billing_interval: interval,
      trial_days: trialDays || 0,
      sort_order: sortOrder || 0,
      is_active: isActive,
      is_custom: isCustom,
      is_default_trial: isDefaultTrial,
      prices: cleanPrices,
      max_sites: maxSites === "" ? null : Number(maxSites),
      max_products_per_site: maxProducts === "" ? null : Number(maxProducts),
      max_users: maxUsers === "" ? null : Number(maxUsers),
      max_api_calls_per_month: maxApi === "" ? null : Number(maxApi),
      max_initial_history_days: maxHistory === "" ? null : Number(maxHistory),
      features,
    };
    await onSave(payload);
  }

  async function handleDelete() {
    if (!plan || !onDelete) return;
    if (!confirm(t("planDialog.deleteConfirm", { name: plan.name }))) return;
    await onDelete(plan.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("planDialog.editTitle", { name: plan!.name }) : t("planDialog.createTitle")}</DialogTitle>
          <DialogDescription>{t("planDialog.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("planDialog.basics")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("planDialog.slug")}</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t("planDialog.slugPlaceholder")} />
              </div>
              <div>
                <Label className="text-xs">{t("planDialog.displayName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("planDialog.displayNamePlaceholder")} />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("planDialog.description")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t("planDialog.billingInterval")}</Label>
                <Select value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">{t("planDialog.monthly")}</SelectItem>
                    <SelectItem value="year">{t("planDialog.yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("planDialog.trialDays")}</Label>
                <Input type="number" min={0} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="text-xs">{t("planDialog.sortOrder")}</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                {t("planDialog.active")}
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={isCustom} onCheckedChange={setIsCustom} />
                {t("planDialog.contactSales")}
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={isDefaultTrial} onCheckedChange={setIsDefaultTrial} />
                {t("planDialog.defaultTrial")}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">{t("planDialog.defaultTrialTip")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t("planDialog.localizedPrices")}</h3>
              <p className="text-xs text-muted-foreground">{t("planDialog.pricesHelper")}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SUPPORTED_CURRENCIES.map((cur) => (
                <div key={cur} className="space-y-1">
                  <Label className="text-[11px] flex items-center justify-between">
                    <span>{cur} <span className="text-muted-foreground">· {CURRENCY_LABELS[cur]}</span></span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={prices[cur] ?? ""}
                    onChange={(e) => setPrice(cur, e.target.value)}
                  />
                  {typeof prices[cur] === "number" && (prices[cur] as number) > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {t("planDialog.preview")} {formatPrice(prices[cur] as number, cur)}{" "}
                      {interval === "year" ? t("planDialog.perYear") : t("planDialog.perMonth")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("planDialog.quotas")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t("planDialog.maxSites")}</Label>
                <Input type="number" min={0} placeholder={t("planDialog.unlimited")} value={maxSites} onChange={(e) => setMaxSites(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">{t("planDialog.productsPerSite")}</Label>
                <Input type="number" min={0} placeholder={t("planDialog.unlimited")} value={maxProducts} onChange={(e) => setMaxProducts(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">{t("planDialog.maxUsers")}</Label>
                <Input type="number" min={0} placeholder={t("planDialog.unlimited")} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">{t("planDialog.apiCallsPerMonth")}</Label>
                <Input type="number" min={0} placeholder={t("planDialog.unlimited")} value={maxApi} onChange={(e) => setMaxApi(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs flex items-center gap-1">
                  {t("planDialog.maxInitialHistory")}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">{t("planDialog.historyHelper")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input type="number" min={0} placeholder={t("planDialog.unlimited")} value={maxHistory} onChange={(e) => setMaxHistory(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("planDialog.featureFlags")}</h3>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs p-2 rounded-md border border-border">
                  <Switch checked={!!features[key]} onCheckedChange={(v) => setFeatures((f) => ({ ...f, [key]: v }))} />
                  {t(`planDialog.feature_${key}`)}
                </label>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {isEdit && onDelete ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {t("planDialog.deletePlan")}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("planDialog.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !slug.trim() || !name.trim()}>
              {saving ? t("planDialog.saving") : isEdit ? t("planDialog.saveChanges") : t("planDialog.createPlan")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}