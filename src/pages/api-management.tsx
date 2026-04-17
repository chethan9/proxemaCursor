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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Key, Plus, Trash2, Shield, Activity, BookOpen, Copy, EyeOff, ChevronRight, Terminal, Globe, Lock, Zap } from "lucide-react";
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

interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  desc: string;
  example?: string;
}

interface EndpointDef {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  scope: string;
  params: EndpointParam[];
  responseExample: string;
}

const API_ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/api/v1/stores",
    summary: "List stores",
    description: "Returns all WooCommerce stores belonging to the authenticated client. Use this to discover store IDs for subsequent API calls.",
    scope: "read",
    params: [],
    responseExample: JSON.stringify({
      data: [
        { id: "uuid-1", name: "My Store", url: "https://store.example.com", status: "connected", last_sync_at: "2026-04-17T12:00:00Z" },
      ],
      total: 1,
    }, null, 2),
  },
  {
    method: "GET",
    path: "/api/v1/products",
    summary: "List products",
    description: "Returns paginated products for a specific store. Supports search by name and filtering by status. Includes full product data with pricing, stock, and categories.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID from /stores endpoint", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number (default: 1)", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page (default: 20, max: 100)", example: "20" },
      { name: "search", type: "string", required: false, desc: "Search by product name", example: "T-Shirt" },
      { name: "status", type: "string", required: false, desc: "Filter by status: publish, draft, pending", example: "publish" },
    ],
    responseExample: JSON.stringify({
      data: [
        { id: "uuid", woo_id: 123, name: "Premium T-Shirt", sku: "TSH-001", price: "29.99", regular_price: "39.99", status: "publish", stock_quantity: 45, categories: ["Apparel"] },
      ],
      total: 156,
      page: 1,
      per_page: 20,
    }, null, 2),
  },
  {
    method: "GET",
    path: "/api/v1/orders",
    summary: "List orders",
    description: "Returns paginated orders for a specific store. Supports filtering by status (pending, processing, completed, cancelled, refunded) and search by order number.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number (default: 1)", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page (default: 20, max: 100)", example: "20" },
      { name: "status", type: "string", required: false, desc: "Filter by order status", example: "processing" },
      { name: "search", type: "string", required: false, desc: "Search by order number or customer email", example: "1042" },
    ],
    responseExample: JSON.stringify({
      data: [
        { id: "uuid", woo_id: 1042, status: "processing", total: "89.97", currency: "USD", billing: { first_name: "John", last_name: "Doe", email: "john@example.com" }, line_items_count: 3, date_created: "2026-04-17T10:30:00Z" },
      ],
      total: 2110,
      page: 1,
      per_page: 20,
    }, null, 2),
  },
  {
    method: "GET",
    path: "/api/v1/customers",
    summary: "List customers",
    description: "Returns paginated customers for a specific store. Supports search by name or email. Includes order count and total spent.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number (default: 1)", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page (default: 20, max: 100)", example: "20" },
      { name: "search", type: "string", required: false, desc: "Search by name or email", example: "john@example.com" },
    ],
    responseExample: JSON.stringify({
      data: [
        { id: "uuid", woo_id: 5, email: "john@example.com", first_name: "John", last_name: "Doe", orders_count: 12, total_spent: "1249.50", date_created: "2025-01-15T08:00:00Z" },
      ],
      total: 2981,
      page: 1,
      per_page: 20,
    }, null, 2),
  },
  {
    method: "GET",
    path: "/api/v1/categories",
    summary: "List categories",
    description: "Returns all product categories for a specific store. Flat list with parent reference for building category trees.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
    ],
    responseExample: JSON.stringify({
      data: [
        { id: "uuid", woo_id: 15, name: "Apparel", slug: "apparel", parent_id: null, count: 24 },
        { id: "uuid", woo_id: 16, name: "T-Shirts", slug: "t-shirts", parent_id: 15, count: 8 },
      ],
      total: 12,
    }, null, 2),
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 border-emerald-200",
  POST: "bg-blue-100 text-blue-800 border-blue-200",
  PATCH: "bg-amber-100 text-amber-800 border-amber-200",
  DELETE: "bg-rose-100 text-rose-800 border-rose-200",
};

function formatDate(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs gap-1"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
      }}
    >
      <Copy className="h-3 w-3" />
      Copy
    </Button>
  );
}

