import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthProvider";
import { useClients } from "@/hooks/queries/useClients";
import { updateStore, deleteStore } from "@/services/storeService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { Store, Image as ImageIcon, Copy, ExternalLink, Trash2, AlertTriangle, Unlink, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/helpers";

type Store = Tables<"stores">;

interface EditSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Store | null;
}

export function EditSiteDialog({ open, onOpenChange, site }: EditSiteDialogProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClients();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!site) return;
    setName(site.name ?? "");
    setUrl(site.url ?? "");
    setClientId(site.client_id ?? "");
    setTimezone((site as unknown as { timezone?: string }).timezone ?? "");
  }, [site]);

  if (!site) return null;

  const hasWoo = Boolean(site.consumer_key && site.consumer_secret);
  const hasWp = Boolean((site as unknown as { wp_access_token?: string }).wp_access_token);
  const wpUsername = (site as unknown as { wp_username?: string }).wp_username ?? null;

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      toast({ title: "Name and URL required", variant: "destructive" });
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
      toast({ title: "Site updated" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteStore(site.id);
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast({ title: "Site deleted" });
      setDeleting(false);
      onOpenChange(false);
      if (router.pathname.includes("/sites/")) router.push("/projects");
    } catch (err) {
      setDeleting(false);
      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const useMyTz = () => {
    try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* noop */ }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (deleting) return; // block close while a delete is in flight
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-3xl p-0 gap-0 max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => { if (deleting) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (deleting) e.preventDefault(); }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg">Edit Site</DialogTitle>
          <DialogDescription className="text-xs">Manage site details, WooCommerce API, and WordPress media access.</DialogDescription>
        </DialogHeader>

        <div className={deleting ? "flex-1 overflow-y-auto px-5 py-4 space-y-4 pointer-events-none select-none opacity-40" : "flex-1 overflow-y-auto px-5 py-4 space-y-4"} aria-hidden={deleting}>
          {/* Row 1: basics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs">Site Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="url" className="text-xs">Store URL</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="client" className="text-xs">Client</Label>
              <select
                id="client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: timezone inline */}
          <div className="space-y-1">
            <Label htmlFor="tz" className="text-xs">Store Timezone</Label>
            <div className="flex gap-2">
              <Input
                id="tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Asia/Kuwait (leave blank to use viewer's browser timezone)"
                className="h-9 font-mono text-xs flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={useMyTz} className="h-9 whitespace-nowrap">Use mine</Button>
            </div>
          </div>

          {/* Row 3: integrations side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* WooCommerce */}
            <div className="rounded-md border p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium leading-tight">WooCommerce API</div>
                    <div className="text-[11px] text-muted-foreground">Products, orders, customers, taxonomy</div>
                  </div>
                </div>
                <Badge variant={hasWoo ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">{hasWoo ? "Connected" : "Not set"}</Badge>
              </div>
              {hasWoo ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Consumer Key</Label>
                    <div className="flex gap-1">
                      <PasswordInput value={site.consumer_key ?? ""} readOnly className="h-8 text-xs flex-1" />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(site.consumer_key ?? "", "Key")}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Consumer Secret</Label>
                    <div className="flex gap-1">
                      <PasswordInput value={site.consumer_secret ?? ""} readOnly className="h-8 text-xs flex-1" />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(site.consumer_secret ?? "", "Secret")}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 w-full" onClick={() => router.push(`/sites/connect/${site.id}?reauth=1`)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Re-authorize (OAuth)
                  </Button>
                </>
              ) : (
                <Button variant="default" size="sm" className="h-8 w-full" onClick={() => router.push(`/sites/connect/${site.id}`)}>
                  Connect WooCommerce
                </Button>
              )}
            </div>

            {/* WordPress Media */}
            <div className="rounded-md border p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium leading-tight">WordPress Media Access</div>
                    <div className="text-[11px] text-muted-foreground">Browse and upload to the media library</div>
                  </div>
                </div>
                <Badge variant={hasWp ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">{hasWp ? "Connected" : "Not set"}</Badge>
              </div>
              {hasWp ? (
                <>
                  {wpUsername && <div className="text-xs text-muted-foreground">Username: <span className="font-medium text-foreground">{wpUsername}</span></div>}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => router.push(`/sites/connect/${site.id}?wp=1`)}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Re-authorize
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
                          toast({ title: "Disconnected" });
                        } catch (err) {
                          toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
                        }
                      }}
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="default" size="sm" className="h-8 w-full" onClick={() => router.push(`/sites/connect/${site.id}?wp=1`)}>
                  Connect WordPress
                </Button>
              )}
            </div>
          </div>

          {/* Danger zone - compact single row */}
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-destructive">Danger zone</div>
                <div className="text-[11px] text-destructive/80 truncate">Permanently delete this site and all synced data.</div>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={deleting || saving}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete site
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this site?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes <strong>{site.name}</strong> and all synced products, orders, customers, and logs. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                    {deleting ? "Deleting…" : "Delete permanently"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-2 border-t px-5 py-3 bg-muted/30 rounded-b-lg">
          <div className="text-[11px] text-muted-foreground">Changes are saved to WooSync only. WooCommerce credentials stay private.</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm" className="h-9" disabled={saving || deleting}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || deleting} size="sm" className="h-9 min-w-[110px]">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

        {/* Blocking overlay while deleting — covers everything including the Dialog's close (X) button */}
        {deleting && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            <div className="text-sm font-medium">Deleting <span className="text-destructive">{site.name}</span>…</div>
            <div className="text-xs text-muted-foreground">Please wait — this may take a few seconds.</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}