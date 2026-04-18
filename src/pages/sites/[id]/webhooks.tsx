import { Webhook } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SitePageShell } from "./_shared";

export default function SiteWebhooksPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  return (
    <SitePageShell>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
            <p className="text-sm text-muted-foreground">Real-time event subscriptions for this site</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm">Site-scoped webhook management is coming soon. For now, use the global Webhooks page.</p>
            <div className="flex gap-2">
              <Link href={`/webhooks?store=${id}`}><Button variant="outline" size="sm">Webhooks</Button></Link>
              <Link href={`/webhooks/activity?store=${id}`}><Button variant="outline" size="sm">Activity</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </SitePageShell>
  );
}