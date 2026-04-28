import { useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, type Plan } from "@/hooks/queries/usePlans";
import { PlanDialog } from "@/components/plans/PlanDialog";
import { useToast } from "@/hooks/use-toast";

function PlansContent() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { data: plans, isLoading } = usePlans();
  const createMut = useCreatePlan();
  const updateMut = useUpdatePlan();
  const deleteMut = useDeletePlan();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

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
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast({ title: t("plans.toast.planUpdated") });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: t("plans.toast.planCreated") });
      }
      setDialogOpen(false);
    } catch (e) {
      toast({ title: t("plans.toast.saveFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function handleDelete(plan: Plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(plan.id);
      toast({ title: t("plans.toast.planDeleted") });
    } catch (e) {
      toast({ title: t("plans.toast.saveFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  function formatPrices(prices: Record<string, number> | null | undefined): string {
    if (!prices || Object.keys(prices).length === 0) return t("plans.noPrices");
    return Object.entries(prices)
      .map(([cur, val]) => `${cur} ${val}`)
      .join(" · ");
  }

  return (
    <SettingsLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("plans.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("plans.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("plans.newPlan")}
        </Button>
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
                    {plan.is_enterprise ? <Badge variant="secondary" className="ml-2 text-[10px]">{t("plans.contactSales")}</Badge> : null}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{formatPrices(plan.prices)}</td>
                  <td className="px-4 py-2 text-right">{plan.max_sites ?? t("plans.noValue")}</td>
                  <td className="px-4 py-2 text-right">{plan.max_products_per_site ?? t("plans.noValue")}</td>
                  <td className="px-4 py-2 text-right">{plan.max_users ?? t("plans.noValue")}</td>
                  <td className="px-4 py-2 text-right">{plan.max_api_calls_monthly ?? t("plans.noValue")}</td>
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
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(plan)}>
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
      />
    </SettingsLayout>
  );
}

export default function PlansPage() {
  return (
    <AuthGuard requireSuperAdmin>
      <AppLayout>
        <PlansContent />
      </AppLayout>
    </AuthGuard>
  );
}

export const getStaticProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});