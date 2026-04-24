import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getClientById, updateClient, deleteClient, type Client } from "@/services/clientService";
import { getSubscriptionByClient, type Subscription } from "@/services/subscriptionService";
import { fetchAllPlans, type Plan } from "@/services/planService";
import { useStores } from "@/hooks/queries/useStores";
import { daysUntilLock, effectiveStatus } from "@/lib/subscription-state";
import { ArrowLeft, Pencil, Trash2, Store as StoreIcon, Clock, AlertTriangle, Settings } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: stores = [] } = useStores();
  const clientStores = stores.filter((s) => s.client_id === id);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [c, sub, pl] = await Promise.all([
          getClientById(id),
          getSubscriptionByClient(id),
          fetchAllPlans(),
        ]);
        if (!cancelled) {
          setClient(c);
          setSubscription(sub);
          setPlans(pl);
          setEditName(c?.name || "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleSaveName = async () => {
    if (!client || !editName.trim()) return;
    try {
      const updated = await updateClient(client.id, { name: editName.trim() });
      setClient(updated);
      setEditOpen(false);
      toast({ title: "Client updated" });
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    setDeleting(true);
    try {
      await deleteClient(client.id);
      toast({ title: "Client deleted" });
      router.push("/clients");
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
      setDeleting(false);
    }
  };

  if (loading) {
    return <AppLayout><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppLayout>;
  }

  if (!client) {
    return <AppLayout><div className="p-6 text-sm">Client not found. <Link className="underline" href="/clients">Back</Link></div></AppLayout>;
  }

  const plan = subscription ? plans.find((p) => p.id === subscription.plan_id) : null;
  const noPlansAtAll = plans.length === 0;
  const status = effectiveStatus(subscription);
  const statusColors: Record<string, string> = {
    trialing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    past_due: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    locked: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    canceled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    pending_payment: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  };

  let trialDaysLeft: number | null = null;
  if (subscription?.status === "trialing" && subscription.trial_end) {
    const ms = new Date(subscription.trial_end).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }
  const lockDaysLeft = daysUntilLock(subscription);

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/clients")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> All clients
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <div className="text-xs text-muted-foreground mt-1">Created {formatDistanceToNow(new Date(client.created_at || 0))} ago</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Rename
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
            </Button>
          </div>
        </div>

        {noPlansAtAll && (
          <Alert variant="destructive" className="border-amber-500/30 bg-amber-500/5 text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>No billing plans exist yet. New clients can&apos;t start a trial automatically until at least one plan is created.</span>
              <Link href="/settings/plans"><Button size="sm" variant="outline" className="gap-1.5"><Settings className="h-3.5 w-3.5" />Create a plan</Button></Link>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!subscription && (
              <div className="text-sm text-muted-foreground">
                No subscription on file. {noPlansAtAll ? "Create a plan first." : "Assign a plan from the subscriptions admin."}
              </div>
            )}
            {subscription && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm font-medium">{plan?.name || "Unknown plan"}</div>
                    <div className="text-xs text-muted-foreground">{subscription.currency}</div>
                  </div>
                  <Badge variant="outline" className={statusColors[status] || ""}>{status.replace("_", " ")}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  {trialDaysLeft !== null && (
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Clock className="h-3.5 w-3.5" />
                      {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} trial left
                    </div>
                  )}
                  {lockDaysLeft !== null && lockDaysLeft > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Grace ends in {lockDaysLeft} {lockDaysLeft === 1 ? "day" : "days"}
                    </div>
                  )}
                  <Link href="/settings/plans" className="text-primary hover:underline">Manage</Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Sites ({clientStores.length})</CardTitle>
            <Link href="/projects"><Button size="sm" variant="outline">Manage sites</Button></Link>
          </CardHeader>
          <CardContent>
            {clientStores.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">No sites yet for this client.</div>
            ) : (
              <div className="space-y-1.5">
                {clientStores.map((s) => (
                  <Link key={s.id} href={`/sites/${s.id}/home`} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/60 border text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <StoreIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[40%]">{s.url}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename client</DialogTitle>
              <DialogDescription>Changes apply immediately.</DialogDescription>
            </DialogHeader>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveName()} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveName} disabled={!editName.trim() || editName === client.name}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {client.name}?</DialogTitle>
              <DialogDescription>This cannot be undone. All associated sites, subscriptions, and history will be permanently removed.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}