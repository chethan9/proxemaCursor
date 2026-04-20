import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ConnectLayout } from "@/components/layout/ConnectLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertTriangle, Circle, KeyRound, ExternalLink, Rocket, Package, ShoppingCart, Users, Tag as TagIcon, Percent, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { pickProgressMessage } from "@/lib/sync-messages";

type StepStatus = "pending" | "active" | "done" | "error";
interface Step { id: string; label: string; status: StepStatus; }

const INITIAL_STEPS: Step[] = [
  { id: "auth", label: "Authorizing with WooCommerce", status: "active" },
  { id: "creds", label: "Receiving API credentials", status: "pending" },
  { id: "wp", label: "Authorize WordPress media access", status: "pending" },
  { id: "webhooks", label: "Registering webhooks", status: "pending" },
  { id: "estimate", label: "Scanning store inventory", status: "pending" },
  { id: "liftoff", label: "Preparing for liftoff", status: "pending" },
];

interface Estimate {
  counts: { products: number; orders: number; customers: number; categories: number; tags: number; coupons: number };
  total: number;
  eta_seconds: number;
}

function formatEta(s: number): string {
  if (s < 60) return `~${s} seconds`;
  const m = Math.ceil(s / 60);
  return `~${m} minute${m === 1 ? "" : "s"}`;
}

