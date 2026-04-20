import { useState } from "react";
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
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import { buildWooCommerceAuthUrl, validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { useCreateStore } from "@/hooks/queries/useStores";
import type { Client } from "@/services/clientService";
import { useRouter } from "next/router";

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
  const [urlError, setUrlError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"oauth" | "manual">("oauth");
  const [showSecrets, setShowSecrets] = useState(false);
  const [newStore, setNewStore] = useState({
    name: "",
    url: "",
    consumer_key: "",
    consumer_secret: "",
    client_id: "",
  });

  const reset = () => {
    setNewStore({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });
    setUrlError(null);
    setAuthMode("oauth");
    setShowSecrets(false);
  };

  const handleCreate = async () => {
    if (!newStore.name.trim() || !newStore.url.trim()) return;
    const validation = validateStoreUrl(newStore.url);
    if (!validation.valid) {
      setUrlError(validation.error || "Invalid URL");
      return;
    }
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
      } else {
        reset();
        onOpenChange(false);
        onCreated?.();
        // Route manual flow through the unified connect wizard (WP auth → estimate → liftoff → celebration)
        router.push(`/sites/connect/${store.id}?success=1&manual=1`);
      }
    } catch (error) {
      console.error("[AddSite] Error:", error);
      alert(`Error creating store: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect WooCommerce Store</DialogTitle>
          <DialogDescription>Add a store and authorize Proxima to access it.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-medium">Disable ad blockers</span> (uBlock, AdGuard, Brave Shields) for this page. They can block the WooCommerce callback and webhook registration, leaving your site stuck in &ldquo;pending&rdquo;.
          </p>
        </div>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className={isSuperAdmin ? "space-y-2" : "space-y-2 col-span-2"}>
              <Label htmlFor="store-name">Site Name</Label>
              <Input id="store-name" placeholder="My Store" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} />
            </div>
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label htmlFor="client">Client (Optional)</Label>
                <Select value={newStore.client_id} onValueChange={(value) => setNewStore({ ...newStore, client_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-url">Store URL</Label>
            <Input id="store-url" placeholder="https://mystore.com" value={newStore.url} onChange={(e) => { setNewStore({ ...newStore, url: e.target.value }); setUrlError(null); }} className={urlError ? "border-destructive" : ""} />
            {urlError && <p className="text-sm text-destructive">{urlError}</p>}
            {newStore.url.trim() && !urlError && (
              <p className="text-xs text-muted-foreground">Will connect to: <span className="font-mono text-foreground">{cleanStoreUrl(newStore.url)}</span></p>
            )}
          </div>
          <div className="space-y-3 pt-2">
            <Label>Authentication Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setAuthMode("oauth")} className={`p-3 rounded-lg border text-left transition-colors ${authMode === "oauth" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}>
                <p className="font-medium text-sm">OAuth (Recommended)</p>
                <p className="text-xs text-muted-foreground mt-1">Redirect to store for approval</p>
              </button>
              <button type="button" onClick={() => setAuthMode("manual")} className={`p-3 rounded-lg border text-left transition-colors ${authMode === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}>
                <p className="font-medium text-sm">Manual Keys</p>
                <p className="text-xs text-muted-foreground mt-1">Enter API keys directly</p>
              </button>
            </div>
          </div>
          {authMode === "manual" && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label>WooCommerce API Keys</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)} className="h-8 px-2">
                  {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Input placeholder="Consumer Key (ck_...)" type={showSecrets ? "text" : "password"} value={newStore.consumer_key} onChange={(e) => setNewStore({ ...newStore, consumer_key: e.target.value })} />
              <Input placeholder="Consumer Secret (cs_...)" type={showSecrets ? "text" : "password"} value={newStore.consumer_secret} onChange={(e) => setNewStore({ ...newStore, consumer_secret: e.target.value })} />
              <p className="text-xs text-muted-foreground">Find these in WooCommerce → Settings → Advanced → REST API</p>
            </div>
          )}
          {authMode === "oauth" && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <p>You&apos;ll be redirected to your WooCommerce store to approve access. API credentials will be generated automatically.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !newStore.name.trim() || !newStore.url.trim()}>
            {creating ? "Creating..." : authMode === "oauth" ? "Connect Store" : "Add Site"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}