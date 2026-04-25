import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { useSubscription } from "@/hooks/queries/useSubscription";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PlanRow {
  id: string;
  name: string;
  prices: Record<string, number> | null;
  billing_interval: string | null;
}

export function CurrentPlanCard() {
  const { profile } = useAuth();
  const { subscription, refetch } = useSubscription();
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!subscription?.plan_id) return;
    supabase.from("plans").select("id,name,prices,billing_interval").eq("id", subscription.plan_id).maybeSingle().then(({ data }) => {
      if (data) setPlan(data as unknown as PlanRow);
    });
  }, [subscription?.plan_id]);

  const handleCancel = async (uncancel: boolean) => {
    if (!subscription?.id) return;
    setCancelLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const r = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscriptionId: subscription.id, uncancel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      toast({ title: uncancel ? "Cancellation reverted" : "Subscription will cancel at period end" });
      setConfirmOpen(false);
      await refetch();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setCancelLoading(false);
    }
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Current Plan</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">No active subscription.</p>
          <Link href="/pricing"><Button size="sm">View Plans</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const currency = subscription.currency || "USD";
  const amount = plan?.prices?.[currency] ?? 0;
  const interval = plan?.billing_interval === "year" ? "yr" : "mo";
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  const isCancelScheduled = Boolean((subscription as { cancel_at_period_end?: boolean }).cancel_at_period_end);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Current Plan</CardTitle>
          <Badge variant={subscription.status === "active" ? "default" : "secondary"}>{subscription.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-semibold">{plan?.name || "—"}</div>
          <div className="text-sm text-muted-foreground">{currency} {amount.toLocaleString()} / {interval}</div>
        </div>

        {periodEnd && (
          <div className="text-xs text-muted-foreground">
            {isCancelScheduled ? "Cancels on " : "Renews on "}
            <span className="font-medium text-foreground">{periodEnd.toLocaleDateString()}</span>
          </div>
        )}

        {isCancelScheduled && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Cancellation scheduled</p>
                <p className="text-muted-foreground mt-0.5">Your subscription will end on {periodEnd?.toLocaleDateString()}. You can revert this anytime before then.</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/pricing"><Button size="sm" variant="outline">Change plan</Button></Link>
          {isCancelScheduled ? (
            <Button size="sm" variant="outline" onClick={() => handleCancel(true)} disabled={cancelLoading}>
              {cancelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
              Resume subscription
            </Button>
          ) : (
            subscription.status === "active" && (
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
                Cancel subscription
              </Button>
            )
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Your <span className="font-medium text-foreground">{plan?.name}</span> plan will remain active until{" "}
                  <span className="font-medium text-foreground">{periodEnd?.toLocaleDateString() || "the end of your billing period"}</span>.</p>
                <p>After that date you&apos;ll lose access to paid features and your sites will become read-only. You can resume anytime before then with no penalty.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleCancel(false); }} disabled={cancelLoading} className="bg-destructive hover:bg-destructive/90">
              {cancelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Confirm cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