export default function ConnectSuccessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { id, success, wp } = router.query;
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [stage, setStage] = useState<"woo" | "wp" | "estimating" | "liftoff" | "done">("woo");
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [showManual, setShowManual] = useState(false);
  const [manualUser, setManualUser] = useState("");
  const [manualPass, setManualPass] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const estimateStartedRef = useRef(false);
  const [progressTick, setProgressTick] = useState(0);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookSummary, setWebhookSummary] = useState<string | null>(null);
  const webhookRegisteredRef = useRef(false);

  useEffect(() => {
    if (stage !== "estimating") return;
    const id = setInterval(() => setProgressTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, [stage]);

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

  const siteId = typeof id === "string" ? id : null;
  const baseCallback = useMemo(() => {
    if (typeof window === "undefined" || !siteId) return "";
    return `${window.location.origin}/api/wordpress/app-password-callback?state=${siteId}`;
  }, [siteId]);
  const authorizeUrl = useMemo(() => {
    if (!storeUrl || !siteId) return "";
    const clean = storeUrl.replace(/\/$/, "");
    const successUrl = encodeURIComponent(baseCallback);
    const rejectUrl = encodeURIComponent(`${baseCallback}&rejected=1`);
    return `${clean}/wp-admin/authorize-application.php?app_name=Proxima&app_id=${siteId}&success_url=${successUrl}&reject_url=${rejectUrl}`;
  }, [storeUrl, siteId, baseCallback]);

  const startEstimate = async (sid: string) => {
    if (estimateStartedRef.current) return;
    estimateStartedRef.current = true;
    try {
      const estRes = await fetch(`/api/stores/${sid}/estimate`);
      const estData: Estimate = await estRes.json();
      setEstimate(estData);
    } catch (e) {
      console.error("estimate err", e);
      setEstimate({ counts: { products: 0, orders: 0, customers: 0, categories: 0, tags: 0, coupons: 0 }, total: 0, eta_seconds: 60 });
    }
  };

  const registerWebhooks = async (sid: string): Promise<boolean> => {
    setWebhookError(null);
    setStep("webhooks", "active");
    try {
      const res = await fetch(`/api/stores/${sid}/register-webhooks`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setWebhookError(json.error || json.message || "Webhook registration failed");
        setStep("webhooks", "error");
        return false;
      }
      setWebhookSummary(json.message || "Webhooks registered");
      setStep("webhooks", "done");
      webhookRegisteredRef.current = true;
      return true;
    } catch (e) {
      setWebhookError(e instanceof Error ? e.message : "Network error registering webhooks");
      setStep("webhooks", "error");
      return false;
    }
  };

  const runEstimateAndLiftoff = async () => {
    if (!siteId) return;
    if (!webhookRegisteredRef.current && !webhookError) {
      const ok = await registerWebhooks(siteId);
      if (!ok) return; // Stop here — user must retry or skip
    }
    setStage("estimating");
    setStep("estimate", "active");

    if (!estimate) {
      await startEstimate(siteId);
      const deadline = Date.now() + 10000;
      while (!estimate && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    setStep("estimate", "done");
    setStep("liftoff", "active");
    setStage("liftoff");
  };

  const handleWebhookRetry = async () => {
    if (!siteId) return;
    const ok = await registerWebhooks(siteId);
    if (ok) await runEstimateAndLiftoff();
  };

  const handleWebhookSkip = async () => {
    webhookRegisteredRef.current = true;
    setStep("webhooks", "error");
    await runEstimateAndLiftoff();
  };

  const handleLiftoff = async () => {
    if (!siteId || !estimate) return;
    try {
      await fetch(`/api/stores/${siteId}/sync-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimated_total: estimate.total, is_initial: true }),
      });
      setStep("liftoff", "done");
      setStage("done");
      toast({ title: "🚀 Liftoff!", description: "Syncing in background. Explore freely — progress is at the top." });
      router.push(`/sites/${siteId}/products`);
    } catch (e) {
      toast({ title: "Couldn't start sync", description: e instanceof Error ? e.message : "Try again from site settings", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!siteId || success !== "1") return;

    if (wp) {
      if (wp === "ok") {
        setSteps((prev) => prev.map((s) => {
          if (["auth", "creds", "wp"].includes(s.id)) return { ...s, status: "done" };
          return s;
        }));
        runEstimateAndLiftoff();
      } else {
        setStage("wp");
        setSteps((prev) => prev.map((s) => {
          if (["auth", "creds"].includes(s.id)) return { ...s, status: "done" };
          if (s.id === "wp") return { ...s, status: "error" };
          return s;
        }));
        setShowManual(true);
        setErrorMessage(
          wp === "rejected"
            ? "You rejected the WordPress authorization. You can enter credentials manually or skip for now."
            : "WordPress did not return credentials. Try manual entry or skip for now."
        );
      }
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    (async () => {
      advanceFrom("auth");
      while (attempts < maxAttempts && !cancelled) {
        attempts += 1;
        const { data } = await supabase
          .from("stores")
          .select("id, url, consumer_key, consumer_secret, wp_username")
          .eq("id", siteId)
          .maybeSingle();
        if (data?.consumer_key && data?.consumer_secret) {
          setStoreUrl(data.url);
          if (!cancelled) {
            setStep("auth", "done");
            setStep("creds", "done");
            // Fire estimate in parallel - user is about to spend time on WP auth
            startEstimate(siteId);
            if (data.wp_username) {
              setStep("wp", "done");
              runEstimateAndLiftoff();
            } else {
              setStage("wp");
              advanceFrom("wp");
            }
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (cancelled) return;
      setStep("auth", "error");
      setFailed(true);
      setErrorMessage("We did not receive credentials from WooCommerce within 30 seconds. This is often caused by an ad blocker or firewall blocking the callback.");
    })();

    return () => { cancelled = true; };
  }, [siteId, success, wp]);

  const handleManualSave = async () => {
    if (!siteId || !manualUser || !manualPass) return;
    setManualBusy(true);
    try {
      const res = await fetch(`/api/stores/${siteId}/test-wp-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: manualUser, password: manualPass }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "WordPress credentials saved" });
        setStep("wp", "done");
        runEstimateAndLiftoff();
      } else {
        toast({ title: "Credentials invalid", description: json.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Network error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setManualBusy(false);
    }
  };

  const handleSkipWp = () => {
    setStep("wp", "error");
    runEstimateAndLiftoff();
  };

  const completedCount = steps.filter((s) => s.status === "done").length;

  if (!siteId) {
    return (
      <ConnectLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ConnectLayout>
    );
  }

  return (
    <ConnectLayout>
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 pb-6">
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold mb-1">
                {failed ? "Connection Pending"
                  : stage === "wp" ? "Authorize WordPress"
                  : stage === "liftoff" ? "Ready for Liftoff"
                  : stage === "estimating" ? "Scanning your store"
                  : "Connecting Store"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {failed ? "Something didn't complete as expected" : `Step ${Math.min(completedCount + 1, steps.length)} of ${steps.length}`}
              </p>
            </div>

            <div className="space-y-2 mb-5">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                  <div className="shrink-0">
                    {step.status === "done" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    {step.status === "active" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {step.status === "pending" && <Circle className="h-5 w-5 text-muted-foreground/40" />}
                    {step.status === "error" && <AlertTriangle className="h-5 w-5 text-warning" />}
                  </div>
                  <span className={
                    step.status === "pending" ? "text-sm text-muted-foreground"
                    : step.status === "error" ? "text-sm text-warning font-medium"
                    : "text-sm text-foreground font-medium"
                  }>{step.label}</span>
                </div>
              ))}
            </div>

            {stage === "liftoff" && estimate && (
              <div className="space-y-4 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Rocket className="h-6 w-6 text-primary" />
                    <Sparkles className="h-3 w-3 text-primary/70 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-0.5">Ready for liftoff to Proxima</p>
                    <p className="text-xs text-muted-foreground">
                      Your store is prepped. Estimated sync time: <span className="font-medium text-foreground">{formatEta(estimate.eta_seconds)}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 rounded-md bg-background/60 px-2.5 py-1.5">
                    <Package className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-muted-foreground">Products:</span>
                    <span className="font-medium ml-auto tabular-nums">{estimate.counts.products.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-background/60 px-2.5 py-1.5">
                    <ShoppingCart className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-muted-foreground">Orders:</span>
                    <span className="font-medium ml-auto tabular-nums">{estimate.counts.orders.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-background/60 px-2.5 py-1.5">
                    <Users className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-muted-foreground">Customers:</span>
                    <span className="font-medium ml-auto tabular-nums">{estimate.counts.customers.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-background/60 px-2.5 py-1.5">
                    <TagIcon className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-muted-foreground">Categories:</span>
                    <span className="font-medium ml-auto tabular-nums">{estimate.counts.categories.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground italic text-center">
                  You can close this tab and come back — progress stays at the top of every page.
                </p>

                <Button onClick={handleLiftoff} className="w-full" size="lg">
                  <Rocket className="h-4 w-4 mr-2" />
                  Launch & Go to Dashboard
                </Button>
              </div>
            )}

            {stage === "wp" && !failed && (
              <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">WordPress Media Access</p>
                    <p className="text-xs text-muted-foreground">
                      To upload product images directly to your WooCommerce media library, we need a WordPress Application Password. Click Authorize — you&apos;ll approve on your own site, no password needed here.
                    </p>
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-xs text-warning bg-warning/10 rounded-md px-3 py-2">{errorMessage}</p>
                )}

                {authorizeUrl && (
                  <Button asChild className="w-full" size="lg">
                    <a href={authorizeUrl}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Authorize via WordPress
                    </a>
                  </Button>
                )}

                <div className="text-center">
                  <button type="button" onClick={() => setShowManual((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground underline">
                    {showManual ? "Hide manual entry" : "Having trouble? Enter credentials manually"}
                  </button>
                </div>

                {showManual && (
                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <p className="text-xs text-muted-foreground">
                      Generate an app password at{" "}
                      <a href={`${storeUrl.replace(/\/$/, "")}/wp-admin/profile.php#application-passwords-section`} target="_blank" rel="noreferrer" className="text-primary underline">your WP profile page</a>.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="wp-user" className="text-xs">Username or email</Label>
                      <Input id="wp-user" value={manualUser} onChange={(e) => setManualUser(e.target.value)} placeholder="admin" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wp-pass" className="text-xs">Application password</Label>
                      <Input id="wp-pass" type="password" value={manualPass} onChange={(e) => setManualPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" className="h-9 font-mono" />
                    </div>
                    <Button onClick={handleManualSave} disabled={!manualUser || !manualPass || manualBusy} className="w-full" size="sm">
                      {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test & Save"}
                    </Button>
                  </div>
                )}

                <div className="text-center pt-1">
                  <button type="button" onClick={handleSkipWp} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Skip for now — I&apos;ll set this up later
                  </button>
                </div>
              </div>
            )}

            {stage === "estimating" && (
              <div className="text-center py-3">
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span
                    key={progressTick}
                    className="animate-in fade-in slide-in-from-bottom-1 duration-500"
                  >
                    {pickProgressMessage(progressTick)}
                  </span>
                </div>
              </div>
            )}

            {webhookError && !failed && (
              <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-xs flex-1">
                    <p className="font-medium">Webhook registration failed</p>
                    <p className="text-muted-foreground mt-0.5">{webhookError}</p>
                    <p className="text-muted-foreground mt-1.5">Real-time sync won&apos;t work, but scheduled sync will still run. You can retry later from site settings.</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={handleWebhookSkip}>Skip & continue</Button>
                  <Button size="sm" onClick={handleWebhookRetry}>Retry</Button>
                </div>
              </div>
            )}

            {webhookSummary && !webhookError && stage === "liftoff" && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">Webhooks: {webhookSummary}</p>
            )}

            {failed && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-muted-foreground text-center">{errorMessage}</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sites/${siteId}`}><Button variant="outline" size="sm">Go to Site</Button></Link>
                  <Link href="/projects"><Button size="sm">Back to Sites</Button></Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ConnectLayout>
  );
}