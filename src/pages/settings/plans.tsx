import { useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { usePlansAdmin } from "@/hooks/queries/usePlans";
import type { Plan } from "@/services/planService";
import { PlanDialog } from "@/components/plans/PlanDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPolarPlanEnvRefs } from "@/lib/payments/polar-types";

function PlansContent() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { plans, isLoading, save, isSaving, delete: deletePlan } = usePlansAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [syncingPolar, setSyncingPolar] = useState(false);

  async function syncAllPolar() {
    setSyncingPolar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/plans/sync-all-polar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Sync failed");
      const failed = (j.results as Array<{ ok: boolean }>).filter((r) => !r.ok).length;
      toast({
        title: "Polar sync complete",
        description: failed ? `${failed} plan(s) failed (${j.polarServer})` : `All plans synced (${j.polarServer})`,
        variant: failed ? "destructive" : "default",
      });
    } catch (e) {
      toast({ title: "Polar sync failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSyncingPolar(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setDialogOpen(true);
  }

  async function handleSave(payload: Partial<Plan>) {
    try {
      const merged = editing ? { ...payload, id: editing.id } : payload;
      await save(merged);
      toast({ title: editing ? t("plans.toast.planUpdated") : t("plans.toast.planCreated") });
      setDialogOpen(false);
    } catch (e) {
      toast({ title: t("plans.toast.saveFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete plan "${name}"?`)) return;
    try {
      deletePlan(id);
      toast({ title: t("plans.toast.planDeleted") });
    } catch (e) {
      toast({ title: t("plans.toast.saveFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  function formatPrices(prices: unknown): string {
    if (!prices || typeof prices !== "object") return t("plans.noPrices");
    const entries = Object.entries(prices as Record<string, number>);
    if (entries.length === 0) return t("plans.noPrices");
    return entries.map(([cur, val]) => `${cur} ${val}`).join(" · ");
  }

  return (
    <SettingsLayout title={t("plans.title")} requireSuperAdmin>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("plans.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("plans.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncAllPolar} disabled={syncingPolar}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncingPolar ? "animate-spin" : ""}`} />
            Sync all to Polar
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("plans.newPlan")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t("plans.loading")}</div>
      ) : !plans || plans.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">{t("plans.empty")}</p>
          <Button variant="outline" onClick={openCreate}>{t("plans.createFirst")}</Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">{t("plans.columns.plan")}</th>
                <th className="text-left px-4 py-2">{t("plans.columns.prices")}</th>
                <th className="text-right px-4 py-2">{t("plans.columns.sites")}</th>
                <th className="text-right px-4 py-2">{t("plans.columns.products")}</th>
                <th className="text-right px-4 py-2">{t("plans.columns.users")}</th>
                <th className="text-right px-4 py-2">{t("plans.columns.api")}</th>
                <th className="text-right px-4 py-2">{t("plans.columns.trial")}</th>
                <th className="text-left px-4 py-2">{t("plans.columns.status")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    {plan.name}
                    {plan.is_custom ? <Badge variant="secondary" className="ml-2 text-[10px]">{t("plans.contactSales")}</Badge> : null}
                    {(getPolarPlanEnvRefs((plan as Plan & { polar_refs?: unknown }).polar_refs, "sandbox") ||
                      getPolarPlanEnvRefs((plan as Plan & { polar_refs?: unknown }).polar_refs, "production")) ? (
                      <Badge variant="outline" className="ml-2 text-[10px]">Polar</Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{formatPrices(plan.prices)}</td>
                  <td className="px-4 py-2 text-right">{plan.max_sites ?? t("plans.noValue")}</td>
                  <td className="px-4 py-2 text-right">{plan.max_products_per_site ?? t("plans.noValue")}</td>
                  <td className="px-4 py-2 text-right">{plan.max_users ?? t("plans.noValue")}</td>
                  <td className="px-4 py-2 text-right">{plan.max_api_calls_per_month ?? t("plans.noValue")}</td>
                  <td className="px-4 py-2 text-right">
                    {plan.trial_days ? t("plans.trialDays", { count: plan.trial_days }) : t("plans.noValue")}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={plan.is_active ? "default" : "secondary"} className="text-[10px]">
                      {plan.is_active ? "active" : "inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(plan.id, plan.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editing}
        onSave={handleSave}
        saving={isSaving}
      />
    </SettingsLayout>
  );
}

export default function PlansPage() {
  return (
    <AuthGuard requireSuperAdmin>
      <PlansContent />
    </AuthGuard>
  );
}

export const getStaticProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});