import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateApiToken } from "@/lib/api-auth";
import { ArrowLeft, Copy, Check, Plus, Trash2, Key, Store, RefreshCw, Shield, Pencil, Link2, Unlink } from "lucide-react";

interface Client {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ApiToken {
  id: string;
  name: string;
  prefix: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface ClientStore {
  id: string;
  name: string;
  url: string;
  status: string;
  last_sync_at: string | null;
  client_id: string | null;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [client, setClient] = useState<Client | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [stores, setStores] = useState<ClientStore[]>([]);
  const [unassignedStores, setUnassignedStores] = useState<ClientStore[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (id && typeof id === "string") loadClientData(id);
  }, [id]);

  async function loadClientData(clientId: string) {
    setLoading(true);
    const [clientRes, tokensRes, storesRes, unassignedRes] = await Promise.all([
      supabase.from("clients").select("id, name, created_at, updated_at").eq("id", clientId).single(),
      supabase.from("api_tokens").select("id, name, prefix, created_at, last_used_at, expires_at, revoked_at").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name, url, status, last_sync_at, client_id").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name, url, status, last_sync_at, client_id").is("client_id", null).order("created_at", { ascending: false }),
    ]);
    if (clientRes.data) {
      setClient(clientRes.data);
      setEditName(clientRes.data.name);
    }
    setTokens(tokensRes.data || []);
    setStores((storesRes.data || []) as ClientStore[]);
    setUnassignedStores((unassignedRes.data || []) as ClientStore[]);
    setLoading(false);
  }

