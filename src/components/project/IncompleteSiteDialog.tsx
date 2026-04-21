import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2 } from "lucide-react";
import { validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { useUpdateStore } from "@/hooks/queries/useStores";
import { supabase } from "@/integrations/supabase/client";
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
  const updateStoreMutation = useUpdateStore();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", url: "", client_id: "" });
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setForm({ name: store.name, url: store.url, client_id: store.client_id || "" });
      setUrlError(null);
    }
  }, [store]);

  const handleSave = async () => {
    if (!store || !form.name.trim() || !form.url.trim()) return;
    const validation = validateStoreUrl(form.url);
    if (!validation.valid) { setUrlError(validation.error || "Invalid URL"); return; }
    const cleanedUrl = validation.cleanedUrl || cleanStoreUrl(form.url);

    // Check duplicate URL within same client scope
    const scopeClientId = form.client_id || store.client_id;
    if (cleanedUrl !== store.url) {
      const q = supabase.from("stores").select("id").eq("url", cleanedUrl).neq("id", store.id);
      if (scopeClientId) q.eq("client_id", scopeClientId);
      const { data: dupes } = await q;
      if (dupes && dupes.length > 0) {
        setUrlError("Another site already uses this URL");
        return;
      }
    }

    setSaving(true);
    try {
      await updateStoreMutation.mutateAsync({
        id: store.id,
        patch: {
          name: form.name.trim(),
          url: cleanedUrl,
          client_id: form.client_id || null,
        },
      });
      toast({ title: "Site updated", description: "You can now resume setup." });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Incomplete Site</DialogTitle>
          <DialogDescription>
            Correct the name or URL before resuming setup. Since this site was never connected, changes won&apos;t affect any synced data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="inc-name">Site Name</Label>
            <Input id="inc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inc-url">Store URL</Label>
            <Input
              id="inc-url"
              value={form.url}
              onChange={(e) => { setForm({ ...form, url: e.target.value }); setUrlError(null); }}
              placeholder="https://example.com"
              className={urlError ? "border-destructive" : ""}
            />
            {urlError && <p className="text-sm text-destructive">{urlError}</p>}
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.url.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}