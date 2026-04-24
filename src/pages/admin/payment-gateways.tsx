import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Copy, RefreshCw, CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type GatewayKey = "myfatoorah" | "razorpay" | "tap";
type HealthRow = { configured: boolean; reachable: boolean; error?: string };
type HealthResponse = Record<GatewayKey, HealthRow>;

const GATEWAYS: { key: GatewayKey; name: string; region: string; docsUrl: string; testCards?: string }[] = [
  {
    key: "myfatoorah",
    name: "MyFatoorah",
    region: "Middle East (KW, SA, AE, BH, OM, QA, JO)",
    docsUrl: "https://myfatoorah.readme.io/docs",
    testCards: "5123450000000008 (Mastercard) • 05/26 • CVV 100",
  },
  {
    key: "razorpay",
    name: "Razorpay",
    region: "Global (default for rest of world)",
    docsUrl: "https://razorpay.com/docs/",
    testCards: "4111 1111 1111 1111 • any future date • any CVV",
  },
  {
    key: "tap",
    name: "Tap Payments",
    region: "Middle East (alternative to MyFatoorah)",
    docsUrl: "https://developers.tap.company/reference/api-endpoint",
    testCards: "4508 7500 1500 0312 • 05/26 • CVV 100 (success) — 5123 4500 0000 0008 (3DS)",
  },
];

const ENV_VARS: Record<GatewayKey, string[]> = {
  myfatoorah: ["MYFATOORAH_API_KEY", "MYFATOORAH_WEBHOOK_SECRET"],
  razorpay: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
  tap: ["TAP_SECRET_KEY", "TAP_PUBLIC_KEY", "TAP_WEBHOOK_SECRET"],
};

export default function AdminPaymentGatewaysPage() {
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<GatewayKey | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const runHealthCheck = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const r = await fetch("/api/billing/gateway/health", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) throw new Error(`Health check failed (${r.status})`);
      const data = (await r.json()) as HealthResponse;
      setHealth(data);
      if (showToast) {
        const ok = Object.values(data).filter((g) => g.configured && g.reachable).length;
        const total = Object.values(data).length;
        toast({ title: "Health check complete", description: `${ok}/${total} gateway${total === 1 ? "" : "s"} reachable.` });
      }
    } catch (e) {
      toast({
        title: "Health check failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setTesting(null);
    }
  }, [toast]);

  useEffect(() => {
    runHealthCheck(false);
  }, [runHealthCheck]);

  const testOne = async (key: GatewayKey) => {
    setTesting(key);
    await runHealthCheck(false);
    const row = (health as HealthResponse | null)?.[key];
    if (row) {
      if (!row.configured) {
        toast({
          title: `${key}: credentials missing`,
          description: `Set ${ENV_VARS[key].join(", ")} in .env.local, then restart the server.`,
          variant: "destructive",
        });
      } else if (!row.reachable) {
        toast({
          title: `${key}: unreachable`,
          description: row.error || "Check API keys and network connectivity.",
          variant: "destructive",
        });
      } else {
        toast({ title: `${key}: connection OK`, description: "Credentials valid and API responding." });
      }
    }
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: `${label} copied`, description: value });
  };

  return (
    <AppLayout title="Payment Gateways" requireSuperAdmin>
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Gateways
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verify credentials, copy webhook URLs, and monitor reachability for each configured gateway.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => runHealthCheck(true)} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh all
          </Button>
        </div>

        <div className="grid gap-4">
          {GATEWAYS.map((gw) => {
            const row = health?.[gw.key];
            const status = !row
              ? "loading"
              : !row.configured
              ? "unconfigured"
              : row.reachable
              ? "ok"
              : "error";
            const webhookUrl = origin ? `${origin}/api/billing/webhooks/${gw.key}` : "";

            return (
              <Card key={gw.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {gw.name}
                        {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        {status === "ok" && (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Connected
                          </Badge>
                        )}
                        {status === "error" && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> Unreachable
                          </Badge>
                        )}
                        {status === "unconfigured" && (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Not configured
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{gw.region}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={gw.docsUrl} target="_blank" rel="noreferrer" className="gap-1.5">
                          Docs <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => testOne(gw.key)}
                        disabled={testing === gw.key || loading}
                        className="gap-1.5"
                      >
                        {testing === gw.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Test Connection
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {status === "error" && row?.error && (
                    <div className="text-xs bg-destructive/5 border border-destructive/30 text-destructive rounded px-3 py-2">
                      {row.error}
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">Webhook URL</div>
                    <div className="flex items-center gap-2">
                      <Input value={webhookUrl} readOnly className="font-mono text-xs h-8" />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl, "Webhook URL")} className="gap-1.5 shrink-0">
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Register this URL in the {gw.name} dashboard so payment status updates reach us.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">Required environment variables</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ENV_VARS[gw.key].map((v) => (
                        <code key={v} className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>

                  {gw.testCards && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Test cards (sandbox)</div>
                      <div className="text-xs font-mono text-foreground/70">{gw.testCards}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-muted/40 border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Credential storage</p>
            <p>
              Gateway credentials currently load from environment variables. DB-backed credential management with encrypted
              storage and per-region routing overrides is planned in task-194 — this page will expand to edit values inline once that lands.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
