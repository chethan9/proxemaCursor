import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "next-i18next";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, EyeOff, AlertTriangle, ExternalLink, HelpCircle, CheckCircle2, PlayCircle, Copy } from "lucide-react";
import { buildWooCommerceAuthUrl, validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { useCreateStore } from "@/hooks/queries/useStores";
import type { Client } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  isSuperAdmin: boolean;
  onCreated?: () => void;
}

export function AddSiteDialog({ open, onOpenChange, clients, isSuperAdmin, onCreated }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("common");
  const createStoreMutation = useCreateStore();
  const [creating, setCreating] = useState(false);
  const submitLock = useRef(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"oauth" | "manual">("oauth");
  const [showSecrets, setShowSecrets] = useState(false);
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [existingIncomplete, setExistingIncomplete] = useState<{ id: string; name: string } | null>(null);
  const [existingDuplicate, setExistingDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [duplicateConfirmText, setDuplicateConfirmText] = useState("");
  const [newStore, setNewStore] = useState({
    name: "",
    url: "",
    consumer_key: "",
    consumer_secret: "",
    client_id: "",
  });

  const wcRestApiUrl = useMemo(() => {
    if (!newStore.url.trim()) return null;
    const v = validateStoreUrl(newStore.url);
    if (!v.valid) return null;
    const base = v.cleanedUrl || cleanStoreUrl(newStore.url);
    return `${base}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys`;
  }, [newStore.url]);

  useEffect(() => {
    const v = validateStoreUrl(newStore.url);
    if (!v.valid || !v.cleanedUrl) {
      setExistingIncomplete(null);
      setExistingDuplicate(null);
      return;
    }
    const cleaned = v.cleanedUrl;
    const tm = setTimeout(async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, url, onboarding_completed_at")
        .ilike("url", cleaned)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && !data.onboarding_completed_at) {
        setExistingIncomplete({ id: data.id, name: data.name });
        setExistingDuplicate(null);
      } else if (data && data.onboarding_completed_at) {
        setExistingDuplicate({ id: data.id, name: data.name });
        setExistingIncomplete(null);
      } else {
        setExistingIncomplete(null);
        setExistingDuplicate(null);
      }
    }, 400);
    return () => clearTimeout(tm);
  }, [newStore.url]);

  const reset = () => {
    setNewStore({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });
    setUrlError(null);
    setAuthMode("oauth");
    setShowSecrets(false);
    setManualConfirmed(false);
    setExistingIncomplete(null);
    setExistingDuplicate(null);
    setDuplicateConfirmText("");
  };

  const handleSelectManual = () => {
    if (authMode === "manual") return;
    if (!manualConfirmed) {
      const ok = window.confirm(t("addSite.manualConfirm"));
      if (!ok) return;
      setManualConfirmed(true);
    }
    setAuthMode("manual");
  };

  const handleCreate = async () => {
    if (submitLock.current || creating) return;
    if (!newStore.name.trim() || !newStore.url.trim()) return;
    const validation = validateStoreUrl(newStore.url);
    if (!validation.valid) {
      setUrlError(validation.error || t("addSite.invalidUrl"));
      return;
    }
    submitLock.current = true;
    const cleanedUrl = validation.cleanedUrl || cleanStoreUrl(newStore.url);
    setUrlError(null);
    setCreating(true);
    try {
      const hasKeys = authMode === "manual" && newStore.consumer_key.trim() && newStore.consumer_secret.trim();
      const store = await createStoreMutation.mutateAsync({
        name: newStore.name.trim(),
        url: cleanedUrl,
        consumer_key: hasKeys ? newStore.consumer_key.trim() : null,
        consumer_secret: hasKeys ? newStore.consumer_secret.trim() : null,
        client_id: newStore.client_id || null,
        status: hasKeys ? "connected" : "pending",
      });

      if (authMode === "oauth") {
        const authUrl = buildWooCommerceAuthUrl({ storeUrl: cleanedUrl, storeId: store.id });
        window.location.href = authUrl;
        return;
      } else {
        reset();
        onOpenChange(false);
        onCreated?.();
        router.push(`/sites/connect/${store.id}?success=1&manual=1`);
      }
    } catch (error) {
      console.error("[AddSite] Error:", error);
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      const isQuota = /plan|upgrade|quota|limit/i.test(msg);
      toast({
        title: isQuota ? t("addSite.planLimitReached") : t("addSite.failedToCreate"),
        description: msg,
        variant: "destructive",
        action: isQuota ? (
          <ToastAction altText={t("addSite.upgrade")} onClick={() => router.push("/pricing")}>
            {t("addSite.upgrade")}
          </ToastAction>
        ) : undefined,
      });
      submitLock.current = false;
      setCreating(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle>{t("addSite.title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("addSite.description")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-foreground leading-snug">
            <span className="font-medium">{t("addSite.adBlockerWarning")}</span> — {t("addSite.adBlockerDetail")}
          </p>
        </div>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className={isSuperAdmin ? "space-y-1.5" : "space-y-1.5 col-span-2"}>
              <Label htmlFor="store-name" className="text-xs">{t("addSite.siteName")}</Label>
              <Input id="store-name" placeholder={t("addSite.siteNamePlaceholder")} value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} className="h-9" />
            </div>
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="client" className="text-xs">{t("addSite.clientOptional")}</Label>
                <Select value={newStore.client_id} onValueChange={(value) => setNewStore({ ...newStore, client_id: value })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={t("addSite.selectClient")} /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-url" className="text-xs">{t("addSite.storeUrl")}</Label>
            <Input id="store-url" placeholder={t("addSite.storeUrlPlaceholder")} value={newStore.url} onChange={(e) => { setNewStore({ ...newStore, url: e.target.value }); setUrlError(null); }} className={`h-9 ${urlError ? "border-destructive" : ""}`} />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            {newStore.url.trim() && !urlError && !existingIncomplete && (
              <p className="text-[11px] text-muted-foreground">{t("addSite.connectingTo")} <span className="font-mono text-foreground">{cleanStoreUrl(newStore.url)}</span></p>
            )}
            {existingIncomplete && (
              <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{t("addSite.setupInProgress")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("addSite.setupInProgressDesc", { name: existingIncomplete.name })}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-2 gap-1 shrink-0"
                  onClick={() => {
                    const sid = existingIncomplete.id;
                    onOpenChange(false);
                    reset();
                    router.push(`/sites/connect/${sid}?resume=1`);
                  }}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("addSite.resume")}</span>
                </Button>
              </div>
            )}
            {existingDuplicate && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 space-y-2">
                <div className="flex items-start gap-2">
                  <Copy className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-destructive">Site already exists</p>
                    <p className="text-[11px] text-foreground/80">
                      <span className="font-medium">{existingDuplicate.name}</span> is already connected with this URL. Adding a duplicate will count toward your plan&apos;s site quota and may cause sync conflicts.
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-foreground/80">
                    Type <span className="font-mono font-semibold text-destructive">ADD ANYWAY</span> to confirm:
                  </Label>
                  <Input
                    value={duplicateConfirmText}
                    onChange={(e) => setDuplicateConfirmText(e.target.value)}
                    placeholder="ADD ANYWAY"
                    className="h-8 font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <Label className="text-xs">{t("addSite.authMethod")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAuthMode("oauth")} className={`relative p-2.5 rounded-lg border-2 text-left transition-colors ${authMode === "oauth" ? "border-success bg-success/5" : "border-border hover:border-muted-foreground/50"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-medium text-xs">{t("addSite.oauth")}</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-success/15 text-success uppercase tracking-wide">{t("addSite.oauthBadge")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{t("addSite.oauthDesc")}</p>
              </button>
              <button type="button" onClick={handleSelectManual} className={`relative p-2.5 rounded-lg border text-left transition-colors ${authMode === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-medium text-xs">{t("addSite.manual")}</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">{t("addSite.manualBadge")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{t("addSite.manualDesc")}</p>
              </button>
            </div>
          </div>

          {authMode === "manual" && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">{t("addSite.apiKeys")}</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1.5 text-xs">
                        <p className="font-semibold">{t("addSite.apiKeysHelpTitle")}</p>
                        <ol className="list-decimal pl-4 space-y-0.5">
                          <li>{t("addSite.apiKeysHelpStep1")}</li>
                          <li>{t("addSite.apiKeysHelpStep2")}</li>
                          <li>{t("addSite.apiKeysHelpStep3")}</li>
                          <li>{t("addSite.apiKeysHelpStep4")}</li>
                          <li className="font-semibold text-success">{t("addSite.apiKeysHelpStep5")}</li>
                          <li>{t("addSite.apiKeysHelpStep6")}</li>
                          <li>{t("addSite.apiKeysHelpStep7")}</li>
                        </ol>
                        <p className="text-[11px] text-muted-foreground pt-1">{t("addSite.apiKeysHelpFooter")}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)} className="h-7 px-2">
                  {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="rounded-md bg-success/5 border border-success/30 px-2.5 py-1.5 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                <p className="text-[11px] text-foreground">{t("addSite.readWritePermission")} <span className="font-semibold">{t("addSite.readWrite")}</span> {t("addSite.permission")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("addSite.consumerKey")} type={showSecrets ? "text" : "password"} value={newStore.consumer_key} onChange={(e) => setNewStore({ ...newStore, consumer_key: e.target.value })} className="h-9 font-mono text-xs" />
                <Input placeholder={t("addSite.consumerSecret")} type={showSecrets ? "text" : "password"} value={newStore.consumer_secret} onChange={(e) => setNewStore({ ...newStore, consumer_secret: e.target.value })} className="h-9 font-mono text-xs" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">{t("addSite.restApiPath")}</p>
                {wcRestApiUrl && (
                  <a href={wcRestApiUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0">
                    {t("addSite.openInStore")} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {authMode === "oauth" && (
            <div className="rounded-md bg-success/5 border border-success/20 px-3 py-2 text-xs text-foreground">
              {t("addSite.oauthRedirectInfo")}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm" disabled={creating}>{t("addSite.cancel")}</Button>
          <Button
            onClick={handleCreate}
            disabled={
              creating ||
              !newStore.name.trim() ||
              !newStore.url.trim() ||
              !!existingIncomplete ||
              (!!existingDuplicate && duplicateConfirmText.trim() !== "ADD ANYWAY")
            }
            size="sm"
            variant={existingDuplicate ? "destructive" : "default"}
          >
            {creating
              ? authMode === "oauth"
                ? t("addSite.redirecting")
                : t("addSite.creating")
              : existingDuplicate
              ? "Add duplicate site"
              : authMode === "oauth"
              ? t("addSite.connectStore")
              : t("addSite.addSite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}