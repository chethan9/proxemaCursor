import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
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
  const { t } = useTranslation("common");
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
    if (!v.valid) { setUrlError(v.error || t("incompleteSite.invalidUrl")); return; }
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: store.id,
        patch: {
          name: name.trim(),
          url: v.cleanedUrl || cleanStoreUrl(url),
          client_id: clientId || null,
        },
      });
      toast({ title: t("incompleteSite.updated") });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: t("incompleteSite.updateFailed"), description: e instanceof Error ? e.message : t("errors.unknownError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("incompleteSite.title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("incompleteSite.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inc-name" className="text-xs">{t("incompleteSite.siteName")}</Label>
            <Input id="inc-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-url" className="text-xs">{t("incompleteSite.storeUrl")}</Label>
            <Input id="inc-url" value={url} onChange={(e) => { setUrl(e.target.value); setUrlError(null); }} className={`h-9 ${urlError ? "border-destructive" : ""}`} />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("incompleteSite.client")}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={t("incompleteSite.unassigned")} /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{t("incompleteSite.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || !url.trim()}>
            {saving ? t("incompleteSite.saving") : t("incompleteSite.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}