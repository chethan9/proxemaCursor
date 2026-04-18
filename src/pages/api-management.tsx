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
import {
  Key, Plus, Trash2, Shield, Activity, BookOpen, Copy, EyeOff,
  Terminal, Globe, Lock, Zap, Clock, AlertTriangle,
} from "lucide-react";
import {
  getApiKeys, createApiKey, revokeApiKey, deleteApiKey,
  getApiCallLogs, getApiKeyStats,
  type ApiKey, type ApiCallLog,
} from "@/services/apiKeyService";
import { getClients, type ClientWithStats } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";

const SCOPES = [
  { id: "read", label: "Read", desc: "Read products, orders, customers" },
  { id: "write", label: "Write", desc: "Create and update records" },
  { id: "delete", label: "Delete", desc: "Delete records" },
  { id: "webhooks", label: "Webhooks", desc: "Manage webhooks" },
  { id: "sync", label: "Sync", desc: "Trigger sync operations" },
];

interface EPParam {
  name: string;
  type: string;
  required: boolean;
  desc: string;
  example?: string;
}

interface EPDef {
  method: string;
  path: string;
  summary: string;
  desc: string;
  scope: string;
  params: EPParam[];
  response: string;
}

const ENDPOINTS: EPDef[] = [
  {
    method: "GET", path: "/api/v1/stores", summary: "List stores",
    desc: "Returns all WooCommerce stores belonging to the authenticated client.",
    scope: "read", params: [],
    response: JSON.stringify({ data: [{ id: "uuid-1", name: "My Store", url: "https://store.example.com", status: "connected", last_sync_at: "2026-04-17T12:00:00Z" }], total: 1 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/products", summary: "List products",
    desc: "Paginated products for a store. Supports search and status filtering.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number (default: 1)", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "search", type: "string", required: false, desc: "Search product name", example: "T-Shirt" },
      { name: "status", type: "string", required: false, desc: "publish, draft, pending", example: "publish" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 123, name: "Premium T-Shirt", sku: "TSH-001", price: "29.99", status: "publish", stock_quantity: 45 }], total: 156, page: 1, per_page: 20 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/orders", summary: "List orders",
    desc: "Paginated orders with status filtering and search.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "status", type: "string", required: false, desc: "Order status filter", example: "processing" },
      { name: "search", type: "string", required: false, desc: "Order number or email", example: "1042" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 1042, status: "processing", total: "89.97", currency: "USD", line_items_count: 3, date_created: "2026-04-17T10:30:00Z" }], total: 2110, page: 1, per_page: 20 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/customers", summary: "List customers",
    desc: "Paginated customers with search by name or email.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "search", type: "string", required: false, desc: "Name or email", example: "john@example.com" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 5, email: "john@example.com", first_name: "John", last_name: "Doe", orders_count: 12, total_spent: "1249.50" }], total: 2981, page: 1, per_page: 20 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/categories", summary: "List categories",
    desc: "All product categories for a store with parent references.",
    scope: "read",
    params: [{ name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." }],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 15, name: "Apparel", slug: "apparel", parent_id: null, count: 24 }], total: 12 }, null, 2),
  },
];

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  PATCH: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  DELETE: "bg-rose-500/10 text-rose-700 border-rose-500/20",
};