function buildCurl(baseUrl: string, endpoint: EndpointDef): string {
  let url = baseUrl + endpoint.path;
  const requiredParams = endpoint.params.filter(p => p.required);
  const optionalParams = endpoint.params.filter(p => !p.required).slice(0, 2);
  const allParams = [...requiredParams, ...optionalParams];
  if (allParams.length > 0) {
    const qs = allParams.map(p => p.name + "=" + (p.example || "{value}")).join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  return "curl -X " + endpoint.method + " \\\n  -H \"Authorization: Bearer wsk_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  \"" + url + "\"";
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
  const [baseUrl, setBaseUrl] = useState("");

  const [formName, setFormName] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>(["read"]);
  const [formRateLimit, setFormRateLimit] = useState("1000");
  const [formOrigins, setFormOrigins] = useState("");
  const [formExpiry, setFormExpiry] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

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

          <TabsContent value="docs" className="mt-4 space-y-6">
            {/* Getting Started */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Getting Started
                </CardTitle>
                <CardDescription>Quick start guide for integrating with the WooSync REST API v1</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                      Create an API Key
                    </div>
                    <p className="text-sm text-muted-foreground">Go to the API Keys tab and create a key scoped to your client.</p>
                  </div>
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                      Add Authorization Header
                    </div>
                    <p className="text-sm text-muted-foreground">Include your API key as a Bearer token in every request.</p>
                  </div>
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
                      Start Querying Data
                    </div>
                    <p className="text-sm text-muted-foreground">Fetch stores, products, orders, customers — all from your synced data.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Base URL
                    </h4>
                    <CopyButton text={baseUrl + "/api/v1"} />
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-sm">
                    {baseUrl || "https://your-domain.com"}/api/v1
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Authentication
                    </h4>
                    <CopyButton text="Authorization: Bearer wsk_YOUR_API_KEY" />
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-sm space-y-1">
                    <span className="text-slate-400"># Include in every request header:</span>
                    <br />
                    <span className="text-emerald-400">Authorization</span>: Bearer <span className="text-amber-300">wsk_YOUR_API_KEY</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Rate Limiting
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Rate limits are configured per API key (default: 1,000 req/hour).
                    Check response headers for current usage:
                  </p>
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs space-y-1">
                    <div><span className="text-slate-400">X-RateLimit-Limit:</span> <span className="text-emerald-400">1000</span></div>
                    <div><span className="text-slate-400">X-RateLimit-Remaining:</span> <span className="text-emerald-400">987</span></div>
                    <div><span className="text-slate-400">X-RateLimit-Reset:</span> <span className="text-emerald-400">1713400000</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Endpoints
                </CardTitle>
                <CardDescription>Complete reference for all available v1 API endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {API_ENDPOINTS.map((ep, i) => (
                    <AccordionItem key={i} value={"ep-" + i}>
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 text-left">
                          <span className={"px-2.5 py-1 rounded text-xs font-bold border " + METHOD_COLORS[ep.method]}>
                            {ep.method}
                          </span>
                          <code className="font-mono text-sm">{ep.path}</code>
                          <span className="text-sm text-muted-foreground hidden md:inline">{ep.summary}</span>
                          <Badge variant="outline" className="text-xs ml-auto mr-4">{ep.scope}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2 pl-1">
                          <p className="text-sm text-muted-foreground">{ep.description}</p>

                          {ep.params.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-sm font-semibold">Parameters</h5>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[140px]">Name</TableHead>
                                    <TableHead className="w-[80px]">Type</TableHead>
                                    <TableHead className="w-[80px]">Required</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-[120px]">Example</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ep.params.map(p => (
                                    <TableRow key={p.name}>
                                      <TableCell><code className="text-xs font-semibold">{p.name}</code></TableCell>
                                      <TableCell><Badge variant="outline" className="text-xs">{p.type}</Badge></TableCell>
                                      <TableCell>
                                        {p.required ? (
                                          <Badge variant="default" className="text-xs bg-rose-100 text-rose-800 border-rose-200">required</Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">optional</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-sm">{p.desc}</TableCell>
                                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.example}</code></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-semibold flex items-center gap-2">
                                <Terminal className="h-3.5 w-3.5" />
                                cURL Example
                              </h5>
                              <CopyButton text={buildCurl(baseUrl || "https://your-domain.com", ep)} />
                            </div>
                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                              {buildCurl(baseUrl || "https://your-domain.com", ep)}
                            </pre>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-semibold">Response Example</h5>
                              <CopyButton text={ep.responseExample} />
                            </div>
                            <pre className="bg-slate-50 border p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap text-slate-800">
                              {ep.responseExample}
                            </pre>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Error Codes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Error Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[180px]">Code</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { status: "400", code: "BAD_REQUEST", desc: "Missing or invalid query parameters" },
                      { status: "401", code: "UNAUTHORIZED", desc: "Missing or invalid API key" },
                      { status: "403", code: "FORBIDDEN", desc: "API key does not have required scope, or origin not allowed" },
                      { status: "404", code: "NOT_FOUND", desc: "Resource or endpoint not found" },
                      { status: "429", code: "RATE_LIMITED", desc: "Rate limit exceeded — check X-RateLimit-Reset header" },
                      { status: "500", code: "INTERNAL_ERROR", desc: "Server error — contact support if persistent" },
                    ].map(e => (
                      <TableRow key={e.status}>
                        <TableCell>
                          <StatusBadge variant={parseInt(e.status) < 400 ? "success" : parseInt(e.status) < 500 ? "warning" : "error"}>
                            {e.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell><code className="text-xs font-semibold">{e.code}</code></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}