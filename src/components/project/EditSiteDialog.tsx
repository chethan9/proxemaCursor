import { useState, useEffect } from "react";
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
import { Eye, EyeOff, ExternalLink, Copy, Check } from "lucide-react";
import { buildWooCommerceAuthUrl, validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { useUpdateStore } from "@/hooks/queries/useStores";
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
  const updateStoreMutation = useUpdateStore();
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });

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
      alert(`Error updating site: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReauth = async () => {
    if (!store) return;
    const validation = validateStoreUrl(form.url);
    if (!validation.valid) {
      setUrlError(validation.error || "Invalid URL");
      return;
    }
    const cleanedUrl = validation.cleanedUrl || cleanStoreUrl(form.url);
    try {
      if (form.name.trim() !== store.name || cleanedUrl !== store.url || (form.client_id || null) !== store.client_id) {
        await updateStoreMutation.mutateAsync({
          id: store.id,
          patch: { name: form.name.trim(), url: cleanedUrl, client_id: form.client_id || null },
        });
      }
    } catch (e) {
      console.error("[ReAuth] Pre-save failed:", e);
    }
    const authUrl = buildWooCommerceAuthUrl({ storeUrl: cleanedUrl, storeId: store.id });
    window.location.href = authUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit Site</DialogTitle>
          <DialogDescription>Update site details and API credentials.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
            <p className="text-xs text-muted-foreground">Changing the URL may break the connection — you may need to re-authorize.</p>
          </div>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label>API Credentials</Label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 gap-1.5" onClick={handleReauth} title="Re-authorize via OAuth">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs">Re-authorize (OAuth)</span>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)} className="h-8 px-2">
                  {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">Edit keys manually below, or click Re-authorize to regenerate via WooCommerce OAuth.</p>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.url.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}