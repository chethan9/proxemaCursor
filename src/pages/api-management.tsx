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
import { Key, Plus, Trash2, Shield, Activity, BookOpen, Copy, EyeOff, Terminal, Globe, Lock, Zap, Clock, AlertTriangle } from "lucide-react";
import { getApiKeys, createApiKey, revokeApiKey, deleteApiKey, getApiCallLogs, getApiKeyStats, type ApiKey, type ApiCallLog } from "@/services/apiKeyService";
import { getClients, type ClientWithStats } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";

const SCOPES = [
  { id: "read", label: "Read", desc: "Read products, orders, customers" },
  { id: "write", label: "Write", desc: "Create and update records" },
  { id: "delete", label: "Delete", desc: "Delete records" },
  { id: "webhooks", label: "Webhooks", desc: "Manage webhooks" },
  { id: "sync", label: "Sync", desc: "Trigger sync operations" },
];

interface EPParam { name: string; type: string; required: boolean; desc: string; example?: string; }
interface EPDef { method: string; path: string; summary: string; desc: string; scope: string; params: EPParam[]; response: string; }

const ENDPOINTS: EPDef[] = [
  { method: "GET", path: "/api/v1/stores", summary: "List stores", desc: "Returns all WooCommerce stores belonging to the authenticated client.", scope: "read", params: [],
    response: JSON.stringify({ data: [{ id: "uuid-1", name: "My Store", url: "https://store.example.com", status: "connected", last_sync_at: "2026-04-17T12:00:00Z" }], total: 1 }, null, 2) },
  { method: "GET", path: "/api/v1/products", summary: "List products", desc: "Paginated products for a store. Supports search and status filtering.", scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number (default: 1)", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "search", type: "string", required: false, desc: "Search product name", example: "T-Shirt" },
      { name: "status", type: "string", required: false, desc: "publish, draft, pending", example: "publish" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 123, name: "Premium T-Shirt", sku: "TSH-001", price: "29.99", status: "publish", stock_quantity: 45 }], total: 156, page: 1, per_page: 20 }, null, 2) },
  { method: "GET", path: "/api/v1/orders", summary: "List orders", desc: "Paginated orders with status filtering and search.", scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "status", type: "string", required: false, desc: "Order status filter", example: "processing" },
      { name: "search", type: "string", required: false, desc: "Order number or email", example: "1042" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 1042, status: "processing", total: "89.97", currency: "USD", line_items_count: 3, date_created: "2026-04-17T10:30:00Z" }], total: 2110, page: 1, per_page: 20 }, null, 2) },
  { method: "GET", path: "/api/v1/customers", summary: "List customers", desc: "Paginated customers with search by name or email.", scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "search", type: "string", required: false, desc: "Name or email", example: "john@example.com" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 5, email: "john@example.com", first_name: "John", last_name: "Doe", orders_count: 12, total_spent: "1249.50" }], total: 2981, page: 1, per_page: 20 }, null, 2) },
  { method: "GET", path: "/api/v1/categories", summary: "List categories", desc: "All product categories for a store with parent references.", scope: "read",
    params: [{ name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." }],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 15, name: "Apparel", slug: "apparel", parent_id: null, count: 24 }], total: 12 }, null, 2) },
];

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 border-emerald-300",
  POST: "bg-blue-100 text-blue-800 border-blue-300",
  PATCH: "bg-amber-100 text-amber-800 border-amber-300",
  DELETE: "bg-rose-100 text-rose-800 border-rose-300",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();
  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }}>
      <Copy className="h-3 w-3" />{label || "Copy"}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border bg-slate-950 p-4 font-mono text-[13px] leading-relaxed text-slate-200 overflow-x-auto">
      {children}
    </pre>
  );
}

function buildCurl(base: string, ep: EPDef) {
  let url = base + ep.path;
  const qs = ep.params.filter(p => p.example).map(p => p.name + "=" + p.example).join("&");
  if (qs) url += "?" + qs;
  return "curl -X " + ep.method + " \\\n  -H \"Authorization: Bearer wsk_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  \"" + url + "\"";
}

