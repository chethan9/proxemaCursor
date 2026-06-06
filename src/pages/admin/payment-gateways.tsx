import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthProvider";
import { Loader2, CheckCircle2, XCircle, Key, RefreshCw, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "next-i18next";
import { formatDateTime } from "@/lib/format-number";
import { getSupportedCountries } from "@/lib/payments/routing";

type GatewayConfig = {
  id: string;
  gateway: string;
  mode: "test" | "live";
  enabled: boolean;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  webhook_secret_encrypted: string | null;
  last_test_at: string | null;
  last_test_status: "success" | "failed" | null;
  last_test_error: string | null;
  additional_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type RegionRouting = {
  id: string;
  country_code: string;
  gateway: string;
  enabled: boolean;
  priority: number;
};

const GATEWAYS = [
  { id: "myfatoorah", name: "MyFatoorah", region: "MENA" },
  { id: "razorpay", name: "Razorpay", region: "Global" },
  { id: "tap", name: "Tap Payments", region: "MENA" },
  { id: "polar", name: "Polar", region: "Global (MoR)" },
];

export default function PaymentGatewaysPage() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const { profile, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, { api_key?: string; api_secret?: string; webhook_secret?: string; enabled?: boolean }>>({});
  const [routeCountry, setRouteCountry] = useState("US");
  const [routeGateway, setRouteGateway] = useState("razorpay");

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["payment-gateways"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/admin/payment-gateways", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch gateway configs");
      return response.json() as Promise<GatewayConfig[]>;
    },
    enabled: !!profile && (isSuperAdmin || profile.role === "admin"),
  });

  const { data: routing = [] } = useQuery({
    queryKey: ["payment-routing"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/admin/payment-gateways?action=routing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch routing");
      return response.json() as Promise<RegionRouting[]>;
    },
    enabled: !!profile && (isSuperAdmin || profile.role === "admin"),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ gateway, mode, credentials }: { gateway: string; mode: "test" | "live"; credentials: any }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gateway, mode, credentials }),
      });
      if (!response.ok) throw new Error("Failed to save config");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
      toast({ title: "Gateway config saved" });
      setFormData({});
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ gateway, mode }: { gateway: string; mode: "test" | "live" }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "test", gateway, mode }),
      });
      if (!response.ok) throw new Error("Test failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
      if (data.success) {
        toast({ title: "Connection test successful", variant: "default" });
      } else {
        toast({ title: "Connection test failed", description: data.error, variant: "destructive" });
      }
    },
  });

  const routingUpsertMutation = useMutation({
    mutationFn: async (vars?: { country_code?: string; gateway?: string; enabled?: boolean; priority?: number }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "update_routing",
          country_code: vars?.country_code ?? routeCountry,
          gateway: vars?.gateway ?? routeGateway,
          enabled: vars?.enabled ?? true,
          priority: vars?.priority ?? 1,
        }),
      });
      if (!response.ok) throw new Error("Failed to save routing");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-routing"] });
      toast({ title: "Routing saved" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ gateway, mode }: { gateway: string; mode: "test" | "live" }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "regenerate_webhook", gateway, mode }),
      });
      if (!response.ok) throw new Error("Regenerate failed");
      return response.json();
    },
    onSuccess: (data, { gateway, mode }) => {
      queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
      toast({
        title: "Webhook secret regenerated",
        description: `New secret: ${data.webhook_secret} (copy it now, won't be shown again)`,
      });
    },
  });

  useEffect(() => {
    if (profile && !isSuperAdmin && profile.role !== "admin") {
      router.push("/");
    }
  }, [profile, isSuperAdmin, router]);

  if (profile && !isSuperAdmin && profile.role !== "admin") {
    return null;
  }

  const getConfig = (gateway: string, mode: "test" | "live") =>
    configs.find((c) => c.gateway === gateway && c.mode === mode);

  const handleSave = (gateway: string, mode: "test" | "live") => {
    const key = `${gateway}_${mode}`;
    const credentials = formData[key] || {};
    if (Object.keys(credentials).length === 0) {
      toast({ title: "No changes to save", variant: "default" });
      return;
    }
    saveMutation.mutate({ gateway, mode, credentials });
  };

  const toggleShow = (key: string) => {
    setShowSecrets((p) => ({ ...p, [key]: !p[key] }));
  };

  const updateField = (gateway: string, mode: "test" | "live", field: string, value: any) => {
    const key = `${gateway}_${mode}`;
    setFormData((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
  };

  return (
    <AppLayout title="Payment Gateway Settings">
      <div className="p-6 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold">Payment Gateway Settings</h1>
          <p className="text-muted-foreground">Manage encrypted credentials and region routing for MyFatoorah, Razorpay, and Tap</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            All credentials are encrypted using <code className="text-xs">pgcrypto</code> with <code className="text-xs">PAYMENT_ENCRYPTION_KEY</code>. Never commit this key to git. Activity logs mask sensitive fields.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="gateways">
          <TabsList>
            <TabsTrigger value="gateways">Gateway Credentials</TabsTrigger>
            <TabsTrigger value="routing">Region Routing</TabsTrigger>
          </TabsList>

          <TabsContent value="gateways" className="space-y-6 mt-6">
            {GATEWAYS.map((gw) => (
              <Card key={gw.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{gw.name}</CardTitle>
                      <CardDescription>Configure {gw.region} gateway credentials</CardDescription>
                    </div>
                    <Badge variant="outline">{gw.region}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="test">
                    <TabsList className="mb-4">
                      <TabsTrigger value="test">Test Mode</TabsTrigger>
                      <TabsTrigger value="live">Live Mode</TabsTrigger>
                    </TabsList>

                    {(["test", "live"] as const).map((mode) => {
                      const config = getConfig(gw.id, mode);
                      const key = `${gw.id}_${mode}`;
                      const isLive = mode === "live";
                      const hasChanges = !!formData[key] && Object.keys(formData[key]).length > 0;

                      return (
                        <TabsContent key={mode} value={mode} className="space-y-4">
                          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={formData[key]?.enabled ?? config?.enabled ?? false}
                                onCheckedChange={(v) => updateField(gw.id, mode, "enabled", v)}
                              />
                              <Label className="font-medium">
                                {formData[key]?.enabled ?? config?.enabled ? "Enabled" : "Disabled"}
                              </Label>
                            </div>
                            {config?.last_test_at && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {config.last_test_status === "success" ? (
                                  <><CheckCircle2 className="h-4 w-4 text-success" /> Last test passed</>
                                ) : (
                                  <><XCircle className="h-4 w-4 text-destructive" /> Last test failed</>
                                )}
                                <span>{formatDateTime(config.last_test_at, i18n.language)}</span>
                              </div>
                            )}
                          </div>

                          {isLive && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                You are editing <strong>LIVE credentials</strong>. Changes affect real transactions immediately.
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="grid gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">API Key</Label>
                              <div className="flex gap-2">
                                <Input
                                  type={showSecrets[`${key}_api`] ? "text" : "password"}
                                  placeholder={config?.api_key_encrypted ? "••••••••" : "Enter API key"}
                                  value={formData[key]?.api_key ?? ""}
                                  onChange={(e) => updateField(gw.id, mode, "api_key", e.target.value)}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => toggleShow(`${key}_api`)}
                                >
                                  {showSecrets[`${key}_api`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">API Secret</Label>
                              <div className="flex gap-2">
                                <Input
                                  type={showSecrets[`${key}_secret`] ? "text" : "password"}
                                  placeholder={config?.api_secret_encrypted ? "••••••••" : "Enter API secret"}
                                  value={formData[key]?.api_secret ?? ""}
                                  onChange={(e) => updateField(gw.id, mode, "api_secret", e.target.value)}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => toggleShow(`${key}_secret`)}
                                >
                                  {showSecrets[`${key}_secret`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">Webhook Secret</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => regenerateMutation.mutate({ gateway: gw.id, mode })}
                                  disabled={regenerateMutation.isPending}
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                                  Regenerate
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  type={showSecrets[`${key}_webhook`] ? "text" : "password"}
                                  placeholder={config?.webhook_secret_encrypted ? "••••••••" : "Auto-generated on save"}
                                  value={formData[key]?.webhook_secret ?? ""}
                                  onChange={(e) => updateField(gw.id, mode, "webhook_secret", e.target.value)}
                                  disabled
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => toggleShow(`${key}_webhook`)}
                                >
                                  {showSecrets[`${key}_webhook`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => handleSave(gw.id, mode)}
                              disabled={!hasChanges || saveMutation.isPending}
                            >
                              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                              Save {isLive ? "Live" : "Test"} Config
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => testMutation.mutate({ gateway: gw.id, mode })}
                              disabled={!config || testMutation.isPending}
                            >
                              {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                              Test Connection
                            </Button>
                            {hasChanges && (
                              <Button
                                variant="ghost"
                                onClick={() => setFormData((p) => ({ ...p, [key]: {} }))}
                              >
                                Discard
                              </Button>
                            )}
                          </div>

                          {config?.last_test_error && (
                            <Alert variant="destructive">
                              <XCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs font-mono">{config.last_test_error}</AlertDescription>
                            </Alert>
                          )}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="routing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Region routing</CardTitle>
                <CardDescription>
                  Exact ISO country code matches before the <code className="text-xs">*</code> fallback. Lower priority runs first. Checkout resolves the gateway from these rows (cached ~1 minute).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-md border divide-y max-h-[320px] overflow-y-auto">
                  {[...routing]
                    .sort((a, b) => {
                      if (a.country_code === "*") return 1;
                      if (b.country_code === "*") return -1;
                      return a.country_code.localeCompare(b.country_code);
                    })
                    .map((row) => (
                      <div key={row.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 p-3 text-sm">
                        <span className="font-mono font-medium min-w-[3ch]">
                          {row.country_code === "*" ? "* (fallback)" : row.country_code}
                        </span>
                        <select
                          className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm w-full max-w-[180px]"
                          value={row.gateway}
                          onChange={(e) =>
                            routingUpsertMutation.mutate({
                              country_code: row.country_code,
                              gateway: e.target.value,
                              enabled: row.enabled,
                              priority: row.priority,
                            })
                          }
                          disabled={routingUpsertMutation.isPending}
                        >
                          {GATEWAYS.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        <Switch
                          checked={row.enabled}
                          onCheckedChange={(v) =>
                            routingUpsertMutation.mutate({
                              country_code: row.country_code,
                              gateway: row.gateway,
                              enabled: v,
                              priority: row.priority,
                            })
                          }
                          disabled={routingUpsertMutation.isPending}
                          aria-label={`Toggle ${row.country_code} routing`}
                        />
                        <Badge variant={row.enabled ? "default" : "secondary"} className="min-w-[68px] justify-center">
                          {row.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    ))}
                  {routing.length === 0 && (
                    <div className="p-6 text-sm text-muted-foreground text-center">
                      No routing rules yet. Add one below or seed the wildcard <code>*</code> fallback.
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                  <div className="space-y-1.5">
                    <Label>Country code</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      value={routeCountry}
                      onChange={(e) => setRouteCountry(e.target.value)}
                    >
                      <option value="*">* (default fallback)</option>
                      {getSupportedCountries().map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gateway</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      value={routeGateway}
                      onChange={(e) => setRouteGateway(e.target.value)}
                    >
                      {GATEWAYS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    onClick={() => routingUpsertMutation.mutate({})}
                    disabled={routingUpsertMutation.isPending}
                  >
                    {routingUpsertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
                    Save route
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}