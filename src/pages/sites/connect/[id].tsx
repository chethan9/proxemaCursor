import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";

type Phase = "verifying" | "connected" | "timeout";

export default function ConnectSuccessPage() {
  const router = useRouter();
  const { id, success } = router.query;
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState("Waiting for WooCommerce to send credentials...");

  useEffect(() => {
    if (!id || typeof id !== "string" || success !== "1") return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 * 1.5s = 30s

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      const { data, error } = await supabase
        .from("stores")
        .select("id, status, consumer_key, consumer_secret")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[Connect] Poll error:", error);
      }

      if (data?.consumer_key && data?.consumer_secret) {
        if (cancelled) return;
        setPhase("connected");
        setMessage("Credentials received. Registering webhooks and starting initial sync...");

        // Safety-net: explicitly trigger webhook registration + sync in case the WC server-to-server
        // callback failed silently (ad blocker, firewall, etc.) during the OAuth handshake.
        Promise.allSettled([
          fetch(`/api/stores/${id}/register-webhooks`, { method: "POST" }),
          fetch(`/api/stores/${id}/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }),
        ]).then(() => {
          if (cancelled) return;
          setTimeout(() => router.push(`/sites/${id}`), 1200);
        });
        return;
      }

      if (attempts >= maxAttempts) {
        if (cancelled) return;
        setPhase("timeout");
        setMessage("We did not receive credentials from WooCommerce within 30 seconds.");
        return;
      }

      setTimeout(poll, 1500);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [id, success, router]);

  if (!id) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {phase === "connected" && (
              <>
                <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Store Connected</h1>
                <p className="text-muted-foreground mb-4">{message}</p>
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
              </>
            )}
            {phase === "verifying" && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Connecting Store...</h1>
                <p className="text-muted-foreground">{message}</p>
              </>
            )}
            {phase === "timeout" && (
              <>
                <AlertTriangle className="h-16 w-16 text-warning mx-auto mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Connection Pending</h1>
                <p className="text-muted-foreground mb-4">
                  {message} This is often caused by an ad blocker or firewall blocking the WooCommerce callback.
                  Try disabling ad blockers, or reconnect using Manual Keys.
                </p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sites/${id}`}>
                    <Button variant="outline">Go to Site</Button>
                  </Link>
                  <Link href="/sites">
                    <Button>Back to Sites</Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}