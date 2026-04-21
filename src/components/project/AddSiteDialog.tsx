import { useState, useMemo, useEffect, useRef } from "react";
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
import { Eye, EyeOff, AlertTriangle, ExternalLink, HelpCircle, CheckCircle2, PlayCircle } from "lucide-react";
import { buildWooCommerceAuthUrl, validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { useCreateStore } from "@/hooks/queries/useStores";
import type { Client } from "@/services/clientService";
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
  const createStoreMutation = useCreateStore();
  const [creating, setCreating] = useState(false);
  const submitLock = useRef(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"oauth" | "manual">("oauth");
  const [showSecrets, setShowSecrets] = useState(false);
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [existingIncomplete, setExistingIncomplete] = useState<{ id: string; name: string } | null>(null);
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

  // Debounced check for existing incomplete site with matching URL
  useEffect(() => {
    const v = validateStoreUrl(newStore.url);
    if (!v.valid || !v.cleanedUrl) {
      setExistingIncomplete(null);
      return;
    }
    const cleaned = v.cleanedUrl;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, url, onboarding_completed_at")
        .ilike("url", cleaned)
        .is("onboarding_completed_at", null)
        .limit(1)
        .maybeSingle();
      if (data) setExistingIncomplete({ id: data.id, name: data.name });
      else setExistingIncomplete(null);
    }, 400);
    return () => clearTimeout(t);
  }, [newStore.url]);

  const reset = () => {
    setNewStore({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });
    setUrlError(null);
    setAuthMode("oauth");
    setShowSecrets(false);
    setManualConfirmed(false);
    setExistingIncomplete(null);
  };

  const handleSelectManual = () => {
    if (authMode === "manual") return;
    if (!manualConfirmed) {
      const ok = window.confirm(
        "Manual Keys is an advanced option.\n\nOnly use this if:\n• You're experienced with WooCommerce REST API\n• OAuth keeps failing for your store\n\nYou'll need to manually create API keys with Read/Write permission in your store admin.\n\nContinue?"
      );
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
      setUrlError(validation.error || "Invalid URL");
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
      alert(`Error creating store: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      submitLock.current = false;
      setCreating(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle>Connect WooCommerce Store</DialogTitle>
          <DialogDescription className="text-xs">Add a store and authorize Proxima to access it.</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-foreground leading-snug">
            <span className="font-medium">Disable ad blockers</span> — they can block the callback.
          </p>
        </div>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className={isSuperAdmin ? "space-y-1.5" : "space-y-1.5 col-span-2"}>
              <Label htmlFor="store-name" className="text-xs">Site Name</Label>
              <Input id="store-name" placeholder="My Store" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} className="h-9" />
            </div>
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="client" className="text-xs">Client (Optional)</Label>
                <Select value={newStore.client_id} onValueChange={(value) => setNewStore({ ...newStore, client_id: value })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-url" className="text-xs">Store URL</Label>
            <Input id="store-url" placeholder="https://mystore.com" value={newStore.url} onChange={(e) => { setNewStore({ ...newStore, url: e.target.value }); setUrlError(null); }} className={`h-9 ${urlError ? "border-destructive" : ""}`} />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            {newStore.url.trim() && !urlError && !existingIncomplete && (
              <p className="text-[11px] text-muted-foreground">Connecting to: <span className="font-mono text-foreground">{cleanStoreUrl(newStore.url)}</span></p>
            )}
            {existingIncomplete && (
              <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Setup already in progress</p>
                  <p className="text-[11px] text-muted-foreground">
                    You started adding <span className="font-semibold">{existingIncomplete.name}</span> but haven&apos;t finished. Resume instead of creating a duplicate.
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
                  <span className="text-xs">Resume</span>
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <Label className="text-xs">Authentication Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAuthMode("oauth")} className={`relative p-2.5 rounded-lg border-2 text-left transition-colors ${authMode === "oauth" ? "border-success bg-success/5" : "border-border hover:border-muted-foreground/50"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-medium text-xs">OAuth</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-success/15 text-success uppercase tracking-wide">Easy</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Redirect to store for approval</p>
              </button>
              <button type="button" onClick={handleSelectManual} className={`relative p-2.5 rounded-lg border text-left transition-colors ${authMode === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-medium text-xs">Manual Keys</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">Advanced</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Enter API keys directly</p>
              </button>
            </div>
          </div>

          {authMode === "manual" && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">WooCommerce API Keys</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1.5 text-xs">
                        <p className="font-semibold">How to create API keys:</p>
                        <ol className="list-decimal pl-4 space-y-0.5">
                          <li>In WooCommerce: Settings → Advanced → REST API</li>
                          <li>Click <span className="font-mono">Add key</span></li>
                          <li>Description: <span className="font-mono">Proxima</span></li>
                          <li>User: any admin user</li>
                          <li><span className="font-semibold text-success">Permissions: Read/Write</span> (required)</li>
                          <li>Click Generate API key</li>
                          <li>Copy the <span className="font-mono">ck_</span> and <span className="font-mono">cs_</span> values here</li>
                        </ol>
                        <p className="text-[11px] text-muted-foreground pt-1">Read-only keys will cause sync and webhook registration to fail.</p>
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
                <p className="text-[11px] text-foreground">Key must have <span className="font-semibold">Read/Write</span> permission</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Consumer Key (ck_...)" type={showSecrets ? "text" : "password"} value={newStore.consumer_key} onChange={(e) => setNewStore({ ...newStore, consumer_key: e.target.value })} className="h-9 font-mono text-xs" />
                <Input placeholder="Consumer Secret (cs_...)" type={showSecrets ? "text" : "password"} value={newStore.consumer_secret} onChange={(e) => setNewStore({ ...newStore, consumer_secret: e.target.value })} className="h-9 font-mono text-xs" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">WooCommerce → Settings → Advanced → REST API</p>
                {wcRestApiUrl && (
                  <a href={wcRestApiUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0">
                    Open in store <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {authMode === "oauth" && (
            <div className="rounded-md bg-success/5 border border-success/20 px-3 py-2 text-xs text-foreground">
              You&apos;ll be redirected to your WooCommerce store to approve access. API credentials will be generated automatically with the correct permissions.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm" disabled={creating}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !newStore.name.trim() || !newStore.url.trim() || !!existingIncomplete} size="sm">
            {creating ? (authMode === "oauth" ? "Redirecting…" : "Creating…") : authMode === "oauth" ? "Connect Store" : "Add Site"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}