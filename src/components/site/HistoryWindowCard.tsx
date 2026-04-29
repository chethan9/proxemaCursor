import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, History as HistoryIcon, AlertCircle, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity-log";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";

interface Props {
  storeId: string;
  clientId: string | null;
  ordersHistoryFrom: string | null;
  onSaved: () => void;
}

interface PlanInfo {
  planName: string | null;
  planSlug: string | null;
  maxDays: number | null;
}

export function HistoryWindowCard({ storeId, clientId, ordersHistoryFrom, onSaved }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const { i18n } = useTranslation();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [siteFrom, setSiteFrom] = useState<string>("");
  const [origSiteFrom, setOrigSiteFrom] = useState<string>("");
  const [counts, setCounts] = useState<{ orders: number; customers: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const iso = ordersHistoryFrom || new Date(Date.now() - 90 * 86400000).toISOString();
    const ymd = iso.slice(0, 10);
    setSiteFrom(ymd);
    setOrigSiteFrom(ymd);
  }, [ordersHistoryFrom]);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_id, status")
          .eq("client_id", clientId)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const planId = (sub as { plan_id?: string | null } | null)?.plan_id || null;
        if (planId) {
          const { data: plan } = await supabase
            .from("plans")
            .select("name, slug, max_initial_history_days")
            .eq("id", planId)
            .maybeSingle();
          if (!cancelled && plan) {
            setPlanInfo({
              planName: plan.name,
              planSlug: plan.slug,
              maxDays: (plan as { max_initial_history_days?: number | null }).max_initial_history_days ?? null,
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: oc }, { count: cc }] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      ]);
      if (!cancelled) setCounts({ orders: oc || 0, customers: cc || 0 });
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  const planFloorDate = useMemo(() => {
    if (!planInfo?.maxDays) return null;
    return new Date(Date.now() - planInfo.maxDays * 86400000);
  }, [planInfo]);

  const planFloorYmd = planFloorDate ? planFloorDate.toISOString().slice(0, 10) : null;

  const effectiveYmd = useMemo(() => {
    if (!siteFrom) return null;
    if (!planFloorYmd) return siteFrom;
    return siteFrom < planFloorYmd ? planFloorYmd : siteFrom;
  }, [siteFrom, planFloorYmd]);

  const userPickedTooFar = planFloorYmd && siteFrom && siteFrom < planFloorYmd;

  const dirty = siteFrom !== origSiteFrom;

  const handleSave = async () => {
    if (!siteFrom) return;
    setSaving(true);
    try {
      const clamped = userPickedTooFar ? planFloorYmd! : siteFrom;
      const newIso = new Date(clamped + "T00:00:00.000Z").toISOString();
      const beforeIso = origSiteFrom ? new Date(origSiteFrom + "T00:00:00.000Z").toISOString() : null;
      const { error } = await supabase
        .from("stores")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ orders_history_from: newIso } as any)
        .eq("id", storeId);
      if (error) throw error;

      logActivity({
        action: "store.history_window_changed",
        entityType: "store",
        entityId: storeId,
        clientId: clientId || undefined,
        before: { orders_history_from: beforeIso },
        after: { orders_history_from: newIso },
        metadata: { store_id: storeId, plan_slug: planInfo?.planSlug || null },
      });

      setOrigSiteFrom(clamped);
      toast({ title: "History window saved", description: `Will fetch orders/customers from ${clamped} onwards.` });
      onSaved();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const fireAspect = (aspect: string) =>
        fetch(`/api/stores/${storeId}/sync?aspect=${aspect}`, { method: "POST", headers, body: "{}" });
      await fireAspect("orders");
      await fireAspect("customers");
      toast({ title: "Backfill started", description: "Fetching orders & customers from your window. Watch progress on the sync runs page." });
      router.push("/sync-runs");
    } catch (e) {
      toast({ title: "Backfill failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <HistoryIcon className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Historical data window</h2>
        </div>

        {loading ? (
          <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Loading plan…</div>
        ) : (
          <>
            {planInfo?.maxDays != null && (
              <div className="rounded-md px-3 py-2 text-xs bg-primary/5 border border-primary/20 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  Your <span className="font-medium">{planInfo.planName}</span> plan allows up to{" "}
                  <span className="font-medium">{planInfo.maxDays} days</span> of history
                  {planFloorYmd && <> (from {planFloorYmd})</>}.
                  Upgrade to fetch more.
                </div>
              </div>
            )}
            {planInfo?.maxDays == null && !loading && (
              <div className="rounded-md px-3 py-2 text-xs bg-muted/50 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>Unlimited history on your current plan.</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fetch orders/customers from</Label>
                <Input
                  type="date"
                  value={siteFrom}
                  min={planFloorYmd || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setSiteFrom(e.target.value)}
                  className="h-9"
                />
                {userPickedTooFar && (
                  <p className="text-[11px] text-warning mt-1">Plan caps history at {planFloorYmd}. Will be clamped on save.</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Effective fetch-from</Label>
                <div className="h-9 flex items-center gap-1.5 px-3 rounded-md border bg-muted/30 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono">{effectiveYmd || "—"}</span>
                </div>
              </div>
            </div>

            {counts && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                Currently synced: {formatNumber(counts.orders, i18n.language)} orders · {formatNumber(counts.customers, i18n.language)} customers
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleBackfill} disabled={backfilling || saving} className="h-8">
                {backfilling ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <HistoryIcon className="h-3.5 w-3.5 mr-1.5" />}
                Run backfill
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty} className="h-8">
                {saving ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Save window
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}