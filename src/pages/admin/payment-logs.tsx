import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ChevronDown, ChevronRight, Receipt, Webhook, AlertCircle } from "lucide-react";

type LogItem = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_email: string | null;
  actor_type: string;
  client_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const TABS = [
  { key: "attempts", label: "Payment Attempts", icon: Receipt },
  { key: "webhooks", label: "Webhook Receipts", icon: Webhook },
  { key: "errors", label: "Gateway Errors", icon: AlertCircle },
] as const;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function statusFromAction(action: string): { label: string; tone: "success" | "warning" | "error" | "neutral" } {
  if (action.includes(".paid") || action.includes(".succeeded")) return { label: "Paid", tone: "success" };
  if (action.includes(".pending") || action.includes(".initiated")) return { label: "Pending", tone: "warning" };
  if (action.includes(".failed") || action.includes(".invalid") || action.includes(".error")) return { label: "Failed", tone: "error" };
  if (action.includes(".canceled")) return { label: "Canceled", tone: "neutral" };
  return { label: action.split(".").pop() || "—", tone: "neutral" };
}

function gatewayFromAction(action: string): string {
  return action.split(".")[0] || "—";
}

export default function PaymentLogsPage() {
  const [tab, setTab] = useState<"attempts" | "webhooks" | "errors">("attempts");
  const [gateway, setGateway] = useState<string>("all");
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/admin/payment-logs?tab=${tab}&gateway=${gateway}&limit=100`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const j = await r.json();
      setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }, [tab, gateway]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const total = items.length;
    const errors = items.filter((i) => statusFromAction(i.action).tone === "error").length;
    return { total, errors };
  }, [items]);

  return (
    <AppLayout>
      <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Payment Audit Logs</h1>
            <p className="text-sm text-muted-foreground mt-1">Recent payment attempts, webhook receipts, and gateway errors across all gateways.</p>
          </div>
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Filter by gateway</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={gateway} onValueChange={setGateway}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All gateways</SelectItem>
                    <SelectItem value="tap">Tap</SelectItem>
                    <SelectItem value="myfatoorah">MyFatoorah</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {TABS.map((t) => (
                <TabsContent key={t.key} value={t.key} className="m-0">
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : items.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">No {t.label.toLowerCase()} yet.</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-2 w-8"></th>
                            <th className="text-left px-3 py-2">Time</th>
                            <th className="text-left px-3 py-2">Gateway</th>
                            <th className="text-left px-3 py-2">Action</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-left px-3 py-2">Reference</th>
                            <th className="text-left px-3 py-2">Actor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {items.map((it) => {
                            const status = statusFromAction(it.action);
                            const isOpen = expandedId === it.id;
                            const gw = gatewayFromAction(it.action);
                            return (
                              <>
                                <tr key={it.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedId(isOpen ? null : it.id)}>
                                  <td className="px-3 py-2.5">
                                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{formatTime(it.created_at)}</td>
                                  <td className="px-3 py-2.5 capitalize">{gw}</td>
                                  <td className="px-3 py-2.5 font-mono text-[11px]">{it.action}</td>
                                  <td className="px-3 py-2.5">
                                    <Badge variant={status.tone === "success" ? "default" : status.tone === "error" ? "destructive" : "secondary"} className="text-[10px]">
                                      {status.label}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{it.entity_id || "—"}</td>
                                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{it.actor_email || it.actor_type}</td>
                                </tr>
                                {isOpen && (
                                  <tr key={`${it.id}-detail`} className="bg-muted/20">
                                    <td></td>
                                    <td colSpan={6} className="px-3 py-3">
                                      <div className="text-xs font-medium mb-1.5 text-muted-foreground">Metadata</div>
                                      <pre className="text-[11px] bg-background border rounded p-2 overflow-x-auto font-mono">
                                        {JSON.stringify(it.metadata || {}, null, 2)}
                                      </pre>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground flex items-center gap-3">
          <span>Total: <span className="font-medium text-foreground">{counts.total}</span></span>
          {counts.errors > 0 && <span>Errors: <span className="font-medium text-destructive">{counts.errors}</span></span>}
          <span className="ml-auto">Showing latest 100 entries</span>
        </div>
      </div>
    </AppLayout>
  );
}
