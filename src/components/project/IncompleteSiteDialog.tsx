import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { useUpdateStore } from "@/hooks/queries/useStores";
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

export function IncompleteSiteDialog({ open, onOpenChange, store, clients, isSuperAdmin, onSaved }: Props) {
  const { toast } = useToast();
  const updateMutation = useUpdateStore();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setName(store.name);
      setUrl(store.url);
      setClientId(store.client_id || "");
      setUrlError(null);
    }
  }, [store]);

  const handleSave = async () => {
    if (!store) return;
    if (!name.trim() || !url.trim()) return;
    const v = validateStoreUrl(url);
    if (!v.valid) { setUrlError(v.error || "Invalid URL"); return; }
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: store.id,
        updates: {
          name: name.trim(),
          url: v.cleanedUrl || cleanStoreUrl(url),
          client_id: clientId || null,
        },
      });
      toast({ title: "Updated" });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit incomplete setup</DialogTitle>
          <DialogDescription className="text-xs">
            Update basic info before resuming. Credentials and webhooks will be configured when you resume setup.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inc-name" className="text-xs">Site Name</Label>
            <Input id="inc-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-url" className="text-xs">Store URL</Label>
            <Input id="inc-url" value={url} onChange={(e) => { setUrl(e.target.value); setUrlError(null); }} className={`h-9 ${urlError ? "border-destructive" : ""}`} />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || !url.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}