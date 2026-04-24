import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff, Copy, ExternalLink } from "lucide-react";

type GatewayName = "myfatoorah" | "razorpay" | "tap";
type Settings = {
  gateway_name: GatewayName;
  enabled: boolean;
  mode: "test" | "live";
  publishable_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
  country_overrides: string[] | null;
};
type HealthState = Record<string, { configured: boolean; reachable: boolean; error?: string }>;

const META: Record<GatewayName, { label: string; region: string; webhookPath: string; defaultCountries: string[] }> = {
  myfatoorah: { label: "MyFatoorah", region: "Middle East (KNET, KFAST, local cards)", webhookPath: "/api/billing/webhooks/myfatoorah", defaultCountries: ["KW","SA","AE","BH","OM","QA","JO"] },
  razorpay: { label: "Razorpay", region: "India + global cards", webhookPath: "/api/billing/webhooks/razorpay", defaultCountries: ["IN","US","GB","EU"] },
  tap: { label: "Tap Payments", region: "MENA (Card SDK + 3DS)", webhookPath: "/api/billing/webhooks/tap", defaultCountries: ["KW","SA","AE","BH","OM","QA","JO","EG"] },
};

export default function PaymentGatewaysAdminPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Settings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const r = await fetch("/api/admin/payment-gateways", { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (r.ok) { const j = await r.json(); setItems(j.items || []); }
    setLoading(false);
  }, []);

  const runHealth = useCallback(async () => {
    const r = await fetch("/api/billing/gateway/health");
    if (r.ok) { const j = await r.json(); setHealth(j); }
  }, []);

  useEffect(() => { load(); runHealth(); }, [load, runHealth]);

  const save = async (name: GatewayName, patch: Partial<Settings>) => {
    setSaving(name);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const r = await fetch("/api/admin/payment-gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ gateway_name: name, ...patch }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast({ title: "Save failed", description: j.error || "Unknown error", variant: "destructive" });
        return;
      }
      const updated = await r.json();
      setItems((prev) => {
        const exists = prev.find((x) => x.gateway_name === name);
        return exists ? prev.map((x) => (x.gateway_name === name ? { ...x, ...updated } : x)) : [...prev, updated];
      });
      toast({ title: `${META[name].label} saved` });
      setTimeout(runHealth, 500);
    } finally { setSaving(null); }
  };

  const testOne = async (name: GatewayName) => {
    setTesting(name);
    try {
      const r = await fetch("/api/billing/gateway/health");
      const h = (await r.json()) as HealthState;
      setHealth(h);
      const result = h[name];
      if (result?.configured && result?.reachable) toast({ title: `${META[name].label} OK`, description: "Credentials valid and gateway reachable." });
      else if (!result?.configured) toast({ title: `${META[name].label} not configured`, description: "Save credentials first.", variant: "destructive" });
      else toast({ title: `${META[name].label} unreachable`, description: result?.error || "Check secret key.", variant: "destructive" });
    } finally { setTesting(null); }
  };

  const copy = (val: string) => { navigator.clipboard.writeText(val); toast({ title: "Copied" }); };

  return (
    <AppLayout>
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payment Gateways</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage credentials, regions, and connectivity. Saved values override env vars.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { load(); runHealth(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading…</div>
        ) : (
          <Tabs defaultValue="myfatoorah">
            <TabsList>
              {(Object.keys(META) as GatewayName[]).map((name) => {
                const cfg = items.find((i) => i.gateway_name === name);
                const h = health[name];
                return (
                  <TabsTrigger key={name} value={name}>
                    <span className="flex items-center gap-1.5">
                      {META[name].label}
                      {cfg?.enabled && h?.reachable ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                      {cfg?.enabled && !h?.reachable ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : null}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(META) as GatewayName[]).map((name) => {
              const cfg = items.find((i) => i.gateway_name === name) || ({ gateway_name: name, enabled: false, mode: "test", publishable_key: "", secret_key: "", webhook_secret: "", country_overrides: [] } as Settings);
              const meta = META[name];
              const h = health[name];
              const isTesting = testing === name;
              const isSaving = saving === name;
              const webhookUrl = origin + meta.webhookPath;
              const overrides = (cfg.country_overrides || []).join(", ");

              return (
                <TabsContent key={name} value={name} className="mt-4">
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 flex-wrap">
                          {meta.label}
                          <Badge variant={cfg.enabled ? "default" : "secondary"}>{cfg.enabled ? "Enabled" : "Disabled"}</Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">{cfg.mode}</Badge>
                          {h?.reachable && cfg.enabled ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1" />Online</Badge> : null}
                          {!h?.reachable && cfg.enabled ? <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{h?.configured === false ? "Missing keys" : "Unreachable"}</Badge> : null}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{meta.region}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Enabled</Label>
                        <Switch checked={cfg.enabled} onCheckedChange={(v) => save(name, { enabled: v })} disabled={isSaving} />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      <div>
                        <Label className="text-xs text-muted-foreground">Mode</Label>
                        <div className="flex gap-2 mt-1">
                          {(["test", "live"] as const).map((m) => (
                            <button key={m} onClick={() => save(name, { mode: m })} disabled={isSaving} className={`px-3 py-1 text-xs rounded-full border ${cfg.mode === m ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>{m}</button>
                          ))}
                        </div>
                      </div>

                      <CredentialField label="Publishable / Public Key" value={cfg.publishable_key || ""} onSave={(v) => save(name, { publishable_key: v })} masked={false} />
                      <CredentialField label="Secret / API Key" value={cfg.secret_key ? "********" : ""} onSave={(v) => save(name, { secret_key: v })} masked={!showSecrets[`${name}_sk`]} onToggle={() => setShowSecrets((s) => ({ ...s, [`${name}_sk`]: !s[`${name}_sk`] }))} />
                      <CredentialField label="Webhook Secret" value={cfg.webhook_secret ? "********" : ""} onSave={(v) => save(name, { webhook_secret: v })} masked={!showSecrets[`${name}_ws`]} onToggle={() => setShowSecrets((s) => ({ ...s, [`${name}_ws`]: !s[`${name}_ws`] }))} />

                      <div>
                        <Label className="text-xs text-muted-foreground">Country overrides (ISO codes)</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Comma-separated. Empty = use default routing. Defaults: {meta.defaultCountries.join(", ")}</p>
                        <CountryOverrideInput initial={overrides} onSave={(arr) => save(name, { country_overrides: arr })} disabled={isSaving} />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Webhook URL (paste into {meta.label} dashboard)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input readOnly value={webhookUrl} className="h-9 font-mono text-xs" />
                          <Button variant="outline" size="sm" onClick={() => copy(webhookUrl)}><Copy className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                          {h?.error ? <span className="text-destructive">Last error: {h.error}</span> : "Click test to verify credentials."}
                        </div>
                        <Button onClick={() => testOne(name)} disabled={isTesting || !cfg.enabled} size="sm">
                          {isTesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                          Test Connection
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

function CredentialField({ label, value, onSave, masked, onToggle }: { label: string; value: string; onSave: (v: string) => void; masked: boolean; onToggle?: () => void }) {
  const [v, setV] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setV(value); setDirty(false); }, [value]);
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          type={masked ? "password" : "text"}
          value={v}
          onChange={(e) => { setV(e.target.value); setDirty(true); }}
          className="h-9 font-mono text-xs"
          placeholder={value === "********" ? "•••• stored — type to replace" : "Enter value"}
        />
        {onToggle ? (
          <Button variant="outline" size="sm" type="button" onClick={onToggle}>
            {masked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
        ) : null}
        <Button size="sm" disabled={!dirty} onClick={() => { onSave(v); setDirty(false); }}>Save</Button>
      </div>
    </div>
  );
}

function CountryOverrideInput({ initial, onSave, disabled }: { initial: string; onSave: (arr: string[]) => void; disabled: boolean }) {
  const [v, setV] = useState(initial);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setV(initial); setDirty(false); }, [initial]);
  const arr = useMemo(() => v.split(",").map((s) => s.trim()).filter(Boolean), [v]);
  void arr;
  return (
    <div className="flex items-center gap-2">
      <Input value={v} onChange={(e) => { setV(e.target.value); setDirty(true); }} placeholder="KW, SA, AE" className="h-9 font-mono text-xs" disabled={disabled} />
      <Button size="sm" disabled={!dirty || disabled} onClick={() => { onSave(v.split(",").map((s) => s.trim()).filter(Boolean)); setDirty(false); }}>Save</Button>
    </div>
  );
}