export default function ApiManagementPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyStats, setKeyStats] = useState<Record<string, { totalCalls: number; last24h: number; avgResponseTime: number; errorRate: number }>>({});
  const [baseUrl, setBaseUrl] = useState("");

  const [fName, setFName] = useState("");
  const [fClient, setFClient] = useState("");
  const [fScopes, setFScopes] = useState<string[]>(["read"]);
  const [fRate, setFRate] = useState("1000");
  const [fOrigins, setFOrigins] = useState("");
  const [fExpiry, setFExpiry] = useState("");

  useEffect(() => { if (typeof window !== "undefined") setBaseUrl(window.location.origin); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [k, c, l] = await Promise.all([getApiKeys(), getClients(), getApiCallLogs({ limit: 100 })]);
    setKeys(k);
    setClients(c);
    setLogs(l.logs);
    setLogsTotal(l.total);
    setLoading(false);
    for (const key of k) {
      getApiKeyStats(key.id).then(s => setKeyStats(prev => ({ ...prev, [key.id]: s })));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!fName || !fClient) return;
    const result = await createApiKey({
      clientId: fClient, name: fName, scopes: fScopes,
      rateLimit: parseInt(fRate) || 1000,
      allowedOrigins: fOrigins ? fOrigins.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      expiresAt: fExpiry || null,
    });
    if (result) {
      setRevealedKey(result.plainTextKey);
      toast({ title: "API Key Created", description: "Copy the key now — it won't be shown again." });
      setShowCreate(false);
      setFName(""); setFClient(""); setFScopes(["read"]); setFRate("1000"); setFOrigins(""); setFExpiry("");
      loadData();
    }
  };

  const activeKeys = keys.filter(k => k.is_active).length;
  const revokedKeys = keys.filter(k => !k.is_active).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage API keys, monitor usage, and explore the REST API</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Create API Key</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>Generate a bearer token for downstream app access</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Key Name</Label>
                  <Input placeholder="e.g. Flutter App Production" value={fName} onChange={e => setFName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Client</Label>
                  <Select value={fClient} onValueChange={setFClient}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Scopes</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SCOPES.map(s => (
                      <label key={s.id} className="flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox className="mt-0.5" checked={fScopes.includes(s.id)}
                          onCheckedChange={v => setFScopes(prev => v ? [...prev, s.id] : prev.filter(x => x !== s.id))} />
                        <div className="leading-tight">
                          <div className="text-sm font-medium">{s.label}</div>
                          <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Rate Limit (req/hr)</Label>
                    <Input type="number" value={fRate} onChange={e => setFRate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Expires</Label>
                    <Input type="date" value={fExpiry} onChange={e => setFExpiry(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Allowed Origins</Label>
                  <Input placeholder="app.example.com, *.example.com" value={fOrigins} onChange={e => setFOrigins(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">Comma-separated. Leave empty to allow all origins.</p>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!fName || !fClient}>Create Key</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {revealedKey && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex items-start gap-3 pt-5 pb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-semibold text-amber-900">Copy your API key now — it will not be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded-md border border-amber-200 bg-white px-3 py-2 font-mono text-sm select-all">{revealedKey}</code>
                  <CopyBtn text={revealedKey} label="Copy" />
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-700" onClick={() => setRevealedKey(null)}>Dismiss</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="keys">
          <TabsList>
            <TabsTrigger value="keys" className="gap-1.5"><Key className="h-3.5 w-3.5" />API Keys</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Call Logs</TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />API Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Keys", value: keys.length, icon: Key },
                { label: "Active", value: activeKeys, icon: Shield, color: "text-emerald-600" },
                { label: "Total API Calls", value: logsTotal.toLocaleString(), icon: Activity, color: "text-primary" },
                { label: "Revoked", value: revokedKeys, icon: EyeOff, color: "text-rose-500" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <s.icon className={"h-4 w-4 " + (s.color || "text-muted-foreground")} />
                    </div>
                    <div>
                      <div className={"text-xl font-bold leading-none " + (s.color || "")}>{s.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
                ) : keys.length === 0 ? (
                  <div className="py-16 text-center">
                    <Key className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm font-medium">No API keys yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create one to start using the WooSync REST API</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Name</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Key Prefix</TableHead>
                          <TableHead>Scopes</TableHead>
                          <TableHead className="text-right">Rate Limit</TableHead>
                          <TableHead className="text-right">24h Calls</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead className="w-20 pr-4"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keys.map(k => {
                          const st = keyStats[k.id];
                          return (
                            <TableRow key={k.id}>
                              <TableCell className="pl-4 font-medium">{k.name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{k.clients?.name || "—"}</TableCell>
                              <TableCell><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{k.key_prefix}...</code></TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {k.scopes?.map(s => <Badge key={s} variant="secondary" className="text-[10px] font-mono px-1.5">{s}</Badge>)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{k.rate_limit?.toLocaleString()}/hr</TableCell>
                              <TableCell className="text-right font-mono text-sm">{st ? st.last24h.toLocaleString() : "—"}</TableCell>
                              <TableCell>
                                <StatusBadge variant={k.is_active ? "success" : "error"}>{k.is_active ? "Active" : "Revoked"}</StatusBadge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{fmtDate(k.last_used_at)}</TableCell>
                              <TableCell className="pr-4">
                                <div className="flex justify-end gap-0.5">
                                  {k.is_active && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { revokeApiKey(k.id).then(() => { toast({ title: "Key Revoked" }); loadData(); }); }} title="Revoke">
                                      <EyeOff className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { deleteApiKey(k.id).then(() => { toast({ title: "Key Deleted" }); loadData(); }); }} title="Delete">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Recent API Calls</CardTitle>
                    <CardDescription>{logsTotal.toLocaleString()} total calls across all keys</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {logs.length === 0 ? (
                  <div className="py-16 text-center">
                    <Activity className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm font-medium">No API calls logged yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Calls made with your API keys will appear here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[480px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Time</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Path</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Duration</TableHead>
                          <TableHead className="pr-4">IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="pl-4 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</TableCell>
                            <TableCell>
                              <span className={"inline-block rounded border px-2 py-0.5 text-[11px] font-bold " + (METHOD_STYLE[l.method || "GET"] || "bg-muted")}>
                                {l.method}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate font-mono text-xs">{l.path}</TableCell>
                            <TableCell>
                              <StatusBadge variant={(l.status_code || 0) < 400 ? "success" : "error"}>{l.status_code}</StatusBadge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{l.response_time_ms}ms</TableCell>
                            <TableCell className="pr-4 font-mono text-xs text-muted-foreground">{l.ip_address}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-primary" />Getting Started</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { n: "1", t: "Create an API Key", d: "Go to the API Keys tab and generate a key scoped to your client." },
                    { n: "2", t: "Add Auth Header", d: "Include your key as a Bearer token in every request." },
                    { n: "3", t: "Query Data", d: "Fetch stores, products, orders, and customers." },
                  ].map(s => (
                    <div key={s.n} className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{s.n}</div>
                        <span className="text-sm font-semibold">{s.t}</span>
                      </div>
                      <p className="pl-8 text-xs text-muted-foreground leading-relaxed">{s.d}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Globe className="h-3.5 w-3.5 text-muted-foreground" />Base URL</h4>
                    <CopyBtn text={(baseUrl || "https://your-domain.com") + "/api/v1"} />
                  </div>
                  <CodeBlock>{(baseUrl || "https://your-domain.com") + "/api/v1"}</CodeBlock>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-3.5 w-3.5 text-muted-foreground" />Authentication</h4>
                    <CopyBtn text="Authorization: Bearer wsk_YOUR_API_KEY" />
                  </div>
                  <CodeBlock>{"# Include in every request header:\nAuthorization: Bearer wsk_YOUR_API_KEY"}</CodeBlock>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="h-3.5 w-3.5 text-muted-foreground" />Rate Limiting</h4>
                  <p className="text-xs text-muted-foreground">Configured per API key (default: 1,000 req/hour). Check response headers:</p>
                  <CodeBlock>{"X-RateLimit-Limit: 1000\nX-RateLimit-Remaining: 987\nX-RateLimit-Reset: 1713400000"}</CodeBlock>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4 text-primary" />Endpoints</CardTitle>
                <CardDescription>Complete REST API v1 reference</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Accordion type="multiple" className="w-full">
                  {ENDPOINTS.map((ep, i) => {
                    const curl = buildCurl(baseUrl || "https://your-domain.com", ep);
                    return (
                      <AccordionItem key={i} value={"ep-" + i} className="border-b last:border-b-0">
                        <AccordionTrigger className="px-5 py-3 hover:no-underline hover:bg-muted/30">
                          <div className="flex items-center gap-3 text-left">
                            <span className={"shrink-0 rounded border px-2 py-0.5 text-[11px] font-bold " + METHOD_STYLE[ep.method]}>{ep.method}</span>
                            <code className="font-mono text-sm">{ep.path}</code>
                            <span className="hidden text-xs text-muted-foreground sm:inline">— {ep.summary}</span>
                            <Badge variant="outline" className="ml-auto mr-2 shrink-0 font-mono text-[10px]">{ep.scope}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5">
                          <div className="space-y-4 pt-1">
                            <p className="text-sm text-muted-foreground">{ep.desc}</p>

                            {ep.params.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parameters</h5>
                                <div className="overflow-hidden rounded-lg border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/40">
                                        <TableHead className="text-xs w-[130px]">Name</TableHead>
                                        <TableHead className="text-xs w-[70px]">Type</TableHead>
                                        <TableHead className="text-xs w-[70px]">Required</TableHead>
                                        <TableHead className="text-xs">Description</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {ep.params.map(p => (
                                        <TableRow key={p.name}>
                                          <TableCell><code className="text-xs font-semibold text-primary">{p.name}</code></TableCell>
                                          <TableCell><code className="text-[11px] text-muted-foreground">{p.type}</code></TableCell>
                                          <TableCell>
                                            {p.required
                                              ? <Badge className="bg-rose-100 text-rose-700 border-rose-300 text-[10px] hover:bg-rose-100">required</Badge>
                                              : <span className="text-[11px] text-muted-foreground">optional</span>}
                                          </TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{p.desc}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">cURL Example</h5>
                                <CopyBtn text={curl} label="Copy cURL" />
                              </div>
                              <CodeBlock>{curl}</CodeBlock>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Response</h5>
                                <CopyBtn text={ep.response} />
                              </div>
                              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">{ep.response}</pre>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Error Codes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[70px] pl-5 text-xs">Status</TableHead>
                      <TableHead className="w-[160px] text-xs">Code</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { s: "400", c: "BAD_REQUEST", d: "Missing or invalid query parameters" },
                      { s: "401", c: "UNAUTHORIZED", d: "Missing or invalid API key" },
                      { s: "403", c: "FORBIDDEN", d: "Insufficient scope or origin not allowed" },
                      { s: "404", c: "NOT_FOUND", d: "Resource or endpoint not found" },
                      { s: "429", c: "RATE_LIMITED", d: "Rate limit exceeded — retry after X-RateLimit-Reset" },
                      { s: "500", c: "INTERNAL_ERROR", d: "Server error — contact support if persistent" },
                    ].map(e => (
                      <TableRow key={e.s}>
                        <TableCell className="pl-5">
                          <StatusBadge variant={parseInt(e.s) < 400 ? "success" : parseInt(e.s) < 500 ? "warning" : "error"}>{e.s}</StatusBadge>
                        </TableCell>
                        <TableCell><code className="font-mono text-xs font-bold">{e.c}</code></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.d}</TableCell>
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