import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Key, Plus, Trash2, Shield, Activity, BookOpen, Copy, CheckCircle2, XCircle, Eye, EyeOff, Clock, BarChart3 } from "lucide-react";
import { getApiKeys, createApiKey, revokeApiKey, deleteApiKey, getApiCallLogs, getApiKeyStats, type ApiKey, type ApiCallLog } from "@/services/apiKeyService";
import { getClients, type ClientWithStats } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";

const AVAILABLE_SCOPES = [
  { id: "read", label: "Read", desc: "Read products, orders, customers" },
  { id: "write", label: "Write", desc: "Create/update records" },
  { id: "delete", label: "Delete", desc: "Delete records" },
  { id: "webhooks", label: "Webhooks", desc: "Manage webhooks" },
  { id: "sync", label: "Sync", desc: "Trigger sync operations" },
];

const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/stores", desc: "List all stores for the client", scope: "read" },
  { method: "GET", path: "/api/v1/products?store_id={id}", desc: "List products with pagination, search, filters", scope: "read" },
  { method: "GET", path: "/api/v1/orders?store_id={id}", desc: "List orders with status filter", scope: "read" },
  { method: "GET", path: "/api/v1/customers?store_id={id}", desc: "List customers with search", scope: "read" },
  { method: "GET", path: "/api/v1/categories?store_id={id}", desc: "List product categories", scope: "read" },
];

