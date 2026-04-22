import { useState } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlanDialog } from "@/components/plans/PlanDialog";
import { usePlansAdmin } from "@/hooks/queries/usePlans";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/services/planService";
import type { Plan } from "@/services/planService";
import { Plus, Layers, CheckCircle2, XCircle, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PlansSettings() {
  const { plans, isLoading, save, isSaving, delete: deletePlan } = usePlansAdmin();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (plan: Plan) => { setEditing(plan); setDialogOpen(true); };

  const handleSave = async (data: Partial<Plan>) => {
    try {
      await save(data);
      toast({ title: editing ? "Plan updated" : "Plan created" });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = (id: string) => {
    deletePlan(id);
    setDialogOpen(false);
    toast({ title: "Plan deleted" });
  };

  const formatQuota = (n: number) => n >= 999999 ? <InfinityIcon className="h-3.5 w-3.5 inline" /> : n.toLocaleString();

  return (
    <SettingsLayout title="Plans" requireSuperAdmin>
      <div className="p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Plans</h1>
              <p className="text-xs text-muted-foreground">Tiers, localized prices, and quota enforcement rules.</p>
            </div>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New plan
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Loading plans…</div>
            ) : !plans || plans.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No plans yet.
                <Button variant="link" size="sm" onClick={openNew}>Create the first one</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Prices</TableHead>
                    <TableHead className="text-center">Sites</TableHead>
                    <TableHead className="text-center">Products</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">API / mo</TableHead>
                    <TableHead className="text-center">Trial</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map(plan => {
                    const prices = (plan.prices as Record<string, number>) || {};
                    const presentCurrencies = SUPPORTED_CURRENCIES.filter(c => prices[c] != null);
                    return (
                      <TableRow key={plan.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(plan)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-sm flex items-center gap-1.5">
                                {plan.name}
                                {plan.is_custom && <Sparkles className="h-3 w-3 text-amber-500" />}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{plan.slug} · {plan.billing_interval}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {plan.is_custom ? (
                            <Badge variant="outline" className="text-[10px]">Contact sales</Badge>
                          ) : presentCurrencies.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No prices set</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {presentCurrencies.slice(0, 3).map(c => (
                                <Badge key={c} variant="secondary" className="text-[10px] font-mono">{formatPrice(prices[c], c)}</Badge>
                              ))}
                              {presentCurrencies.length > 3 && (
                                <Badge variant="outline" className="text-[10px]">+{presentCurrencies.length - 3}</Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">{formatQuota(plan.max_sites)}</TableCell>
                        <TableCell className="text-center text-xs">{formatQuota(plan.max_products_per_site)}</TableCell>
                        <TableCell className="text-center text-xs">{formatQuota(plan.max_users)}</TableCell>
                        <TableCell className="text-center text-xs">{formatQuota(plan.max_api_calls_per_month)}</TableCell>
                        <TableCell className="text-center text-xs">{plan.trial_days > 0 ? `${plan.trial_days}d` : "—"}</TableCell>
                        <TableCell className="text-center">
                          {plan.is_active ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground inline" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <PlanDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          plan={editing}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          saving={isSaving}
        />
      </div>
    </SettingsLayout>
  );
}