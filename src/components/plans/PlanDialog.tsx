import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, formatPrice } from "@/services/planService";
import type { Plan } from "@/services/planService";
import { Trash2, Plus } from "lucide-react";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onSave: (data: Partial<Plan>) => Promise<void>;
  onDelete?: (id: string) => void;
  saving: boolean;
}

const FEATURE_FLAGS = [
  { key: "priority_support", label: "Priority Support" },
  { key: "custom_domain", label: "Custom Domain" },
  { key: "advanced_webhooks", label: "Advanced Webhooks" },
  { key: "sla", label: "SLA Guarantee" },
  { key: "dedicated_csm", label: "Dedicated CSM" },
];

export function PlanDialog({ open, onOpenChange, plan, onSave, onDelete, saving }: PlanDialogProps) {
  const [form, setForm] = useState<Partial<Plan>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (plan) {
      setForm(plan);
      setPrices((plan.prices as Record<string, number>) || {});
    } else {
      setForm({
        slug: "",
        name: "",
        description: "",
        billing_interval: "month",
        max_sites: 1,
        max_products_per_site: 500,
        max_users: 1,
        max_api_calls_per_month: 10000,
        features: {},
        trial_days: 14,
        is_active: true,
        is_custom: false,
        sort_order: 100,
      });
      setPrices({});
    }
  }, [plan, open]);

  const setField = <K extends keyof Plan>(key: K, value: Plan[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const setPrice = (currency: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      const next = { ...prices };
      delete next[currency];
      setPrices(next);
      return;
    }
    const multiplier = ["KWD", "BHD", "OMR"].includes(currency) ? 1000 : 100;
    setPrices(prev => ({ ...prev, [currency]: Math.round(num * multiplier) }));
  };

  const priceDisplayValue = (currency: string): string => {
    const amount = prices[currency];
    if (amount == null) return "";
    const divisor = ["KWD", "BHD", "OMR"].includes(currency) ? 1000 : 100;
    return String(amount / divisor);
  };

  const toggleFeature = (key: string, checked: boolean) => {
    const current = (form.features as Record<string, boolean>) || {};
    setField("features", { ...current, [key]: checked });
  };

  const handleSave = async () => {
    await onSave({ ...form, prices });
  };

  const features = (form.features as Record<string, boolean>) || {};

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "Create plan"}</DialogTitle>
          <DialogDescription>Tier details, localized prices, quotas, and feature flags.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Basics</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="plan-slug" className="text-xs">Slug</Label>
                  <Input id="plan-slug" value={form.slug || ""} onChange={(e) => setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="growth" disabled={!!plan} className="h-9" />
                </div>
                <div>
                  <Label htmlFor="plan-name" className="text-xs">Display name</Label>
                  <Input id="plan-name" value={form.name || ""} onChange={(e) => setField("name", e.target.value)} placeholder="Growth" className="h-9" />
                </div>
              </div>
              <div>
                <Label htmlFor="plan-desc" className="text-xs">Description</Label>
                <Textarea id="plan-desc" value={form.description || ""} onChange={(e) => setField("description", e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Billing interval</Label>
                  <Select value={form.billing_interval || "month"} onValueChange={(v) => setField("billing_interval", v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="plan-trial" className="text-xs">Trial days</Label>
                  <Input id="plan-trial" type="number" min={0} value={form.trial_days ?? 0} onChange={(e) => setField("trial_days", parseInt(e.target.value) || 0)} className="h-9" />
                </div>
                <div>
                  <Label htmlFor="plan-sort" className="text-xs">Sort order</Label>
                  <Input id="plan-sort" type="number" value={form.sort_order ?? 100} onChange={(e) => setField("sort_order", parseInt(e.target.value) || 0)} className="h-9" />
                </div>
              </div>
              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setField("is_active", v)} />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch checked={form.is_custom ?? false} onCheckedChange={(v) => setField("is_custom", v)} />
                  Contact sales (hide prices)
                </label>
              </div>
            </CardContent>
          </Card>

          {!form.is_custom && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Localized prices</div>
                  <div className="text-[11px] text-muted-foreground">Leave blank for &quot;contact us&quot; in that currency</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SUPPORTED_CURRENCIES.map(cur => (
                    <div key={cur}>
                      <Label className="text-xs">{cur} — {CURRENCY_LABELS[cur]}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={priceDisplayValue(cur)}
                          onChange={(e) => setPrice(cur, e.target.value)}
                          placeholder="—"
                          className="h-9 pr-14"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">/ {form.billing_interval === "year" ? "yr" : "mo"}</span>
                      </div>
                      {prices[cur] != null && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">Preview: {formatPrice(prices[cur], cur)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Quotas</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Max sites</Label>
                  <Input type="number" min={0} value={form.max_sites ?? 0} onChange={(e) => setField("max_sites", parseInt(e.target.value) || 0)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Products / site</Label>
                  <Input type="number" min={0} value={form.max_products_per_site ?? 0} onChange={(e) => setField("max_products_per_site", parseInt(e.target.value) || 0)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Max users</Label>
                  <Input type="number" min={0} value={form.max_users ?? 0} onChange={(e) => setField("max_users", parseInt(e.target.value) || 0)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">API calls / month</Label>
                  <Input type="number" min={0} value={form.max_api_calls_per_month ?? 0} onChange={(e) => setField("max_api_calls_per_month", parseInt(e.target.value) || 0)} className="h-9" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Feature flags</div>
              <div className="grid grid-cols-2 gap-2">
                {FEATURE_FLAGS.map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-muted/50">
                    <Checkbox checked={!!features[f.key]} onCheckedChange={(v) => toggleFeature(f.key, !!v)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          {plan && <ActivityHistoryDrawer entityType="plan" entityId={plan.id} />}
          {plan && onDelete && (
            <Button variant="outline" size="sm" className="mr-auto text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => { if (confirm(`Delete ${plan.name}?`)) onDelete(plan.id); }} disabled={saving}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete plan
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.name || !form.slug}>
            {saving ? "Saving…" : plan ? "Save changes" : <><Plus className="h-3.5 w-3.5 mr-1.5" /> Create plan</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}