import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { SitePageShell, useSiteFromRoute } from "@/components/site/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, RefreshCw, Plug, AlertTriangle, Trash2, Clock, Upload, X as XIcon, Image as ImageIcon, CalendarClock, Zap } from "lucide-react";
import { useTranslation } from "next-i18next";
import { formatDateTime, formatNumber } from "@/lib/format-number";
import { getStore, updateStore, deleteStore, type Store } from "@/services/storeService";
import { supabase } from "@/integrations/supabase/client";
import { SiteIcon } from "@/components/site/SiteIcon";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveSync } from "@/hooks/queries/useActiveSync";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";
import { HistoryWindowCard } from "@/components/site/HistoryWindowCard";
import { DefaultTemplatesCard } from "@/components/site/DefaultTemplatesCard";
import { StoreProfileCard } from "@/components/site/StoreProfileCard";
import { StorePreferencesSettingsCard } from "@/components/site/store-preferences/StorePreferencesSettingsCard";

function SettingsInner() {
  const { t, i18n } = useTranslation("site");
  const router = useRouter();
  const { id, store: storeFromRoute, loading: storeLoading } = useSiteFromRoute();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncInterval, setSyncInterval] = useState("0");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [lastCron, setLastCron] = useState<{ started_at: string; status: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const SYNC_INTERVALS = [
    { value: "0", label: t("settings.scheduledSync.manualOnly") },
    { value: "15", label: t("settings.scheduledSync.every15m") },
    { value: "30", label: t("settings.scheduledSync.every30m") },
    { value: "60", label: t("settings.scheduledSync.everyHour") },
    { value: "360", label: t("settings.scheduledSync.every6h") },
    { value: "720", label: t("settings.scheduledSync.every12h") },
    { value: "1440", label: t("settings.scheduledSync.every24h") },
  ];

  const refreshSidebarCache = () => {
    try { localStorage.removeItem("sidebar-sites-cache"); } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const handleLogoUpload = async (file: File) => {
    if (!store) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: t("settings.logo.tooLarge"), description: t("settings.logo.tooLargeDesc"), variant: "destructive" });
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast({ title: t("settings.logo.unsupported"), description: t("settings.logo.unsupportedDesc"), variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${store.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("site-logos").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("site-logos").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      await updateStore(store.id, { logo_url: url });
      const s = await getStore(store.id);
      setStore(s);
      refreshSidebarCache();
      toast({ title: t("settings.logo.updated") });
    } catch (e) {
      toast({ title: t("settings.logo.uploadFailed"), description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!store) return;
    setUploadingLogo(true);
    try {
      const { data: list } = await supabase.storage.from("site-logos").list("", { search: store.id });
      if (list && list.length > 0) {
        await supabase.storage.from("site-logos").remove(list.map((f) => f.name));
      }
      await updateStore(store.id, { logo_url: null });
      const s = await getStore(store.id);
      setStore(s);
      refreshSidebarCache();
      toast({ title: t("settings.logo.removed") });
    } catch (e) {
      toast({ title: t("settings.logo.removeFailed"), description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    if (storeFromRoute) {
      setStore(storeFromRoute);
      setSyncInterval(storeFromRoute.sync_interval?.toString() || "0");
      setLoading(false);
    }
  }, [storeFromRoute]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("cron_logs")
          .select("started_at,status")
          .eq("store_id", id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setLastCron(data);
      } catch { /* ignore */ }
    })();
  }, [id]);

  const { data: activeSync } = useActiveSync(id as string | null);
  const isSyncing = !!activeSync?.running;

  const formatDate = (d: string | null) =>
    !d ? "—" : formatDateTime(d, i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

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
      toast({ title: t("settings.scheduledSync.saved") });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!store || deleteConfirmation !== store.name) return;
    setDeleting(true);
    try {
      const result = await deleteStore(store.id);
      const parts = [t("settings.danger.removed", { name: store.name })];
      if (result.webhooks_removed > 0) parts.push(t("settings.danger.webhooksRemoved", { count: result.webhooks_removed }));
      if (result.webhooks_failed > 0) parts.push(t("settings.danger.webhooksFailed", { count: result.webhooks_failed }));
      toast({ title: t("settings.danger.deleted"), description: parts.join(" ") });
      router.push("/sites");
    } catch (e) {
      toast({ title: t("settings.danger.deleteFailed"), description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
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
        ? `Scheduler ran. This site: ${mine.status} (${formatNumber(mine.records_processed || 0, i18n.language)} records)`
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

  if (loading && storeLoading) {
    return (
      <div className="p-6 space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{t("settings.notFound")}</p>
        <Link href="/sites"><Button variant="outline" size="sm" className="mt-3"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />{t("settings.backToSites")}</Button></Link>
      </div>
    );
  }

  const nextMs = store.next_sync_at ? new Date(store.next_sync_at).getTime() : null;
  const isOverdue = nextMs ? nextMs < Date.now() : false;
  const minsOverdue = nextMs ? Math.floor((Date.now() - nextMs) / 60000) : 0;

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
          <p className="text-xs text-muted-foreground">{store.name} · {store.url.replace(/^https?:\/\//, "")}</p>
        </div>
        <ActivityHistoryDrawer entityType="store" entityId={store.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT COLUMN: Branding + Connection + Store Profile + Default Templates */}
        <div className="space-y-4">
          {/* Site Logo */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-semibold">{t("settings.logo.title")}</h2>
              </div>
              <div className="flex items-center gap-3">
                <SiteIcon site={store} size={44} />
                <div className="flex-1 flex items-center gap-2">
                  <label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingLogo}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
                    />
                    <Button asChild variant="outline" size="sm" disabled={uploadingLogo} className="h-8">
                      <span>
                        {uploadingLogo ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                        {store.logo_url ? t("settings.logo.replace") : t("settings.logo.upload")}
                      </span>
                    </Button>
                  </label>
                  {store.logo_url && (
                    <Button variant="ghost" size="sm" onClick={handleLogoRemove} disabled={uploadingLogo} className="h-8">
                      <XIcon className="h-3.5 w-3.5 mr-1.5" />{t("settings.logo.remove")}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("settings.logo.hint")}</p>
            </CardContent>
          </Card>

          <StorePreferencesSettingsCard store={store} onUpdated={(s) => setStore(s)} />

          {/* Connection */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Plug className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-semibold">{t("settings.connection.title")}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("settings.connection.storeUrl")}</p>
                  <p className="truncate" title={store.url}>{store.url.replace(/^https?:\/\//, "")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("settings.connection.apiStatus")}</p>
                  <StatusBadge variant={store.consumer_key ? "success" : "warning"}>{store.consumer_key ? t("settings.connection.connected") : t("settings.connection.notConnected")}</StatusBadge>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("settings.connection.lastSync")}</p>
                  <p>{store.last_sync_at ? formatDate(store.last_sync_at) : t("settings.connection.never")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("settings.connection.created")}</p>
                  <p>{formatDate(store.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <StoreProfileCard store={store} onSaved={() => { getStore(store.id).then((s) => s && setStore(s)); }} />

          <DefaultTemplatesCard clientId={(store as { client_id?: string | null }).client_id || null} />
        </div>

        {/* RIGHT COLUMN: Scheduled Sync + Historical + Danger Zone */}
        <div className="space-y-4">
          {/* Scheduled Sync */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <CalendarClock className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-semibold">{t("settings.scheduledSync.title")}</h2>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sync-interval" className="text-xs">{t("settings.scheduledSync.interval")}</Label>
                <Select value={syncInterval} onValueChange={setSyncInterval}>
                  <SelectTrigger id="sync-interval" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYNC_INTERVALS.map((i) => (<SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{t("settings.scheduledSync.intervalHint")}</p>
              </div>

              {store.next_sync_at && parseInt(syncInterval) > 0 && (
                <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 ${isOverdue ? "bg-warning/10 border border-warning/30" : "bg-muted/50"}`}>
                  {isOverdue ? <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="space-y-0.5 min-w-0">
                    <p>
                      {t("settings.scheduledSync.next")} <span className={isOverdue ? "text-warning font-medium" : "font-medium"}>{formatDate(store.next_sync_at)}</span>
                      {isOverdue && <span className="text-warning"> {t("settings.scheduledSync.overdue", { minutes: minsOverdue })}</span>}
                    </p>
                    {lastCron && <p className="text-muted-foreground">{t("settings.scheduledSync.lastScheduler", { time: formatRelativeTime(lastCron.started_at), status: lastCron.status })}</p>}
                  </div>
                </div>
              )}

              {cronResult && <div className="bg-muted/50 rounded-md px-3 py-2 text-xs">{cronResult}</div>}

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={handleTriggerCron} disabled={triggeringCron} className="h-8">
                  {triggeringCron ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                  {t("settings.scheduledSync.runNow")}
                </Button>
                <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings} className="h-8">
                  {savingSettings ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  {t("settings.scheduledSync.save")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Historical data window */}
          <HistoryWindowCard
            storeId={store.id}
            clientId={(store as { client_id?: string | null }).client_id || null}
            ordersHistoryFrom={(store as { orders_history_from?: string | null }).orders_history_from || null}
            onSaved={() => { getStore(store.id).then((s) => s && setStore(s)); }}
          />

          {/* Danger Zone */}
          <Card className="border-destructive/40">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-destructive/20">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <h2 className="text-sm font-semibold text-destructive">{t("settings.danger.title")}</h2>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm" className="text-xs">
                  {t("settings.danger.typeToConfirm")} <span className="font-mono font-semibold">{store.name}</span> {t("settings.danger.toConfirm")}
                </Label>
                <Input id="delete-confirm" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={store.name} className="h-9" />
                <p className="text-[11px] text-muted-foreground">{t("settings.danger.permanentWarning")}</p>
              </div>

              <div className="flex justify-end pt-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" disabled={deleteConfirmation !== store.name || deleting} className="h-8">
                      {deleting ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}{t("settings.danger.deleteSite")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.danger.confirmTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {isSyncing ? (
                          <>
                            <strong className="text-destructive">{t("settings.danger.syncingWarning")}</strong> {t("settings.danger.syncingDesc", { name: store.name })}
                          </>
                        ) : (
                          t("settings.danger.normalDesc", { name: store.name })
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("settings.danger.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteStore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("settings.danger.confirm")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function SiteSettingsPage() {
  return <SitePageShell><SettingsInner /></SitePageShell>;
}