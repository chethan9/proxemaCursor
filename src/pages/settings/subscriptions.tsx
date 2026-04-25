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
import { Textarea } from "@/components/ui/textarea";
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
      toast({ title: "Failed to load", description: (e as Error).message, variant: "destructive" });
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

  return (
    <SettingsLayout title="Subscriptions" requireSuperAdmin>
      <div className="p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Subscriptions</h1>
              <p className="text-xs text-muted-foreground">Per-client subscription management, plan overrides, trials, and cancellations.</p>
            </div>
          </div>
          <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} plans={plans} onAssigned={() => reload(true)} />
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Search by client or plan…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="relative">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading subscriptions…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No subscriptions match your filter.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period end</TableHead>
                    <TableHead className="text-center">Grace</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(s)}>
                      <TableCell className="font-medium text-sm">{s.client?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{s.plan?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] capitalize ${STATUS_COLORS[s.status] || ""}`}>{(s.status || "").replace("_", " ")}</Badge></TableCell>
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
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus>("trialing");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [grace, setGrace] = useState(7);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      listClientsWithoutActiveSubscription().then(setClients).catch(() => {});
      setClientId(""); setPlanId(""); setStatus("trialing"); setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!clientId || !planId) {
      toast({ title: "Pick a client and a plan", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await assignSubscription({
        clientId, planId, status,
        currentPeriodStart: new Date(periodStart).toISOString(),
        currentPeriodEnd: new Date(periodEnd).toISOString(),
        gracePeriodDays: grace,
        notes: notes || null,
      });
      toast({ title: "Subscription assigned" });
      onOpenChange(false);
      onAssigned();
    } catch (e) {
      toast({ title: "Assign failed", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Assign subscription</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign subscription</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder={clients.length ? "Choose client" : "All clients have subscriptions"} /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Choose plan" /></SelectTrigger>
              <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatPrice((p.prices as Record<string, number>)?.USD ?? 0, "USD")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.filter((s) => s !== "canceled").map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Grace days</Label>
              <Input type="number" min={0} value={grace} onChange={(e) => setGrace(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Period start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
            <div><Label className="text-xs">Period end</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes (optional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}</Button>
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
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus>("active");
  const [periodEnd, setPeriodEnd] = useState("");
  const [grace, setGrace] = useState(7);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subscription) {
      setPlanId(subscription.plan_id);
      setStatus((subscription.status || "active") as SubscriptionStatus);
      setPeriodEnd(subscription.current_period_end ? subscription.current_period_end.slice(0, 10) : "");
      setGrace(subscription.grace_period_days ?? 7);
      setNotes((subscription.notes as string) ?? "");
    }
  }, [subscription]);

  if (!subscription) return null;

  const wrap = async (op: () => Promise<unknown>, successMsg: string) => {
    setSaving(true);
    try {
      await op();
      toast({ title: successMsg });
      onMutated();
      onClose();
    } catch (e) {
      toast({ title: "Action failed", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={!!subscription} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{subscription.client?.name || "Subscription"}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Current plan</span>
              <span className="font-medium">{subscription.plan?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_COLORS[subscription.status || ""] || ""}`}>{(subscription.status || "").replace("_", " ")}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Period end</span>
              <span className="font-mono">{fmtDate(subscription.current_period_end)}</span>
            </div>
          </CardContent></Card>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Edit</Label>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs text-muted-foreground">Plan</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">Period end</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">Grace days</Label><Input type="number" min={0} value={grace} onChange={(e) => setGrace(Number(e.target.value) || 0)} /></div>
            </div>
            <div><Label className="text-xs text-muted-foreground">Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button size="sm" className="w-full" disabled={saving} onClick={() => wrap(() => updateSubscriptionAdmin(subscription.id, {
              plan_id: planId, status, current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
              grace_period_days: grace, notes: notes || null,
            }), "Subscription updated")}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Quick actions</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => wrap(() => extendTrial(subscription.id, 14), "Trial extended 14 days")}><Calendar className="h-3.5 w-3.5 mr-1.5" />Extend +14d</Button>
              <Button size="sm" variant="outline" onClick={() => wrap(() => extendTrial(subscription.id, 30), "Trial extended 30 days")}><Calendar className="h-3.5 w-3.5 mr-1.5" />Extend +30d</Button>
              {subscription.status === "canceled" ? (
                <Button size="sm" variant="outline" onClick={() => wrap(() => reactivateSubscription(subscription.id), "Subscription reactivated")}><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reactivate</Button>
              ) : (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => wrap(() => cancelSubscriptionAdmin(subscription.id), "Subscription canceled")}><Ban className="h-3.5 w-3.5 mr-1.5" />Cancel</Button>
              )}
              {planId !== subscription.plan_id && (
                <Button size="sm" variant="outline" onClick={() => wrap(() => switchPlan(subscription.id, planId), "Plan switched")}><Sparkles className="h-3.5 w-3.5 mr-1.5" />Switch plan</Button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t">
            <ActivityHistoryDrawer entityType="subscription" entityId={subscription.id} label="View activity history" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}