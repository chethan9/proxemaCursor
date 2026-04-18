import { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, Activity, BookOpen, AlertTriangle, Copy, Search, RefreshCw } from "lucide-react";
import { ApiKeyStats } from "@/components/api/ApiKeyStats";
import { ApiKeysTable } from "@/components/api/ApiKeysTable";
import { ApiCallLogs } from "@/components/api/ApiCallLogs";
import { ApiReference } from "@/components/api/ApiReference";
import { CreateKeyDialog } from "@/components/api/CreateKeyDialog";
import {
  getApiKeys, createApiKey, revokeApiKey, deleteApiKey,
  getApiCallLogs, getApiKeyStats,
  type ApiKey, type ApiCallLog,
} from "@/services/apiKeyService";
import { getClients, type ClientWithStats } from "@/services/clientService";
import { useToast } from "@/hooks/use-toast";

export default function ApiManagementPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyStats, setKeyStats] = useState<Record<string, { totalCalls: number; last24h: number; avgResponseTime: number; errorRate: number }>>({});
  const [baseUrl, setBaseUrl] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const [k, c, l] = await Promise.all([getApiKeys(), getClients(), getApiCallLogs({ limit: 100 })]);
    setKeys(k);
    setClients(c);
    setLogs(l.logs);
    setLogsTotal(l.total);
    if (!silent) setLoading(false);
    else setRefreshing(false);
    for (const key of k) {
      getApiKeyStats(key.id).then((s) => setKeyStats((prev) => ({ ...prev, [key.id]: s })));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (data: {
    name: string;
    clientId: string;
    scopes: string[];
    rateLimit: number;
    allowedOrigins?: string[];
    expiresAt: string | null;
  }) => {
    const result = await createApiKey({
      clientId: data.clientId,
      name: data.name,
      scopes: data.scopes,
      rateLimit: data.rateLimit,
      allowedOrigins: data.allowedOrigins,
      expiresAt: data.expiresAt,
    });
    if (result) {
      setRevealedKey(result.plainTextKey);
      toast({ title: "API Key Created", description: "Copy the key now \u2014 it won't be shown again." });
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

  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      if (statusFilter === "active" && !k.is_active) return false;
      if (statusFilter === "revoked" && k.is_active) return false;
      if (clientFilter !== "all" && k.client_id !== clientFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = k.name?.toLowerCase().includes(q);
        const matchClient = k.clients?.name?.toLowerCase().includes(q);
        const matchPrefix = k.key_prefix?.toLowerCase().includes(q);
        if (!matchName && !matchClient && !matchPrefix) return false;
      }
      return true;
    });
  }, [keys, statusFilter, clientFilter, search]);

  const activeKeys = keys.filter((k) => k.is_active).length;
  const revokedKeys = keys.filter((k) => !k.is_active).length;

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
              <span>Settings</span>
              <span>/</span>
              <span className="text-foreground font-medium">API Management</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">API Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage API keys, monitor usage, and explore the REST API
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={"h-3.5 w-3.5 mr-1.5 " + (refreshing ? "animate-spin" : "")} />
              Refresh
            </Button>
            <CreateKeyDialog clients={clients} onCreate={handleCreate} />
          </div>
        </div>

        {revealedKey && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-semibold text-amber-900">
                  Copy your API key now &mdash; it will not be shown again
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-sm select-all">
                    {revealedKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={() => {
                      navigator.clipboard.writeText(revealedKey);
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-amber-700 hover:text-amber-900 px-0"
                  onClick={() => setRevealedKey(null)}
                >
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <ApiKeyStats
          totalKeys={keys.length}
          activeKeys={activeKeys}
          totalCalls={logsTotal}
          revokedKeys={revokedKeys}
        />

        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList className="h-10">
            <TabsTrigger value="keys" className="gap-1.5">
              <Key className="h-3.5 w-3.5" />
              API Keys
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums">
                {keys.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Call Logs
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums">
                {logsTotal}
              </span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              API Reference
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-4">
            <Card className="border-border/60">
              <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, client, or prefix..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-9 border-border/60"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={(v: "all" | "active" | "revoked") => setStatusFilter(v)}>
                    <SelectTrigger className="h-9 w-[130px] border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="h-9 w-[160px] border-border/60">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <ApiKeysTable
              keys={filteredKeys}
              keyStats={keyStats}
              loading={loading}
              onRevoke={handleRevoke}
              onDelete={handleDelete}
            />
          </TabsContent>

          <TabsContent value="logs">
            <ApiCallLogs logs={logs} total={logsTotal} />
          </TabsContent>

          <TabsContent value="docs">
            <ApiReference baseUrl={baseUrl} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}