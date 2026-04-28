import { useEffect, useMemo, useState } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Plus, Search, Loader2, Calendar, Ban, Sparkles, RotateCcw } from "lucide-react";
import { TableLoadingOverlay } from "@/components/ui/table-loading-overlay";
import {
  listAllSubscriptions,
  listClientsWithoutActiveSubscription,
  assignSubscription,
  updateSubscriptionAdmin,
  extendTrial,
  cancelSubscriptionAdmin,
  reactivateSubscription,
  switchPlan,
  type AdminSubscription,
} from "@/services/subscriptionService";
import { fetchActivePlans, formatPrice, type Plan } from "@/services/planService";
import type { SubscriptionStatus } from "@/lib/subscription-state";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

const STATUS_COLORS: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  past_due: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  locked: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
  canceled: "bg-muted text-muted-foreground border-border",
  pending_payment: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300",
};

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "locked", "canceled"];

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

export default function SubscriptionsAdmin() {
  const { toast } = useToast();
  const { t } = useTranslation("settings");
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<AdminSubscription | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const reload = async (silent = false) => {
    if (silent) setRefetching(true); else setLoading(true);
    try {
      const [s, p] = await Promise.all([listAllSubscriptions(), fetchActivePlans()]);
      setSubs(s);
      setPlans(p);
    } catch (e) {
      toast({ title: t("subscriptionsAdmin.loadFailed"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let arr = subs;
    if (statusFilter !== "all") arr = arr.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((s) => (s.client?.name || "").toLowerCase().includes(q) || (s.plan?.name || "").toLowerCase().includes(q));
    }
    return arr;
  }, [subs, search, statusFilter]);

  const statusLabel = (s: string) => t(`subscriptionsAdmin.statuses.${s}`, { defaultValue: s.replace("_", " ") });

  return (
    <SettingsLayout title={t("subscriptionsAdmin.title")} requireSuperAdmin>
      <div className="p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t("subscriptionsAdmin.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("subscriptionsAdmin.subtitle")}</p>
            </div>
          </div>
          <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} plans={plans} onAssigned={() => reload(true)} />
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder={t("subscriptionsAdmin.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("subscriptionsAdmin.allStatuses")}</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="relative">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />{t("subscriptionsAdmin.loading")}</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">{t("subscriptionsAdmin.noResults")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("subscriptionsAdmin.columns.client")}</TableHead>
                    <TableHead>{t("subscriptionsAdmin.columns.plan")}</TableHead>
                    <TableHead>{t("subscriptionsAdmin.columns.status")}</TableHead>
                    <TableHead>{t("subscriptionsAdmin.columns.periodEnd")}</TableHead>
                    <TableHead className="text-center">{t("subscriptionsAdmin.columns.grace")}</TableHead>
                    <TableHead>{t("subscriptionsAdmin.columns.updated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(s)}>
                      <TableCell className="font-medium text-sm">{s.client?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{s.plan?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] capitalize ${STATUS_COLORS[s.status] || ""}`}>{statusLabel(s.status || "")}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(s.current_period_end)}</TableCell>
                      <TableCell className="text-center text-xs">{s.grace_period_days ?? 7}d</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(s.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <TableLoadingOverlay show={refetching} />
        </Card>

        <DetailDrawer
          subscription={selected}
          plans={plans}
          onClose={() => setSelected(null)}
          onMutated={() => reload(true)}
        />
      </div>
    </SettingsLayout>
  );
}

function AssignDialog({ open, onOpenChange, plans, onAssigned }: { open: boolean; onOpenChange: (v: boolean) => void; plans: Plan[]; onAssigned: () => void }) {
  const { toast } = useToast();
  const { t } = useTranslation("settings");
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus>("trialing");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [grace, setGrace] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      listClientsWithoutActiveSubscription().then(setClients).catch(() => {});
      setClientId(""); setPlanId(""); setStatus("trialing");
    }
  }, [open]);

  const statusLabel = (s: string) => t(`subscriptionsAdmin.statuses.${s}`, { defaultValue: s.replace("_", " ") });

  const submit = async () => {
    if (!clientId || !planId) {
      toast({ title: t("subscriptionsAdmin.assignDialog.pickClientAndPlan"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await assignSubscription({
        clientId, planId, status,
        currentPeriodStart: new Date(periodStart).toISOString(),
        currentPeriodEnd: new Date(periodEnd).toISOString(),
        gracePeriodDays: grace,
      });
      toast({ title: t("subscriptionsAdmin.assignDialog.assigned") });
      onOpenChange(false);
      onAssigned();
    } catch (e) {
      toast({ title: t("subscriptionsAdmin.assignDialog.assignFailed"), description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />{t("subscriptionsAdmin.assign")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("subscriptionsAdmin.assignDialog.title")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("subscriptionsAdmin.assignDialog.client")}</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder={clients.length ? t("subscriptionsAdmin.assignDialog.chooseClient") : t("subscriptionsAdmin.assignDialog.allClientsHaveSub")} /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("subscriptionsAdmin.assignDialog.plan")}</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder={t("subscriptionsAdmin.assignDialog.choosePlan")} /></SelectTrigger>
              <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatPrice((p.prices as Record<string, number>)?.USD ?? 0, "USD")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("subscriptionsAdmin.assignDialog.status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.filter((s) => s !== "canceled").map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("subscriptionsAdmin.assignDialog.graceDays")}</Label>
              <Input type="number" min={0} value={grace} onChange={(e) => setGrace(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">{t("subscriptionsAdmin.assignDialog.periodStart")}</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
            <div><Label className="text-xs">{t("subscriptionsAdmin.assignDialog.periodEnd")}</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("subscriptionsAdmin.assignDialog.cancel")}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("subscriptionsAdmin.assignDialog.assign")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDrawer({ subscription, plans, onClose, onMutated }: {
  subscription: AdminSubscription | null;
  plans: Plan[];
  onClose: () => void;
  onMutated: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation("settings");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus>("active");
  const [periodEnd, setPeriodEnd] = useState("");
  const [grace, setGrace] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subscription) {
      setPlanId(subscription.plan_id);
      setStatus((subscription.status || "active") as SubscriptionStatus);
      setPeriodEnd(subscription.current_period_end ? subscription.current_period_end.slice(0, 10) : "");
      setGrace(subscription.grace_period_days ?? 7);
    }
  }, [subscription]);

  if (!subscription) return null;

  const statusLabel = (s: string) => t(`subscriptionsAdmin.statuses.${s}`, { defaultValue: s.replace("_", " ") });

  const wrap = async (op: () => Promise<unknown>, successMsg: string) => {
    setSaving(true);
    try {
      await op();
      toast({ title: successMsg });
      onMutated();
      onClose();
    } catch (e) {
      toast({ title: t("subscriptionsAdmin.drawer.actionFailed"), description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={!!subscription} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{subscription.client?.name || t("subscriptionsAdmin.title")}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("subscriptionsAdmin.drawer.currentPlan")}</span>
              <span className="font-medium">{subscription.plan?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("subscriptionsAdmin.drawer.status")}</span>
              <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_COLORS[subscription.status || ""] || ""}`}>{statusLabel(subscription.status || "")}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("subscriptionsAdmin.drawer.periodEnd")}</span>
              <span className="font-mono">{fmtDate(subscription.current_period_end)}</span>
            </div>
          </CardContent></Card>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t("subscriptionsAdmin.drawer.edit")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs text-muted-foreground">{t("subscriptionsAdmin.drawer.plan")}</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">{t("subscriptionsAdmin.drawer.status")}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">{t("subscriptionsAdmin.drawer.periodEnd")}</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">{t("subscriptionsAdmin.drawer.graceDays")}</Label><Input type="number" min={0} value={grace} onChange={(e) => setGrace(Number(e.target.value) || 0)} /></div>
            </div>
            <Button size="sm" className="w-full" disabled={saving} onClick={() => wrap(() => updateSubscriptionAdmin(subscription.id, {
              plan_id: planId, status, current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
              grace_period_days: grace,
            }), t("subscriptionsAdmin.drawer.updated"))}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("subscriptionsAdmin.drawer.saveChanges")}</Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t("subscriptionsAdmin.drawer.quickActions")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => wrap(() => extendTrial(subscription.id, 14), t("subscriptionsAdmin.drawer.trialExtended14"))}><Calendar className="h-3.5 w-3.5 mr-1.5" />{t("subscriptionsAdmin.drawer.extend14")}</Button>
              <Button size="sm" variant="outline" onClick={() => wrap(() => extendTrial(subscription.id, 30), t("subscriptionsAdmin.drawer.trialExtended30"))}><Calendar className="h-3.5 w-3.5 mr-1.5" />{t("subscriptionsAdmin.drawer.extend30")}</Button>
              {subscription.status === "canceled" ? (
                <Button size="sm" variant="outline" onClick={() => wrap(() => reactivateSubscription(subscription.id), t("subscriptionsAdmin.drawer.reactivated"))}><RotateCcw className="h-3.5 w-3.5 mr-1.5" />{t("subscriptionsAdmin.drawer.reactivate")}</Button>
              ) : (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => wrap(() => cancelSubscriptionAdmin(subscription.id), t("subscriptionsAdmin.drawer.canceled"))}><Ban className="h-3.5 w-3.5 mr-1.5" />{t("subscriptionsAdmin.drawer.cancel")}</Button>
              )}
              {planId !== subscription.plan_id && (
                <Button size="sm" variant="outline" onClick={() => wrap(() => switchPlan(subscription.id, planId), t("subscriptionsAdmin.drawer.planSwitched"))}><Sparkles className="h-3.5 w-3.5 mr-1.5" />{t("subscriptionsAdmin.drawer.switchPlan")}</Button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t">
            <ActivityHistoryDrawer entityType="subscription" entityId={subscription.id} label={t("subscriptionsAdmin.drawer.viewActivity")} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});