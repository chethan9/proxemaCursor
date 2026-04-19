import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Eye, EyeOff, ExternalLink, Copy, Check, ImageIcon, ShoppingBag, AlertCircle, Unlink, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { buildWooCommerceAuthUrl, buildWpAppPasswordUrl, validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { useUpdateStore, useDeleteStore } from "@/hooks/queries/useStores";
import { disconnectWpCredentials } from "@/services/storeService";
import { useToast } from "@/hooks/use-toast";
import type { StoreWithClient } from "@/services/storeService";
import type { Client } from "@/services/clientService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: StoreWithClient | null;
  clients: Client[];
  isSuperAdmin: boolean;
  onSaved?: () => void;
}

export function EditSiteDialog({ open, onOpenChange, store, clients, isSuperAdmin, onSaved }: Props) {
  const router = useRouter();
  const updateStoreMutation = useUpdateStore();
  const deleteStoreMutation = useDeleteStore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [wpConfirmMode, setWpConfirmMode] = useState<"idle" | "confirming">("idle");
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });

  const wpConnected = !!(store?.wp_username && store?.wp_app_password);
  const wcConnected = !!store?.consumer_key;

  useEffect(() => {
    if (store) {
      setForm({
        name: store.name,
        url: store.url,
        consumer_key: store.consumer_key || "",
        consumer_secret: store.consumer_secret || "",
        client_id: store.client_id || "",
      });
      setUrlError(null);
      setShowSecrets(false);
      setWpConfirmMode("idle");
      setDeleteConfirmation("");
    }
  }, [store]);

  const copyToClipboard = async (value: string, field: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleSave = async () => {
    if (!store) return;
    if (!form.name.trim() || !form.url.trim()) return;
    const validation = validateStoreUrl(form.url);
    if (!validation.valid) {
      setUrlError(validation.error || "Invalid URL");
      return;
    }
    const cleanedUrl = validation.cleanedUrl || cleanStoreUrl(form.url);
    setUrlError(null);
    setSaving(true);
    try {
      await updateStoreMutation.mutateAsync({
        id: store.id,
        patch: {
          name: form.name.trim(),
          url: cleanedUrl,
          consumer_key: form.consumer_key.trim() || null,
          consumer_secret: form.consumer_secret.trim() || null,
          client_id: form.client_id || null,
        },
      });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("[EditSite] Error:", error);
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const persistFormBeforeRedirect = async (cleanedUrl: string) => {
    if (!store) return;
    if (form.name.trim() !== store.name || cleanedUrl !== store.url || (form.client_id || null) !== store.client_id) {
      await updateStoreMutation.mutateAsync({
        id: store.id,
        patch: { name: form.name.trim(), url: cleanedUrl, client_id: form.client_id || null },
      });
    }
  };

  const handleWooReauth = async () => {
    if (!store) return;
    const validation = validateStoreUrl(form.url);
    if (!validation.valid) { setUrlError(validation.error || "Invalid URL"); return; }
    const cleanedUrl = validation.cleanedUrl || cleanStoreUrl(form.url);
    try { await persistFormBeforeRedirect(cleanedUrl); } catch (e) { console.error("[WooReAuth] Pre-save failed:", e); }
    window.location.href = buildWooCommerceAuthUrl({ storeUrl: cleanedUrl, storeId: store.id });
  };

  const handleWpAuthorize = async () => {
    if (!store) return;
    const validation = validateStoreUrl(form.url);
    if (!validation.valid) { setUrlError(validation.error || "Invalid URL"); return; }
    const cleanedUrl = validation.cleanedUrl || cleanStoreUrl(form.url);
    try { await persistFormBeforeRedirect(cleanedUrl); } catch (e) { console.error("[WpAuth] Pre-save failed:", e); }
    const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined;
    window.location.href = buildWpAppPasswordUrl({ storeUrl: cleanedUrl, storeId: store.id, returnTo });
  };

  const handleWpDisconnect = async () => {
    if (!store) return;
    setDisconnecting(true);
    try {
      await disconnectWpCredentials(store.id);
      toast({ title: "WordPress disconnected", description: "Media library access has been revoked." });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Disconnect failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setDisconnecting(false);
      setWpConfirmMode("idle");
    }
  };

  const handleDeleteSite = async () => {
    if (!store || deleteConfirmation !== store.name) return;
    setDeleting(true);
    try {
      await deleteStoreMutation.mutateAsync(store.id);
      toast({ title: "Site deleted", description: `${store.name} and all associated data removed.` });
      onSaved?.();
      onOpenChange(false);
      router.push("/projects");
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Site</DialogTitle>
          <DialogDescription>Manage site details, WooCommerce API, and WordPress media access.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Site basics */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className={isSuperAdmin ? "space-y-2" : "space-y-2 col-span-2"}>
                <Label htmlFor="edit-name">Site Name</Label>
                <Input id="edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url">Store URL</Label>
              <Input id="edit-url" value={form.url} onChange={(e) => { setForm({ ...form, url: e.target.value }); setUrlError(null); }} className={urlError ? "border-destructive" : ""} />
              {urlError && <p className="text-sm text-destructive">{urlError}</p>}
              <p className="text-xs text-muted-foreground">Changing the URL may break connections — you may need to re-authorize.</p>
            </div>
          </div>

          {/* Two-column: WooCommerce + WordPress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WooCommerce section */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="rounded-md bg-primary/10 p-1.5 mt-0.5"><ShoppingBag className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h4 className="text-sm font-semibold">WooCommerce API</h4>
                    <p className="text-xs text-muted-foreground">Products, orders, customers, taxonomy</p>
                  </div>
                </div>
                <StatusBadge variant={wcConnected ? "success" : "warning"}>{wcConnected ? "Connected" : "Not connected"}</StatusBadge>
              </div>

              <div className="flex items-center gap-1 pt-1">
                <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 gap-1.5" onClick={handleWooReauth}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs">{wcConnected ? "Re-authorize" : "Authorize"} (OAuth)</span>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)} className="h-8 px-2 ml-auto" title={showSecrets ? "Hide keys" : "Show keys"}>
                  {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-ck" className="text-xs text-muted-foreground">Consumer Key</Label>
                <div className="flex items-center gap-2">
                  <Input id="edit-ck" type={showSecrets ? "text" : "password"} value={form.consumer_key} onChange={(e) => setForm({ ...form, consumer_key: e.target.value })} placeholder="ck_..." className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(form.consumer_key, "ck")} disabled={!form.consumer_key} title="Copy">
                    {copiedField === "ck" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cs" className="text-xs text-muted-foreground">Consumer Secret</Label>
                <div className="flex items-center gap-2">
                  <Input id="edit-cs" type={showSecrets ? "text" : "password"} value={form.consumer_secret} onChange={(e) => setForm({ ...form, consumer_secret: e.target.value })} placeholder="cs_..." className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(form.consumer_secret, "cs")} disabled={!form.consumer_secret} title="Copy">
                    {copiedField === "cs" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* WordPress section */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="rounded-md bg-primary/10 p-1.5 mt-0.5"><ImageIcon className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h4 className="text-sm font-semibold">WordPress Media Access</h4>
                    <p className="text-xs text-muted-foreground">Browse and upload to the media library</p>
                  </div>
                </div>
                <StatusBadge variant={wpConnected ? "success" : "warning"}>
                  {wpConnected ? "Connected" : "Not connected"}
                </StatusBadge>
              </div>

              {!wpConnected && wcConnected && wpConfirmMode === "idle" && (
                <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/30 px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground leading-relaxed">
                    Media library upload and browsing requires a separate WordPress Application Password authorization.
                  </p>
                </div>
              )}

              {wpConfirmMode === "confirming" ? (
                <div className="space-y-3 rounded-md bg-destructive/5 border border-destructive/30 px-3 py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">Disconnect WordPress?</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This will revoke Proxima&apos;s media library access for <strong>{store?.name}</strong>. WooCommerce API credentials are not affected. You can re-authorize anytime.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" className="h-8" disabled={disconnecting} onClick={() => setWpConfirmMode("idle")}>
                      Cancel
                    </Button>
                    <Button type="button" variant="destructive" size="sm" className="h-8 gap-1.5" disabled={disconnecting} onClick={handleWpDisconnect}>
                      {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                      <span className="text-xs">{disconnecting ? "Disconnecting..." : "Yes, Disconnect"}</span>
                    </Button>
                  </div>
                </div>
              ) : wpConnected ? (
                <div className="flex items-center gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 gap-1.5" onClick={handleWpAuthorize}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="text-xs">Re-authorize</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setWpConfirmMode("confirming")}>
                    <Unlink className="h-3.5 w-3.5" />
                    <span className="text-xs">Disconnect</span>
                  </Button>
                </div>
              ) : (
                <div className="pt-1">
                  <Button type="button" variant="default" size="sm" className="h-8 px-3 gap-1.5" onClick={handleWpAuthorize}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="text-xs">Authorize WordPress</span>
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Opens a WordPress page where you grant Proxima media-library access. You&apos;ll be redirected back here.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone — Delete Site */}
          <div className="rounded-lg border border-destructive/40 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-destructive/20">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm" className="text-xs">
                  Type <span className="font-mono font-semibold">{store?.name}</span> to confirm deletion
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={store?.name || ""}
                  className="h-9"
                  disabled={deleting}
                />
                <p className="text-[11px] text-muted-foreground">Permanently deletes the site and all synced data. Cannot be undone.</p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9 gap-1.5"
                disabled={!store || deleteConfirmation !== store.name || deleting}
                onClick={handleDeleteSite}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span className="text-xs">{deleting ? "Deleting..." : "Delete Site"}</span>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || deleting || !form.name.trim() || !form.url.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}