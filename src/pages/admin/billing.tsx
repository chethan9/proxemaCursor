import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, Clock, FlaskConical } from "lucide-react";

type Settings = {
  billingEnforcementEnabled: boolean;
  quotaGraceDays: number;
  billingDevMode: boolean;
};

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

function AdminBillingInner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [graceDraft, setGraceDraft] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-billing-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/billing-settings", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load settings");
      return (await res.json()) as Settings;
    },
  });

  const settings: Settings = data ?? { billingEnforcementEnabled: true, quotaGraceDays: 7, billingDevMode: false };
  const graceValue = graceDraft ?? settings.quotaGraceDays;

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const res = await fetch("/api/admin/billing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j && (j as { error?: string }).error) || "Save failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-billing-settings"] });
      qc.invalidateQueries({ queryKey: ["app-settings", "global"] });
      qc.invalidateQueries({ queryKey: ["subscription"] });
      toast({ title: "Billing settings updated" });
    },
    onError: (e) => toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Billing Controls</h1>
        <p className="text-muted-foreground">Globally control plan enforcement and quota grace policy.</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" /> Developer mode</CardTitle>
              <CardDescription className="mt-1">
                When on, subscription gates, the pricing redirect, sidebar locks, and API quota checks behave as if plan enforcement is off — without changing the enforcement toggle below. Use for QA and bugfixes only.
              </CardDescription>
            </div>
            <Switch
              checked={settings.billingDevMode}
              disabled={saveMutation.isPending}
              onCheckedChange={(v) => saveMutation.mutate({ billingDevMode: v })}
              aria-label="Toggle billing developer mode"
            />
          </div>
        </CardHeader>
        <CardContent>
          {settings.billingDevMode && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-800">
              <AlertDescription>
                <strong>Dev mode is on.</strong> Everyone sees a yellow banner at the top of the app. Turn off when finished testing.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Plan enforcement</CardTitle>
              <CardDescription className="mt-1">
                When enabled, users without an active plan are sent to the in-app pricing page and product surfaces are hidden until they pick a plan.
                Overridden while Developer mode is on.
              </CardDescription>
            </div>
            <Switch
              checked={settings.billingEnforcementEnabled}
              disabled={saveMutation.isPending}
              onCheckedChange={(v) => saveMutation.mutate({ billingEnforcementEnabled: v })}
              aria-label="Toggle plan enforcement"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!settings.billingEnforcementEnabled && !settings.billingDevMode && (
            <Alert>
              <AlertDescription>
                Enforcement is currently <strong>off</strong>. All users have full access regardless of subscription state, and quota limits are not blocking.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Quota overage grace</CardTitle>
          <CardDescription>
            Days a client may stay over their plan limits before writes are blocked. Applies to per-plan resource caps (sites, products).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 max-w-sm">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="grace-days">Grace days</Label>
              <Input
                id="grace-days"
                type="number"
                min={0}
                max={60}
                value={graceValue}
                onChange={(e) => setGraceDraft(Number(e.target.value))}
              />
            </div>
            <Button
              onClick={() => {
                const v = Number(graceValue);
                if (!Number.isFinite(v) || v < 0 || v > 60) {
                  toast({ title: "Invalid value", description: "Enter a value between 0 and 60.", variant: "destructive" });
                  return;
                }
                saveMutation.mutate({ quotaGraceDays: v });
                setGraceDraft(null);
              }}
              disabled={saveMutation.isPending || graceDraft === null || graceDraft === settings.quotaGraceDays}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Default: 7 days. Set to 0 to enforce limits immediately on the first overage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminBillingPage() {
  return (
    <AppLayout title="Billing Controls" requireSuperAdmin bypassBillingGate>
      <AdminBillingInner />
    </AppLayout>
  );
}