function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied to clipboard" }); }}
    >
      <Copy className="h-3 w-3" />
      {label || "Copy"}
    </Button>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  return (
    <pre className={"rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-[13px] leading-relaxed text-slate-300 overflow-x-auto " + (className || "")}>
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

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

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
      toast({ title: "API Key Created", description: "Copy the key now \u2014 it won't be shown again." });
      setShowCreate(false);
      setFName("");
      setFClient("");
      setFScopes(["read"]);
      setFRate("1000");
      setFOrigins("");
      setFExpiry("");
      loadData();
    }
  };

  const activeKeys = keys.filter(k => k.is_active).length;
  const revokedKeys = keys.filter(k => !k.is_active).length;

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage API keys, monitor usage, and explore the REST API</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>Generate a bearer token for downstream app access</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Key Name</Label>
                  <Input placeholder="e.g. Flutter App Production" value={fName} onChange={e => setFName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Client</Label>
                  <Select value={fClient} onValueChange={setFClient}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Scopes</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SCOPES.map(s => (
                      <label key={s.id} className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox
                          className="mt-0.5"
                          checked={fScopes.includes(s.id)}
                          onCheckedChange={v => setFScopes(prev => v ? [...prev, s.id] : prev.filter(x => x !== s.id))}
                        />
                        <div className="leading-tight">
                          <div className="text-sm font-medium">{s.label}</div>
                          <div className="text-[11px] text-muted-foreground leading-snug">{s.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Rate Limit (req/hr)</Label>
                    <Input type="number" value={fRate} onChange={e => setFRate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Expires</Label>
                    <Input type="date" value={fExpiry} onChange={e => setFExpiry(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Allowed Origins</Label>
                  <Input placeholder="app.example.com, *.example.com" value={fOrigins} onChange={e => setFOrigins(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">Comma-separated. Leave empty to allow all origins.</p>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!fName || !fClient}>
                  Create Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {revealedKey && (
          <Card className="border-amber-400/50 bg-amber-50/80">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-semibold text-amber-900">Copy your API key now &mdash; it will not be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-sm select-all">
                    {revealedKey}
                  </code>
                  <CopyBtn text={revealedKey} label="Copy" />
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-700 hover:text-amber-900" onClick={() => setRevealedKey(null)}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList>
            <TabsTrigger value="keys" className="gap-1.5">
              <Key className="h-3.5 w-3.5" />API Keys
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />Call Logs
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />API Reference
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total Keys", value: keys.length, icon: Key, color: "" },
                { label: "Active", value: activeKeys, icon: Shield, color: "text-emerald-600" },
                { label: "API Calls", value: logsTotal.toLocaleString(), icon: Activity, color: "text-blue-600" },
                { label: "Revoked", value: revokedKeys, icon: EyeOff, color: "text-rose-500" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <s.icon className={"h-[18px] w-[18px] " + (s.color || "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0">
                        <p className={"text-2xl font-bold leading-none tracking-tight " + (s.color || "text-foreground")}>
                          {s.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
                ) : keys.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Key className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="mt-4 text-sm font-medium">No API keys yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Create one to start using the WooSync REST API</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-5 w-[180px]">Name</TableHead>
                          <TableHead className="w-[140px]">Client</TableHead>
                          <TableHead className="w-[110px]">Key Prefix</TableHead>
                          <TableHead className="w-[160px]">Scopes</TableHead>
                          <TableHead className="w-[100px] text-right">Rate Limit</TableHead>
                          <TableHead className="w-[80px] text-right">24h Calls</TableHead>
                          <TableHead className="w-[80px]">Status</TableHead>
                          <TableHead className="w-[130px]">Last Used</TableHead>
                          <TableHead className="w-[80px] pr-5"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keys.map(k => {
                          const st = keyStats[k.id];
                          return (
                            <TableRow key={k.id}>
                              <TableCell className="pl-5">
                                <span className="font-medium">{k.name}</span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {k.clients?.name || "\u2014"}
                              </TableCell>
                              <TableCell>
                                <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                                  {k.key_prefix}...
                                </code>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {k.scopes?.map(s => (
                                    <Badge key={s} variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                                      {s}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums">
                                {k.rate_limit?.toLocaleString()}/hr
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums">
                                {st ? st.last24h.toLocaleString() : "\u2014"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge variant={k.is_active ? "success" : "error"}>
                                  {k.is_active ? "Active" : "Revoked"}
                                </StatusBadge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {fmtDate(k.last_used_at)}
                              </TableCell>
                              <TableCell className="pr-5">
                                <div className="flex justify-end gap-1">
                                  {k.is_active && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Revoke"
                                      onClick={() => {
                                        revokeApiKey(k.id).then(() => {
                                          toast({ title: "Key Revoked" });
                                          loadData();
                                        });
                                      }}
                                    >
                                      <EyeOff className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    title="Delete"
                                    onClick={() => {
                                      deleteApiKey(k.id).then(() => {
                                        toast({ title: "Key Deleted" });
                                        loadData();
                                      });
                                    }}
                                  >
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

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent API Calls</CardTitle>
                <CardDescription>{logsTotal.toLocaleString()} total calls across all keys</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="mt-4 text-sm font-medium">No API calls logged yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Calls made with your API keys will appear here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-5 w-[160px]">Time</TableHead>
                          <TableHead className="w-[80px]">Method</TableHead>
                          <TableHead>Path</TableHead>
                          <TableHead className="w-[80px]">Status</TableHead>
                          <TableHead className="w-[90px] text-right">Duration</TableHead>
                          <TableHead className="w-[120px] pr-5">IP Address</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="pl-5 text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDate(l.created_at)}
                            </TableCell>
                            <TableCell>
                              <span className={"inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide " + (METHOD_STYLE[l.method || "GET"] || "bg-muted")}>
                                {l.method}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate font-mono text-xs">
                              {l.path}
                            </TableCell>
                            <TableCell>
                              <StatusBadge variant={(l.status_code || 0) < 400 ? "success" : "error"}>
                                {l.status_code}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {l.response_time_ms}ms
                            </TableCell>
                            <TableCell className="pr-5 font-mono text-xs text-muted-foreground">
                              {l.ip_address}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="space-y-5">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-primary" />
                  Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { n: "1", t: "Create an API Key", d: "Go to the API Keys tab and generate a key scoped to your client." },
                    { n: "2", t: "Add Auth Header", d: "Include your key as a Bearer token in every request." },
                    { n: "3", t: "Query Data", d: "Fetch stores, products, orders, and customers via the endpoints below." },
                  ].map(s => (
                    <div key={s.n} className="rounded-xl border bg-muted/30 p-5 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {s.n}
                        </div>
                        <span className="text-sm font-semibold">{s.t}</span>
                      </div>
                      <p className="pl-[38px] text-xs text-muted-foreground leading-relaxed">{s.d}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      Base URL
                    </h4>
                    <CopyBtn text={(baseUrl || "https://your-domain.com") + "/api/v1"} />
                  </div>
                  <CodeBlock>{(baseUrl || "https://your-domain.com") + "/api/v1"}</CodeBlock>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Authentication
                    </h4>
                    <CopyBtn text="Authorization: Bearer wsk_YOUR_API_KEY" />
                  </div>
                  <CodeBlock>{"# Include in every request header:\nAuthorization: Bearer wsk_YOUR_API_KEY"}</CodeBlock>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Rate Limiting
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configured per API key (default: 1,000 req/hour). Check these response headers:
                  </p>
                  <CodeBlock>{"X-RateLimit-Limit: 1000\nX-RateLimit-Remaining: 987\nX-RateLimit-Reset: 1713400000"}</CodeBlock>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-4 w-4 text-primary" />
                  Endpoints
                </CardTitle>
                <CardDescription>Complete REST API v1 reference</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Accordion type="multiple" className="w-full">
                  {ENDPOINTS.map((ep, i) => {
                    const curl = buildCurl(baseUrl || "https://your-domain.com", ep);
                    return (
                      <AccordionItem key={i} value={"ep-" + i} className="border-b last:border-b-0">
                        <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-3 text-left w-full">
                            <span className={"shrink-0 inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-[11px] font-bold tracking-wide " + METHOD_STYLE[ep.method]}>
                              {ep.method}
                            </span>
                            <code className="font-mono text-sm font-medium">{ep.path}</code>
                            <span className="hidden text-xs text-muted-foreground sm:inline">{ep.summary}</span>
                            <Badge variant="outline" className="ml-auto mr-3 shrink-0 font-mono text-[10px]">
                              {ep.scope}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5">
                          <div className="space-y-5 pt-1">
                            <p className="text-sm text-muted-foreground leading-relaxed">{ep.desc}</p>

                            {ep.params.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Parameters
                                </h5>
                                <div className="overflow-hidden rounded-lg border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                                        <TableHead className="pl-4 text-xs w-[130px]">Name</TableHead>
                                        <TableHead className="text-xs w-[80px]">Type</TableHead>
                                        <TableHead className="text-xs w-[80px]">Required</TableHead>
                                        <TableHead className="text-xs">Description</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {ep.params.map(p => (
                                        <TableRow key={p.name}>
                                          <TableCell className="pl-4">
                                            <code className="text-xs font-semibold text-primary">{p.name}</code>
                                          </TableCell>
                                          <TableCell>
                                            <code className="text-[11px] text-muted-foreground">{p.type}</code>
                                          </TableCell>
                                          <TableCell>
                                            {p.required ? (
                                              <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] hover:bg-rose-500/10">
                                                required
                                              </Badge>
                                            ) : (
                                              <span className="text-[11px] text-muted-foreground">optional</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{p.desc}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  cURL Example
                                </h5>
                                <CopyBtn text={curl} label="Copy cURL" />
                              </div>
                              <CodeBlock>{curl}</CodeBlock>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Response
                                </h5>
                                <CopyBtn text={ep.response} />
                              </div>
                              <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 font-mono text-[13px] leading-relaxed text-foreground/80">
                                {ep.response}
                              </pre>
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
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[80px] pl-5 text-xs">Status</TableHead>
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
                      { s: "429", c: "RATE_LIMITED", d: "Rate limit exceeded \u2014 retry after X-RateLimit-Reset" },
                      { s: "500", c: "INTERNAL_ERROR", d: "Server error \u2014 contact support if persistent" },
                    ].map(e => (
                      <TableRow key={e.s}>
                        <TableCell className="pl-5">
                          <StatusBadge variant={parseInt(e.s) < 400 ? "success" : parseInt(e.s) < 500 ? "warning" : "error"}>
                            {e.s}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <code className="font-mono text-xs font-bold">{e.c}</code>
                        </TableCell>
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