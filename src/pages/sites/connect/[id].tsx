import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertTriangle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";

type StepStatus = "pending" | "active" | "done" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

const INITIAL_STEPS: Step[] = [
  { id: "auth", label: "Authorizing with WooCommerce", status: "active" },
  { id: "creds", label: "Receiving API credentials", status: "pending" },
  { id: "webhooks", label: "Registering webhooks", status: "pending" },
  { id: "sync", label: "Starting initial data sync", status: "pending" },
  { id: "redirect", label: "Redirecting to site dashboard", status: "pending" },
];

export default function ConnectSuccessPage() {
  const router = useRouter();
  const { id, success } = router.query;
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const setStep = (id: string, status: StepStatus) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const advanceFrom = (id: string) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      return prev.map((s, i) => {
        if (i < idx) return { ...s, status: "done" as StepStatus };
        if (i === idx) return { ...s, status: "active" as StepStatus };
        return s;
      });
    });
  };

  useEffect(() => {
    if (!id || typeof id !== "string" || success !== "1") return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const runFlow = async () => {
      advanceFrom("auth");

      while (attempts < maxAttempts && !cancelled) {
        attempts += 1;
        const { data } = await supabase
          .from("stores")
          .select("id, consumer_key, consumer_secret")
          .eq("id", id)
          .maybeSingle();

        if (data?.consumer_key && data?.consumer_secret) {
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (cancelled) return;

      if (attempts >= maxAttempts) {
        setStep("auth", "error");
        setFailed(true);
        setErrorMessage("We did not receive credentials from WooCommerce within 30 seconds. This is often caused by an ad blocker or firewall blocking the callback.");
        return;
      }

      setStep("auth", "done");
      advanceFrom("creds");
      await new Promise((r) => setTimeout(r, 400));
      setStep("creds", "done");
      advanceFrom("webhooks");

      try {
        const whRes = await fetch(`/api/stores/${id}/register-webhooks`, { method: "POST" });
        setStep("webhooks", whRes.ok ? "done" : "error");
      } catch {
        setStep("webhooks", "error");
      }

      if (cancelled) return;
      advanceFrom("sync");

      try {
        const syncRes = await fetch(`/api/stores/${id}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        setStep("sync", syncRes.ok ? "done" : "error");
      } catch {
        setStep("sync", "error");
      }

      if (cancelled) return;
      advanceFrom("redirect");

      await new Promise((r) => setTimeout(r, 800));
      setStep("redirect", "done");
      if (!cancelled) router.push(`/sites/${id}`);
    };

    runFlow();
    return () => {
      cancelled = true;
    };
  }, [id, success, router]);

  const completedCount = steps.filter((s) => s.status === "done").length;

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
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 pb-6">
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold mb-1">
                {failed ? "Connection Pending" : "Connecting Store"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {failed
                  ? "Something didn't complete as expected"
                  : `Step ${Math.min(completedCount + 1, steps.length)} of ${steps.length}`}
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <div className="shrink-0">
                    {step.status === "done" && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    )}
                    {step.status === "active" && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {step.status === "pending" && (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                    {step.status === "error" && (
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    )}
                  </div>
                  <span
                    className={
                      step.status === "pending"
                        ? "text-sm text-muted-foreground"
                        : step.status === "error"
                        ? "text-sm text-warning font-medium"
                        : "text-sm text-foreground font-medium"
                    }
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {failed && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-muted-foreground text-center">{errorMessage}</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sites/${id}`}>
                    <Button variant="outline" size="sm">Go to Site</Button>
                  </Link>
                  <Link href="/projects">
                    <Button size="sm">Back to Sites</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}