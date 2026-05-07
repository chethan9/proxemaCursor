import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "next-i18next";
import { useAuth } from "@/contexts/AuthProvider";
import { useBranding } from "@/contexts/BrandingProvider";
import { useClients } from "@/hooks/queries/useClients";
import { updateStore, deleteStore, type DeleteStoreProgress } from "@/services/storeService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { Store, Image as ImageIcon, Copy, ExternalLink, Trash2, AlertTriangle, Unlink, Unlock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/helpers";
import { SiteDeletingOverlay } from "@/components/project/SiteDeletingOverlay";

type StoreRow = Tables<"stores">;

interface EditSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: StoreRow | null;
}

export function EditSiteDialog({ open, onOpenChange, site }: EditSiteDialogProps) {
  const router = useRouter();
  const { brandName } = useBranding();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClients();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<DeleteStoreProgress | null>(null);

  useEffect(() => {
    if (!site) return;
    setName(site.name ?? "");
    setUrl(site.url ?? "");
    setClientId(site.client_id ?? "");
    setTimezone((site as unknown as { timezone?: string }).timezone ?? "");
  }, [site]);

  if (!site) return null;

  const hasWoo = Boolean(site.consumer_key && site.consumer_secret);
  const hasWp = Boolean((site as unknown as { wp_app_password?: string }).wp_app_password);
  const wpUsername = (site as unknown as { wp_username?: string }).wp_username ?? null;
  const initialSyncIncomplete = !(site as unknown as { initial_sync_completed_at?: string | null }).initial_sync_completed_at;

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      toast({ title: t("editSite.nameUrlRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateStore(site.id, {
        name: name.trim(),
        url: url.trim(),
        client_id: clientId || null,
        timezone: timezone.trim() || null,
      } as never);
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["store", site.id] });
      toast({ title: t("editSite.updated") });
      onOpenChange(false);
    } catch (err) {
      toast({ title: t("editSite.updateFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReleaseSyncLock = async () => {
    setSaving(true);
    try {
      await updateStore(site.id, { initial_sync_completed_at: new Date().toISOString() } as never);
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["store", site.id] });
      toast({ title: t("editSite.lockReleased"), description: t("editSite.lockReleasedDesc") });
    } catch (err) {
      toast({ title: t("editSite.releaseLockFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteProgress(null);
    setDeleting(true);
    try {
      await deleteStore(site.id, (p) => setDeleteProgress(p));
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast({ title: t("editSite.deleted") });
      setDeleting(false);
      setDeleteProgress(null);
      onOpenChange(false);
      if (router.pathname.includes("/sites/")) router.push("/projects");
    } catch (err) {
      setDeleting(false);
      setDeleteProgress(null);
      toast({ title: t("editSite.deleteFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("editSite.copied", { label }) });
  };

  const useMyTz = () => {
    try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* noop */ }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (deleting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="relative flex h-[min(92vh,calc(100dvh-1.5rem))] w-[min(56rem,calc(100vw-1rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
        onInteractOutside={(e) => { if (deleting) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (deleting) e.preventDefault(); }}
      >
        <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5">
          <DialogTitle className="text-lg">{t("editSite.title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("editSite.description")}</DialogDescription>
        </DialogHeader>

        <div
          className={
            deleting ?
              "min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 pointer-events-none select-none opacity-40"
            : "min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4"
          }
          aria-hidden={deleting}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs">{t("editSite.siteName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 focus-visible:border-foreground/20 focus-visible:ring-1 focus-visible:ring-foreground/15"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="url" className="text-xs">{t("editSite.storeUrl")}</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-9 focus-visible:border-foreground/20 focus-visible:ring-1 focus-visible:ring-foreground/15"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="client" className="text-xs">{t("editSite.client")}</Label>
              <select
                id="client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:border-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/15"
              >
                <option value="">{t("editSite.unassigned")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="tz" className="text-xs">{t("editSite.timezone")}</Label>
            <div className="flex gap-2">
              <Input
                id="tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder={t("editSite.timezonePlaceholder")}
                className="h-9 flex-1 font-mono text-xs focus-visible:border-foreground/20 focus-visible:ring-1 focus-visible:ring-foreground/15"
              />
              <Button type="button" variant="outline" size="sm" onClick={useMyTz} className="h-9 whitespace-nowrap">{t("editSite.useMine")}</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2.5 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium leading-tight">{t("editSite.woocommerceTitle")}</div>
                    <div className="text-[11px] text-muted-foreground">{t("editSite.woocommerceDesc")}</div>
                  </div>
                </div>
                <Badge variant={hasWoo ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">{hasWoo ? t("editSite.connected") : t("editSite.notSet")}</Badge>
              </div>
              {hasWoo ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("editSite.consumerKey")}</Label>
                    <div className="flex gap-1">
                      <PasswordInput value={site.consumer_key ?? ""} readOnly className="h-8 text-xs flex-1" />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(site.consumer_key ?? "", t("editSite.key"))}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("editSite.consumerSecret")}</Label>
                    <div className="flex gap-1">
                      <PasswordInput value={site.consumer_secret ?? ""} readOnly className="h-8 text-xs flex-1" />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(site.consumer_secret ?? "", t("editSite.secret"))}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 w-full" onClick={() => router.push(`/sites/connect/${site.id}?reauth=1`)}>
                    <ExternalLink className="h-3.5 w-3.5 me-1.5" /> {t("editSite.reauthorize")}
                  </Button>
                </>
              ) : (
                <Button variant="default" size="sm" className="h-8 w-full" onClick={() => router.push(`/sites/connect/${site.id}`)}>
                  {t("editSite.connectWoo")}
                </Button>
              )}
            </div>

            <div className="min-w-0 space-y-2.5 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium leading-tight">{t("editSite.wpTitle")}</div>
                    <div className="text-[11px] text-muted-foreground">{t("editSite.wpDesc")}</div>
                  </div>
                </div>
                <Badge variant={hasWp ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">{hasWp ? t("editSite.connected") : t("editSite.notSet")}</Badge>
              </div>
              {hasWp ? (
                <>
                  {wpUsername && <div className="text-xs text-muted-foreground">{t("editSite.username")} <span className="font-medium text-foreground">{wpUsername}</span></div>}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => router.push(`/sites/connect/${site.id}?wp=1`)}>
                      <ExternalLink className="h-3.5 w-3.5 me-1.5" /> {t("editSite.reauthorizeWp")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={async () => {
                        try {
                          await updateStore(site.id, { wp_access_token: null, wp_username: null } as never);
                          queryClient.invalidateQueries({ queryKey: ["stores"] });
                          queryClient.invalidateQueries({ queryKey: ["store", site.id] });
                          toast({ title: t("editSite.disconnected") });
                        } catch (err) {
                          toast({ title: t("editSite.failed"), description: (err as Error).message, variant: "destructive" });
                        }
                      }}
                    >
                      <Unlink className="h-3.5 w-3.5 me-1.5" /> {t("editSite.disconnect")}
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="default" size="sm" className="h-8 w-full" onClick={() => router.push(`/sites/connect/${site.id}?wp=1`)}>
                  {t("editSite.connectWp")}
                </Button>
              )}
            </div>
          </div>

          {initialSyncIncomplete && (
            <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Unlock className="h-4 w-4 text-amber-700 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-amber-900">{t("editSite.syncLockTitle")}</div>
                  <div className="text-[11px] text-amber-800/90 truncate">{t("editSite.syncLockDesc")}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 border-amber-400 text-amber-900 hover:bg-amber-100" onClick={handleReleaseSyncLock} disabled={saving || deleting}>
                <Unlock className="h-3.5 w-3.5 me-1.5" /> {t("editSite.releaseLock")}
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-destructive">{t("editSite.dangerZone")}</div>
                <div className="text-[11px] text-destructive/80 truncate">{t("editSite.dangerZoneDesc")}</div>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={deleting || saving}>
                  <Trash2 className="h-3.5 w-3.5 me-1.5" /> {t("editSite.deleteSite")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("editSite.deleteConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    <span dangerouslySetInnerHTML={{ __html: t("editSite.deleteConfirmDesc", { name: site.name }) }} />
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>{t("editSite.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                    {deleting ? t("editSite.deleting") : t("editSite.deletePermanently")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 rounded-b-lg border-t bg-muted/30 px-5 py-3">
          <div className="text-[11px] text-muted-foreground">{t("editSite.footerNote", { brand: brandName })}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm" className="h-9" disabled={saving || deleting}>{t("editSite.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || deleting} size="sm" className="h-9 min-w-[110px]">
              {saving ? t("editSite.saving") : t("editSite.save")}
            </Button>
          </div>
        </div>

        <SiteDeletingOverlay open={deleting} siteName={site.name} progress={deleteProgress} />
      </DialogContent>
    </Dialog>
  );
}