  async function handleSaveName() {
    if (!id || !editName.trim() || !client) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ name: editName.trim(), updated_at: new Date().toISOString() })
        .eq("id", client.id);
      if (error) throw error;
      setEditOpen(false);
      await loadClientData(client.id);
    } catch (err) {
      console.error("Update client error:", err);
    } finally {
      setSavingName(false);
    }
  }

  async function handleLinkSite() {
    if (!id || !selectedSiteId) return;
    setLinking(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ client_id: id as string, updated_at: new Date().toISOString() })
        .eq("id", selectedSiteId);
      if (error) throw error;
      setLinkOpen(false);
      setSelectedSiteId("");
      await loadClientData(id as string);
    } catch (err) {
      console.error("Link site error:", err);
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkSite(siteId: string) {
    if (!confirm("Unlink this site from the client? The site will remain, but will no longer belong to this client.")) return;
    try {
      const { error } = await supabase
        .from("stores")
        .update({ client_id: null, updated_at: new Date().toISOString() })
        .eq("id", siteId);
      if (error) throw error;
      if (id) await loadClientData(id as string);
    } catch (err) {
      console.error("Unlink site error:", err);
    }
  }

  async function handleCreateToken() {
    if (!id || !newTokenName.trim()) return;
    setCreating(true);
    try {
      const { plain, hash, prefix } = generateApiToken();
      const { error } = await supabase.from("api_tokens").insert({
        client_id: id as string,
        name: newTokenName.trim(),
        token: plain,
        token_hash: hash,
        prefix: prefix,
      });
      if (error) throw error;
      setCreatedToken(plain);
      setNewTokenName("");
      await loadClientData(id as string);
    } catch (err) {
      console.error("Token creation error:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeToken(tokenId: string) {
    if (!confirm("Revoke this token? Any app using it will lose access.")) return;
    await supabase.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tokenId);
    if (id) await loadClientData(id as string);
  }

  function copyToken() {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return (
      <AppLayout title="Client">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout title="Client">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Client not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/clients")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Clients
          </Button>
        </div>
      </AppLayout>
    );
  }

  const activeTokens = tokens.filter(t => !t.revoked_at);
  const revokedTokens = tokens.filter(t => t.revoked_at);

  return (
    <AppLayout title="Client">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/clients")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              <p className="text-sm text-muted-foreground">
                Created {formatDate(client.created_at)} · {stores.length} site{stores.length !== 1 ? "s" : ""} · {activeTokens.length} active token{activeTokens.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" /> Sites
                </CardTitle>
                <CardDescription>WooCommerce sites linked to this client</CardDescription>
              </div>
              <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={unassignedStores.length === 0}>
                    <Link2 className="h-4 w-4 mr-2" /> Link Site
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link Site to {client.name}</DialogTitle>
                    <DialogDescription>
                      Select an existing site not yet assigned to any client.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    {unassignedStores.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No unassigned sites available. Create a site from the Sites page first.</p>
                    ) : (
                      <div className="space-y-2">
                        <Label>Unassigned Site</Label>
                        <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a site..." />
                          </SelectTrigger>
                          <SelectContent>
                            {unassignedStores.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} — {s.url}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
                    <Button onClick={handleLinkSite} disabled={!selectedSiteId || linking}>
                      {linking ? "Linking..." : "Link Site"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {stores.length === 0 ? (
              <div className="text-center py-8">
                <Store className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No sites linked yet</p>
                <Button variant="outline" size="sm" onClick={() => router.push("/sites")}>
                  Go to Sites
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{store.name}</p>
                          <p className="text-xs text-muted-foreground">{store.url}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={store.status === "connected" ? "default" : "secondary"} className={store.status === "connected" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : ""}>
                          {store.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(store.last_sync_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/sites/${store.id}`)}>View</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Unlink" onClick={() => handleUnlinkSite(store.id)}>
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" /> API Tokens
                </CardTitle>
                <CardDescription>Bearer tokens for Flutter app or external API access. Each token can only access this client&apos;s data.</CardDescription>
              </div>
              <Dialog open={showCreateToken} onOpenChange={(open) => { setShowCreateToken(open); if (!open) setCreatedToken(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Create Token</Button>
                </DialogTrigger>
                <DialogContent>
                  {createdToken ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>Token Created</DialogTitle>
                        <DialogDescription>Copy this token now. It will not be shown again.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Alert className="bg-amber-50 border-amber-200">
                          <Shield className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            Store this token securely. It provides full API access to this client&apos;s data.
                          </AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-muted p-3 rounded-md font-mono break-all select-all">{createdToken}</code>
                          <Button variant="outline" size="icon" onClick={copyToken}>
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => { setShowCreateToken(false); setCreatedToken(null); }}>Done</Button>
                      </DialogFooter>
                    </>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>Create API Token</DialogTitle>
                        <DialogDescription>Generate a bearer token for API access. Name it to identify its purpose.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="token-name">Token Name</Label>
                          <Input id="token-name" placeholder="e.g. Flutter App Production" value={newTokenName} onChange={e => setNewTokenName(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateToken(false)}>Cancel</Button>
                        <Button onClick={handleCreateToken} disabled={!newTokenName.trim() || creating}>
                          {creating ? "Creating..." : "Generate Token"}
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <div className="text-center py-8">
                <Key className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No tokens yet. Create one to access the API.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTokens.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeTokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell className="font-medium">{token.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{token.prefix || "—"}...</code>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(token.created_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{token.last_used_at ? formatDate(token.last_used_at) : "Never"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{token.expires_at ? formatDate(token.expires_at) : "Never"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRevokeToken(token.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {revokedTokens.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Revoked Tokens</p>
                    <Table>
                      <TableBody>
                        {revokedTokens.map((token) => (
                          <TableRow key={token.id} className="opacity-50">
                            <TableCell className="font-medium line-through">{token.name}</TableCell>
                            <TableCell><code className="text-xs bg-muted px-2 py-1 rounded font-mono">{token.prefix || "—"}...</code></TableCell>
                            <TableCell className="text-sm text-muted-foreground">Revoked {formatDate(token.revoked_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-semibold mb-2">API Usage</h4>
              <p className="text-xs text-muted-foreground mb-2">Use the token in the Authorization header:</p>
              <pre className="text-xs bg-background p-3 rounded border font-mono overflow-x-auto">
{`curl -H "Authorization: Bearer wsk_your_token_here" \\
  https://your-domain.com/api/v1/products

# Available endpoints:
GET /api/v1/stores         — List sites
GET /api/v1/products       — Products (paginated)
GET /api/v1/orders         — Orders (paginated)
GET /api/v1/customers      — Customers (paginated)
GET /api/v1/categories     — Categories`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>Update the client name.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-client-name">Client Name</Label>
                <Input
                  id="edit-client-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveName} disabled={savingName || !editName.trim()}>
                {savingName ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}