import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUpdateStore } from "@/hooks/queries/useStores";
import { ExternalLink, Eye, EyeOff, Copy, Unlink, Store as StoreIcon, ImageIcon, Trash2 } from "lucide-react";

type StoreRecord = {
  id: string;
  name: string;
  url: string;
  consumer_key?: string | null;
  consumer_secret?: string | null;
  client_id?: string | null;
  wp_username?: string | null;
  wp_app_password?: string | null;
  timezone?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: StoreRecord | null;
  onStoreDeleted?: () => void;
}

export function EditSiteDialog({ open, onOpenChange, store, onStoreDeleted }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const updateStoreMutation = useUpdateStore();

  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [form, setForm] = useState({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "", timezone: "" });

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
        timezone: store.timezone || "",
      });
      setShowKey(false);
      setShowSecret(false);
      setConfirmDelete(false);
      setDeleteConfirmation("");
    }
  }, [store]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!store) throw new Error("No store");
      const res = await fetch(`/api/stores/${store.id}/delete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Delete failed");
      }
    },
    onSuccess: () => {
      toast({ title: "Site deleted" });
      qc.invalidateQueries({ queryKey: ["stores"] });
      onOpenChange(false);
      onStoreDeleted?.();
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const disconnectWp = async () => {
    if (!store) return;
    await updateStoreMutation.mutateAsync({ id: store.id, patch: { wp_username: null, wp_app_password: null } });
    toast({ title: "WordPress disconnected" });
  };

  const reauthorizeWoo = () => {
    if (!store) return;
    const ret = `${window.location.origin}/sites/${store.id}/settings`;
    const params = new URLSearchParams({
      app_name: "WooSync",
      scope: "read_write",
      user_id: store.id,
      return_url: ret,
      callback_url: `${window.location.origin}/api/woocommerce/callback`,
    });
    const cleanedUrl = store.url.replace(/\/$/, "");
    window.location.href = `${cleanedUrl}/wc-auth/v1/authorize?${params.toString()}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied` }));
  };

  const handleSave = async () => {
    if (!store) return;
    if (!form.name.trim() || !form.url.trim()) {
      toast({ title: "Name and URL are required", variant: "destructive" });
      return;
    }
    const cleanedUrl = form.url.trim().replace(/\/$/, "");
    try {
      await updateStoreMutation.mutateAsync({
        id: store.id,
        patch: {
          name: form.name.trim(),
          url: cleanedUrl,
          consumer_key: form.consumer_key.trim() || null,
          consumer_secret: form.consumer_secret.trim() || null,
          client_id: form.client_id || null,
          timezone: form.timezone.trim() || null,
        },
      });
      toast({ title: "Site updated" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  if (!store) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-1 pb-3">
          <DialogTitle className="text-lg">Edit Site</DialogTitle>
          <DialogDescription className="text-xs">Manage site details, WooCommerce API, and WordPress media access.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4 space-y-1">
              <Label htmlFor="edit-name" className="text-xs">Site Name</Label>
              <Input id="edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" />
            </div>
            <div className="col-span-5 space-y-1">
              <Label htmlFor="edit-url" className="text-xs">Store URL</Label>
              <Input id="edit-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="h-9 text-sm font-mono" />
            </div>
            <div className="col-span-3 space-y-1">
              <Label htmlFor="edit-client" className="text-xs">Client</Label>
              <select
                id="edit-client"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Unassigned</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 space-y-1">
              <Label htmlFor="edit-tz" className="text-xs">Store Timezone</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-tz"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  placeholder="e.g. Asia/Kuwait (leave blank to use viewer's browser timezone)"
                  className="h-9 text-sm font-mono"
                  list="tz-suggestions"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs shrink-0"
                  onClick={() => {
                    try {
                      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      setForm((f) => ({ ...f, timezone: tz }));
                    } catch { /* ignore */ }
                  }}
                >
                  Use mine
                </Button>
              </div>
              <datalist id="tz-suggestions">
                <option value="Asia/Kuwait" />
                <option value="Asia/Dubai" />
                <option value="Asia/Riyadh" />
                <option value="Asia/Qatar" />
                <option value="Asia/Bahrain" />
                <option value="Europe/London" />
                <option value="Europe/Paris" />
                <option value="America/New_York" />
                <option value="America/Los_Angeles" />
                <option value="UTC" />
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0"><StoreIcon className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">WooCommerce API</div>
                    <div className="text-[11px] text-muted-foreground truncate">Products, orders, customers, taxonomy</div>
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${wcConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {wcConnected ? "Connected" : "Not set"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={reauthorizeWoo}>
                  <ExternalLink className="h-3 w-3 mr-1" />Re-authorize (OAuth)
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={() => { setShowKey(!showKey); setShowSecret(!showSecret); }}>
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Consumer Key</Label>
                  <div className="flex gap-1.5">
                    <Input type={showKey ? "text" : "password"} value={form.consumer_key} onChange={(e) => setForm({ ...form, consumer_key: e.target.value })} className="h-8 text-xs font-mono" />
                    {form.consumer_key && <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => copyToClipboard(form.consumer_key, "Consumer Key")}><Copy className="h-3 w-3" /></Button>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Consumer Secret</Label>
                  <div className="flex gap-1.5">
                    <Input type={showSecret ? "text" : "password"} value={form.consumer_secret} onChange={(e) => setForm({ ...form, consumer_secret: e.target.value })} className="h-8 text-xs font-mono" />
                    {form.consumer_secret && <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => copyToClipboard(form.consumer_secret, "Consumer Secret")}><Copy className="h-3 w-3" /></Button>}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0"><ImageIcon className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">WordPress Media Access</div>
                    <div className="text-[11px] text-muted-foreground truncate">Browse and upload to the media library</div>
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${wpConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {wpConnected ? "Connected" : "Not set"}
                </span>
              </div>
              {wpConnected ? (
                <>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">Username: {store.wp_username}</div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.push(`/sites/connect/${store.id}?tab=wp`)}>
                      <ExternalLink className="h-3 w-3 mr-1" />Re-authorize
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive ml-auto" onClick={disconnectWp}>
                      <Unlink className="h-3 w-3 mr-1" />Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <div>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs w-full" onClick={() => router.push(`/sites/connect/${store.id}?tab=wp`)}>
                    <ExternalLink className="h-3 w-3 mr-1" />Connect WordPress
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            {!confirmDelete ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-destructive">Danger zone</div>
                  <div className="text-[11px] text-muted-foreground">Permanently delete this site and all synced data.</div>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3 w-3 mr-1" />Delete site
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-destructive">Are you sure? This cannot be undone.</div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={deleting}
                    onClick={async () => { setDeleting(true); try { await deleteMutation.mutateAsync(); } finally { setDeleting(false); } }}
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={updateStoreMutation.isPending}>
            {updateStoreMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}