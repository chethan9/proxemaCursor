import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "./_shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, RefreshCw, Settings as SettingsIcon, Trash2, AlertTriangle, Clock, Zap, AlertCircle } from "lucide-react";
import { updateStore, deleteStore } from "@/services/storeService";
import { browserCache, CACHE_KEYS } from "@/lib/cache";

const SYNC_INTERVALS = [
  { value: "0", label: "Manual only" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Every 24 hours" },
];

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(d: string | null) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SettingsInner() {
  const router = useRouter();
  const { id, store, loading } = useSiteFromRoute();
  const [syncInterval, setSyncInterval] = useState("0");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [lastCron, setLastCron] = useState<{ started_at: string; status: string } | null>(null);

  useEffect(() => {
    if (store) setSyncInterval(store.sync_interval?.toString() || "0");
  }, [store]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("cron_logs")
      .select("started_at, status")
      .eq("store_id", id)
      .order("started_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) setLastCron(data[0]);
      });
  }, [id]);

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const interval = parseInt(syncInterval, 10);
      const nextSync = interval > 0 ? new Date(Date.now() + interval * 60 * 1000).toISOString() : null;
      await updateStore(store.id, { sync_interval: interval || null, next_sync_at: nextSync });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteStore = async () => {
    if (deleteConfirmation !== store.name) return;
    setDeleting(true);
    try {
      await deleteStore(store.id);
      browserCache.delete(CACHE_KEYS.STORES);
      browserCache.delete(CACHE_KEYS.DASHBOARD_STATS);
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
      const mine = data.results?.find((r: { store_id: string; status: string; records_processed?: number }) => r.store_id === store.id);
      if (mine) {
        setCronResult(`Scheduler ran. This site: ${mine.status} (${mine.records_processed?.toLocaleString() || 0} records)`);
      } else {
        setCronResult(`Scheduler ran but this site was not due yet (${data.stores_synced} store(s) processed).`);
      }
    } catch (err) {
      setCronResult(err instanceof Error ? err.message : "Failed to trigger scheduler");
    } finally {
      setTriggeringCron(false);
    }
  };

  const nextSync = store.next_sync_at ? new Date(store.next_sync_at).getTime() : 0;
  const isOverdue = nextSync > 0 && nextSync < Date.now();
  const minsOverdue = isOverdue ? Math.floor((Date.now() - nextSync) / 60000) : 0;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/sites">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{store.name} — Settings</h1>
          <p className="text-xs text-muted-foreground">{store.url}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Details</CardTitle>
          <CardDescription>API connection and sync configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Store URL</p>
              <p className="text-sm text-muted-foreground">{store.url}</p>
            </div>
            <div>
              <p className="text-sm font-medium">API Status</p>
              <StatusBadge variant={store.consumer_key ? "success" : "warning"}>
                {store.consumer_key ? "Connected" : "Not Connected"}
              </StatusBadge>
            </div>
            <div>
              <p className="text-sm font-medium">Last Sync</p>
              <p className="text-sm text-muted-foreground">{store.last_sync_at ? formatDate(store.last_sync_at) : "Never"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-sm text-muted-foreground">{formatDate(store.created_at)}</p>
            </div>
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
              <SelectTrigger id="sync-interval" className="w-full max-w-xs">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVALS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Data will sync automatically at this interval.</p>
          </div>

          {store.next_sync_at && parseInt(syncInterval) > 0 && (
            <div className={`rounded-lg p-3 space-y-2 ${isOverdue ? "bg-warning/10 border border-warning/30" : "bg-muted/50"}`}>
              <div className="flex items-start gap-2">
                {isOverdue ? <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                <div className="flex-1 text-sm space-y-1">
                  <p>
                    <span className="font-medium">Next scheduled sync:</span>{" "}
                    <span className={isOverdue ? "text-warning font-medium" : "text-muted-foreground"}>
                      {formatDate(store.next_sync_at)}
                      {isOverdue && ` (overdue by ${minsOverdue}m)`}
                    </span>
                  </p>
                  {lastCron && (
                    <p className="text-xs text-muted-foreground">
                      Last scheduler run: <span className="font-medium">{formatRelativeTime(lastCron.started_at)}</span> ({lastCron.status})
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <SettingsIcon className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
            <Button variant="outline" onClick={handleTriggerCron} disabled={triggeringCron}>
              {triggeringCron ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Run Scheduler Now
            </Button>
          </div>

          {cronResult && <div className="bg-muted/50 rounded-lg p-3 text-sm">{cronResult}</div>}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-destructive/10 rounded-lg p-4 space-y-4">
            <div>
              <p className="font-medium text-destructive">Delete this site</p>
              <p className="text-sm text-muted-foreground">This will permanently delete the site and all associated data.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-destructive">
                Type <strong>{store.name}</strong> to confirm
              </Label>
              <Input id="delete-confirm" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={store.name} className="max-w-xs" />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleteConfirmation !== store.name || deleting}>
                  {deleting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete Site
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete <strong>{store.name}</strong> and remove all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteStore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, delete permanently
                  </AlertDialogAction>
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
  return (
    <SitePageShell>
      <SettingsInner />
    </SitePageShell>
  );
}