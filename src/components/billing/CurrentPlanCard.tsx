import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/queries/useSubscription";

export function CurrentPlanCard() {
  const { subscription, effectiveStatus } = useSubscription();
  if (!subscription) {
    return (
      <Card>
        <CardHeader><CardTitle>No active plan</CardTitle></CardHeader>
        <CardContent><Button asChild><a href="/pricing">View plans</a></Button></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Badge>{effectiveStatus}</Badge>
        <p className="text-sm text-muted-foreground">Mode: {subscription.renewal_mode}</p>
      </CardContent>
    </Card>
  );
}