function formatDate(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ApiManagementPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [selectedKeyStats, setSelectedKeyStats] = useState<Record<string, { totalCalls: number; last24h: number; avgResponseTime: number; errorRate: number }>>({});

  const [formName, setFormName] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>(["read"]);
  const [formRateLimit, setFormRateLimit] = useState("1000");
  const [formOrigins, setFormOrigins] = useState("");
  const [formExpiry, setFormExpiry] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [k, c, l] = await Promise.all([
      getApiKeys(),
      getClients(),
      getApiCallLogs({ limit: 100 }),
    ]);
    setKeys(k);
    setClients(c);
    setLogs(l.logs);
    setLogsTotal(l.total);
    setLoading(false);

    for (const key of k) {
      getApiKeyStats(key.id).then(stats => {
        setSelectedKeyStats(prev => ({ ...prev, [key.id]: stats }));
      });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!formName || !formClient) return;
    const result = await createApiKey({
      clientId: formClient,
      name: formName,
      scopes: formScopes,
      rateLimit: parseInt(formRateLimit) || 1000,
      allowedOrigins: formOrigins ? formOrigins.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      expiresAt: formExpiry || null,
    });
    if (result) {
      setNewKeyRevealed(result.plainTextKey);
      toast({ title: "API Key Created", description: "Copy the key now — it won't be shown again." });
      setShowCreate(false);
      setFormName("");
      setFormClient("");
      setFormScopes(["read"]);
      setFormRateLimit("1000");
      setFormOrigins("");
      setFormExpiry("");
      loadData();
    }
  };

  const handleRevoke = async (id: string) => {
    await revokeApiKey(id);
    toast({ title: "Key Revoked" });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteApiKey(id);
    toast({ title: "Key Deleted" });
    loadData();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Management</h1>
            <p className="text-muted-foreground">Manage API keys, monitor usage, and configure access for downstream apps</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Create API Key</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>Generate a new API key for downstream app access</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Key Name</Label>
                  <Input placeholder="e.g. Flutter App Production" value={formName} onChange={e => setFormName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={formClient} onValueChange={setFormClient}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scopes</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_SCOPES.map(scope => (
                      <label key={scope.id} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50">
                        <Checkbox
                          checked={formScopes.includes(scope.id)}
                          onCheckedChange={(checked) => {
                            setFormScopes(prev => checked ? [...prev, scope.id] : prev.filter(s => s !== scope.id));
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium">{scope.label}</div>
                          <div className="text-xs text-muted-foreground">{scope.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rate Limit (req/hour)</Label>
                    <Input type="number" value={formRateLimit} onChange={e => setFormRateLimit(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expires</Label>
                    <Input type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Allowed Origins (comma-separated)</Label>
                  <Input placeholder="e.g. app.example.com, *.example.com" value={formOrigins} onChange={e => setFormOrigins(e.target.value)} />
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!formName || !formClient}>Create Key</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {newKeyRevealed && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-yellow-900">New API Key — copy it now, it won't be shown again</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white p-3 rounded border font-mono text-sm break-all">{newKeyRevealed}</code>
                    <Button variant="outline" size="sm" onClick={() => copyKey(newKeyRevealed)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setNewKeyRevealed(null)}>Dismiss</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="keys">
          <TabsList>
            <TabsTrigger value="keys" className="gap-2"><Key className="h-4 w-4" />API Keys</TabsTrigger>
            <TabsTrigger value="logs" className="gap-2"><Activity className="h-4 w-4" />Call Logs</TabsTrigger>
            <TabsTrigger value="docs" className="gap-2"><BookOpen className="h-4 w-4" />API Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-4 mt-4">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{keys.length}</div>
                  <div className="text-sm text-muted-foreground">Total Keys</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-emerald-600">{keys.filter(k => k.is_active).length}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{logsTotal.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total API Calls</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-rose-600">{keys.filter(k => !k.is_active).length}</div>
                  <div className="text-sm text-muted-foreground">Revoked</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Keys</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : keys.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No API keys yet. Create one to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Key</TableHead>
                        <TableHead>Scopes</TableHead>
                        <TableHead>Rate Limit</TableHead>
                        <TableHead>Usage (24h)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keys.map(key => {
                        const stats = selectedKeyStats[key.id];
                        return (
                          <TableRow key={key.id}>
                            <TableCell className="font-medium">{key.name}</TableCell>
                            <TableCell className="text-muted-foreground">{key.clients?.name || "—"}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{key.key_prefix}...</code>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {key.scopes?.map(s => (
                                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{key.rate_limit?.toLocaleString()}/hr</TableCell>
                            <TableCell>{stats ? stats.last24h.toLocaleString() : "—"}</TableCell>
                            <TableCell>
                              <StatusBadge variant={key.is_active ? "success" : "error"}>
                                {key.is_active ? "Active" : "Revoked"}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(key.last_used_at)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {key.is_active && (
                                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(key.id)}>
                                    <EyeOff className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(key.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Call Logs</CardTitle>
                <CardDescription>Recent API calls across all keys</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No API calls logged yet.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Path</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                            <TableCell><Badge variant="outline">{log.method}</Badge></TableCell>
                            <TableCell className="font-mono text-xs max-w-[300px] truncate">{log.path}</TableCell>
                            <TableCell>
                              <StatusBadge variant={(log.status_code || 0) < 400 ? "success" : "error"}>
                                {log.status_code}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-xs">{log.response_time_ms}ms</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{log.ip_address}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Reference</CardTitle>
                <CardDescription>REST API v1 endpoints for downstream app integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h3 className="font-semibold">Authentication</h3>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                    <p className="text-muted-foreground mb-1"># Include in every request header:</p>
                    <p>Authorization: Bearer wsk_xxxxxxxxxxxx...</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Base URL</h3>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                    {typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Endpoints</h3>
                  <div className="space-y-2">
                    {API_ENDPOINTS.map((ep, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Badge variant={ep.method === "GET" ? "default" : "secondary"} className="w-14 justify-center text-xs">
                          {ep.method}
                        </Badge>
                        <code className="font-mono text-sm flex-1">{ep.path}</code>
                        <span className="text-sm text-muted-foreground">{ep.desc}</span>
                        <Badge variant="outline" className="text-xs">{ep.scope}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Query Parameters</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { param: "page", desc: "Page number (default: 1)" },
                      { param: "per_page", desc: "Items per page (default: 20, max: 100)" },
                      { param: "search", desc: "Search by name/email/order number" },
                      { param: "status", desc: "Filter by status" },
                      { param: "store_id", desc: "Filter by store UUID" },
                      { param: "sort", desc: "Sort field (default: created_at)" },
                    ].map(p => (
                      <div key={p.param} className="flex items-baseline gap-2 p-2 bg-muted/50 rounded">
                        <code className="text-sm font-semibold">{p.param}</code>
                        <span className="text-xs text-muted-foreground">{p.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Rate Limiting</h3>
                  <p className="text-sm text-muted-foreground">
                    Rate limits are configured per API key. Default: 1,000 requests/hour.
                    Response headers include <code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code> and <code className="bg-muted px-1 rounded">X-RateLimit-Reset</code>.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Example Request</h3>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm space-y-1">
                    <p className="text-slate-400"># Fetch products for a store</p>
                    <p>curl -H &quot;Authorization: Bearer wsk_abc123...&quot; \</p>
                    <p className="pl-4">&quot;{typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1/products?store_id=UUID&amp;page=1&amp;per_page=20&quot;</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}