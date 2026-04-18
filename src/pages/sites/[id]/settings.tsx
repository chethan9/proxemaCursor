import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, RefreshCw, Settings as SettingsIcon, Zap, AlertTriangle, Trash2, Clock } from "lucide-react";
import { getStore, updateStore, deleteStore, type Store } from "@/services/storeService";
import { supabase } from "@/integrations/supabase/client";

const SYNC_INTERVALS = [
  { value: "0", label: "Manual only" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Every 24 hours" },
];

function SettingsInner() {
  const router = useRouter();
  const { id } = router.query;
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncInterval, setSyncInterval] = useState("0");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [lastCron, setLastCron] = useState<{ started_at: string; status: string } | null>(null);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    (async () => {
      setLoading(true);
      try {
        const s = await getStore(id);
        setStore(s);
        setSyncInterval(s?.sync_interval?.toString() || "0");
        const { data } = await supabase
          .from("cron_logs")
          .select("started_at,status")
          .eq("store_id", id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setLastCron(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatDate = (d: string | null) =>
    !d ? "-" : new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const formatRelativeTime = (d: string | null) => {
    if (!d) return "Never";
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const handleSaveSettings = async () => {
    if (!store) return;
    setSavingSettings(true);
    try {
      const interval = parseInt(syncInterval, 10);
      const nextSync = interval > 0 ? new Date(Date.now() + interval * 60 * 1000).toISOString() : null;
      await updateStore(store.id, { sync_interval: interval || null, next_sync_at: nextSync });
      const s = await getStore(store.id);
      setStore(s);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!store || deleteConfirmation !== store.name) return;
    setDeleting(true);
    try {
      await deleteStore(store.id);
      router.push("/sites");
    } finally {
      setDeleting(false);
    }
  };

  const handleTriggerCron = async () => {
    setTriggeringCron(true);
    setCronResult(null);
    try {
      const res = await fetch("/api/cron/sync-scheduler");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Trigger failed");
      const mine = data.results?.find((r: { store_id: string; status: string; records_processed?: number }) => r.store_id === store?.id);
      setCronResult(mine
        ? `Scheduler ran. This site: ${mine.status} (${mine.records_processed?.toLocaleString() || 0} records)`
        : `Scheduler ran but this site was not due yet (${data.stores_synced} store(s) processed).`);
      if (store) {
        const s = await getStore(store.id);
        setStore(s);
      }
    } catch (err) {
      setCronResult(err instanceof Error ? err.message : "Failed to trigger scheduler");
    } finally {
      setTriggeringCron(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Site not found.</p>
        <Link href="/sites"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Sites</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><SettingsIcon className="h-5 w-5" />Configuration</h1>
        <p className="text-sm text-muted-foreground">{store.name} · {store.url}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Details</CardTitle>
          <CardDescription>API connection and sync configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm font-medium">Store URL</p><p className="text-sm text-muted-foreground">{store.url}</p></div>
            <div>
              <p className="text-sm font-medium">API Status</p>
              <StatusBadge variant={store.consumer_key ? "success" : "warning"}>{store.consumer_key ? "Connected" : "Not Connected"}</StatusBadge>
            </div>
            <div><p className="text-sm font-medium">Last Sync</p><p className="text-sm text-muted-foreground">{store.last_sync_at ? formatDate(store.last_sync_at) : "Never"}</p></div>
            <div><p className="text-sm font-medium">Created</p><p className="text-sm text-muted-foreground">{formatDate(store.created_at)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scheduled Sync</CardTitle>
          <CardDescription>Configure automatic data synchronization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sync-interval">Sync Interval</Label>
            <Select value={syncInterval} onValueChange={setSyncInterval}>
              <SelectTrigger id="sync-interval" className="w-full max-w-xs"><SelectValue placeholder="Select interval" /></SelectTrigger>
              <SelectContent>
                {SYNC_INTERVALS.map((i) => (<SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Data will sync automatically at this interval.</p>
          </div>

          {store.next_sync_at && parseInt(syncInterval) > 0 && (() => {
            const nextMs = new Date(store.next_sync_at).getTime();
            const isOverdue = nextMs < Date.now();
            const minsOverdue = Math.floor((Date.now() - nextMs) / 60000);
            return (
              <div className={`rounded-lg p-3 space-y-2 ${isOverdue ? "bg-warning/10 border border-warning/30" : "bg-muted/50"}`}>
                <div className="flex items-start gap-2">
                  {isOverdue ? <AlertTriangle className="h-4 w-4 text-warning mt-0.5" /> : <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />}
                  <div className="flex-1 text-sm space-y-1">
                    <p><span className="font-medium">Next scheduled sync:</span>{" "}
                      <span className={isOverdue ? "text-warning font-medium" : "text-muted-foreground"}>
                        {formatDate(store.next_sync_at)}{isOverdue && ` (overdue by ${minsOverdue}m)`}
                      </span>
                    </p>
                    {lastCron && (<p className="text-xs text-muted-foreground">Last scheduler run: <span className="font-medium">{formatRelativeTime(lastCron.started_at)}</span> ({lastCron.status})</p>)}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center gap-2">
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <SettingsIcon className="h-4 w-4 mr-2" />}
              Save Configuration
            </Button>
            <Button variant="outline" onClick={handleTriggerCron} disabled={triggeringCron}>
              {triggeringCron ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Run Scheduler Now
            </Button>
          </div>

          {cronResult && (<div className="bg-muted/50 rounded-lg p-3 text-sm">{cronResult}</div>)}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Danger Zone</CardTitle>
          <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/10 rounded-lg p-4 space-y-4">
            <div>
              <p className="font-medium text-destructive">Delete this site</p>
              <p className="text-sm text-muted-foreground">This will permanently delete the site and all associated data.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-destructive">Type <strong>{store.name}</strong> to confirm</Label>
              <Input id="delete-confirm" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={store.name} className="max-w-xs" />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleteConfirmation !== store.name || deleting}>
                  {deleting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Delete Site
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. This will permanently delete <strong>{store.name}</strong> and remove all associated data.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteStore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, delete permanently</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SiteSettingsPage() {
  return <SitePageShell><SettingsInner /></SitePageShell>;
}