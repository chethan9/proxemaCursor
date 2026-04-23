import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import Lottie from "lottie-react";
import { ConnectLayout } from "@/components/layout/ConnectLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Loader2, AlertCircle, ExternalLink, Key, ArrowLeft, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import confettiAnim from "../../../../public/confetti.json";

type StepStatus = "pending" | "active" | "done" | "error";
type Step = { id: string; label: string; status: StepStatus };
type Stage = "oauth" | "creds" | "wp" | "prefetching";

const INITIAL_STEPS: Step[] = [
  { id: "woo-auth", label: "Authorizing with WooCommerce", status: "active" },
  { id: "api-creds", label: "Receiving API credentials", status: "pending" },
  { id: "wp", label: "Authorize WordPress media access", status: "pending" },
  { id: "webhooks", label: "Registering webhooks", status: "pending" },
];

function StepRow({ step, retry, skip }: { step: Step; retry?: () => void; skip?: () => void }) {
  const Icon = step.status === "done" ? CheckCircle2 : step.status === "active" ? Loader2 : step.status === "error" ? AlertCircle : Circle;
  const color = step.status === "done" ? "text-success" : step.status === "active" ? "text-primary" : step.status === "error" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2.5", step.status === "error" ? "border-destructive/30 bg-destructive/5" : "border-border")}>
      <Icon className={cn("h-4 w-4 shrink-0", color, step.status === "active" && "animate-spin")} />
      <span className={cn("text-sm flex-1", step.status === "pending" && "text-muted-foreground")}>{step.label}</span>
      {step.status === "error" && retry && (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={retry}><RotateCw className="h-3 w-3 mr-1" />Retry</Button>
      )}
      {step.status === "error" && skip && (
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={skip}>Skip</Button>
      )}
    </div>
  );
}

export default function ConnectPage() {
  const router = useRouter();
  const { toast } = useToast();
  const siteId = typeof router.query.id === "string" ? router.query.id : "";
  const { success, wp, error: urlError } = router.query;

  const [stage, setStage] = useState<Stage>("oauth");
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);

  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [savingWp, setSavingWp] = useState(false);
  const [showManualWp, setShowManualWp] = useState(false);

  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookCount, setWebhookCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const hasFiredWebhooksRef = useRef(false);
  const webhookCompleteRef = useRef(false);
  const wpCompleteRef = useRef(false);
  const launchedRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  const setStepStatus = (id: string, status: StepStatus) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const webhookStep = useMemo(() => {
    const s = steps.find((x) => x.id === "webhooks")!;
    const label = s.status === "done" && webhookCount > 0 ? `Webhooks registered (${webhookCount})` : s.status === "error" ? `Webhook registration failed${webhookError ? ` — ${webhookError}` : ""}` : s.label;
    return { ...s, label };
  }, [steps, webhookCount, webhookError]);

  const launchToProducts = async (sid: string) => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    setStage("prefetching");
    setShowConfetti(true);
    try {
      await fetch(`/api/stores/${sid}/prefetch`, { method: "POST" });
    } catch { /* best-effort */ }
    setTimeout(() => { router.replace(`/sites/${sid}/products`); }, 2200);
  };

  const maybeLaunch = (sid: string) => {
    if (webhookCompleteRef.current && wpCompleteRef.current) {
      launchToProducts(sid);
    }
  };

  const registerWebhooksCall = async (sid: string): Promise<boolean> => {
    setStepStatus("webhooks", "active");
    setWebhookError(null);
    try {
      const res = await fetch(`/api/stores/${sid}/register-webhooks`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setStepStatus("webhooks", "error");
        setWebhookError(json.error || `Failed (${res.status})`);
        return false;
      }
      const count = Array.isArray(json.results) ? json.results.filter((r: { success: boolean }) => r.success).length : 0;
      setWebhookCount(count);
      setStepStatus("webhooks", "done");
      return true;
    } catch (e) {
      setStepStatus("webhooks", "error");
      setWebhookError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const kickoffWebhooks = async (sid: string) => {
    if (hasFiredWebhooksRef.current) return;
    hasFiredWebhooksRef.current = true;
    const ok = await registerWebhooksCall(sid);
    if (ok) {
      webhookCompleteRef.current = true;
      maybeLaunch(sid);
    }
  };

  const handleWebhookRetry = async () => {
    if (!siteId) return;
    hasFiredWebhooksRef.current = false;
    await kickoffWebhooks(siteId);
  };

  const handleWebhookSkip = () => {
    if (!siteId) return;
    webhookCompleteRef.current = true;
    toast({ title: "Continuing without webhooks", description: "You can register them later from site settings." });
    maybeLaunch(siteId);
  };

  const completeWpSuccessfully = (sid: string) => {
    setStepStatus("wp", "done");
    wpCompleteRef.current = true;
    maybeLaunch(sid);
  };

  const skipWpAndContinue = (sid: string) => {
    setStepStatus("wp", "done");
    wpCompleteRef.current = true;
    maybeLaunch(sid);
  };

  const handleManualWpSave = async () => {
    if (!siteId || !wpUsername.trim() || !wpAppPassword.trim()) return;
    setSavingWp(true);
    try {
      const { error: upErr } = await supabase
        .from("stores")
        .update({ wp_username: wpUsername.trim(), wp_app_password: wpAppPassword.trim() })
        .eq("id", siteId);
      if (upErr) throw upErr;
      completeWpSuccessfully(siteId);
    } catch (e) {
      toast({ title: "Failed to save WP credentials", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSavingWp(false);
    }
  };

  const handleSaveManualApiCreds = async () => {
    if (!siteId || !apiKey.trim() || !apiSecret.trim()) return;
    setSavingCreds(true);
    try {
      const { error: upErr } = await supabase
        .from("stores")
        .update({ consumer_key: apiKey.trim(), consumer_secret: apiSecret.trim() })
        .eq("id", siteId);
      if (upErr) throw upErr;
      setStepStatus("woo-auth", "done");
      setStepStatus("api-creds", "done");
      // Kick off webhooks immediately in background
      kickoffWebhooks(siteId);
      // Check if WP already done
      const { data: store } = await supabase.from("stores").select("wp_username, wp_app_password").eq("id", siteId).single();
      if (store?.wp_username && store?.wp_app_password) {
        completeWpSuccessfully(siteId);
      } else {
        setStage("wp");
        setStepStatus("wp", "active");
      }
    } catch (e) {
      toast({ title: "Failed to save credentials", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSavingCreds(false);
    }
  };

  const startOAuthPolling = async (sid: string) => {
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;
    setStepStatus("woo-auth", "active");
    setError(null);
    setRetryable(false);

    const started = Date.now();
    const TIMEOUT_MS = 90_000;
    while (!controller.signal.aborted) {
      if (Date.now() - started > TIMEOUT_MS) {
        setStepStatus("woo-auth", "error");
        setError("OAuth timed out. You can enter API credentials manually.");
        setRetryable(true);
        return;
      }
      try {
        const { data: store } = await supabase
          .from("stores")
          .select("consumer_key, consumer_secret, wp_username, wp_app_password")
          .eq("id", sid)
          .abortSignal(controller.signal)
          .single();
        if (store?.consumer_key && store?.consumer_secret) {
          setStepStatus("woo-auth", "done");
          setStepStatus("api-creds", "done");
          // Fire webhooks in background immediately
          kickoffWebhooks(sid);
          // Check WP already done
          if (store.wp_username && store.wp_app_password) {
            completeWpSuccessfully(sid);
          } else {
            setStage("wp");
            setStepStatus("wp", "active");
          }
          return;
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        console.warn("Poll error:", e);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  // Initial mount: figure out which stage we're in
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: store, error: fetchErr } = await supabase
          .from("stores")
          .select("consumer_key, consumer_secret, wp_username, wp_app_password")
          .eq("id", siteId)
          .single();
        if (cancelled) return;
        if (fetchErr) throw fetchErr;
        const hasCreds = !!(store?.consumer_key && store?.consumer_secret);
        const hasWp = !!(store?.wp_username && store?.wp_app_password);

        if (urlError) {
          setStepStatus("woo-auth", "error");
          setError(typeof urlError === "string" ? urlError : "OAuth failed");
          setRetryable(true);
          return;
        }

        if (hasCreds) {
          setStepStatus("woo-auth", "done");
          setStepStatus("api-creds", "done");
          // Background webhook kickoff on every mount with creds present
          kickoffWebhooks(siteId);

          if (wp === "ok" || hasWp) {
            completeWpSuccessfully(siteId);
          } else {
            setStage("wp");
            setStepStatus("wp", "active");
          }
        } else if (success === "1") {
          startOAuthPolling(siteId);
        } else {
          startOAuthPolling(siteId);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setRetryable(true);
      }
    })();
    return () => {
      cancelled = true;
      pollAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // Handle WP callback return
  useEffect(() => {
    if (wp === "ok" && siteId && !wpCompleteRef.current && stage === "wp") {
      completeWpSuccessfully(siteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wp, siteId]);

  const handleRetryOAuth = async () => {
    if (!siteId) return;
    setRetrying(true);
    try {
      const { data: store } = await supabase.from("stores").select("url").eq("id", siteId).single();
      if (!store?.url) throw new Error("Store URL missing");
      const returnUrl = `${window.location.origin}/api/woocommerce/callback?store_id=${siteId}`;
      const authUrl = `${store.url}/wc-auth/v1/authorize?app_name=Proxima&scope=read_write&user_id=${siteId}&return_url=${encodeURIComponent(returnUrl)}&callback_url=${encodeURIComponent(returnUrl)}`;
      window.location.href = authUrl;
    } catch (e) {
      toast({ title: "Retry failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      setRetrying(false);
    }
  };

  const startWpAuth = () => {
    if (!siteId) return;
    const returnUrl = `${window.location.origin}/api/wordpress/app-password-callback?store_id=${siteId}`;
    supabase
      .from("stores")
      .select("url")
      .eq("id", siteId)
      .single()
      .then(({ data }) => {
        if (!data?.url) {
          toast({ title: "Store URL missing", variant: "destructive" });
          return;
        }
        const appName = "Proxima";
        const wpAuthUrl = `${data.url}/wp-admin/authorize-application.php?app_name=${encodeURIComponent(appName)}&success_url=${encodeURIComponent(returnUrl)}`;
        window.location.href = wpAuthUrl;
      });
  };

  const nextDisabled = !webhookCompleteRef.current || !wpCompleteRef.current;

  return (
    <ConnectLayout>
      <div className="max-w-xl mx-auto p-6 space-y-5">
        {stage === "oauth" && (
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">Connecting to WooCommerce</h1>
            <p className="text-sm text-muted-foreground">Approve the authorization on your site. This page will advance automatically.</p>
          </div>
        )}
        {stage === "wp" && (
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">Authorize WordPress</h1>
            <p className="text-sm text-muted-foreground">Step 3 of 4</p>
          </div>
        )}
        {stage === "prefetching" && (
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">Preparing your store</h1>
            <p className="text-sm text-muted-foreground">Syncing products, orders, and customers…</p>
          </div>
        )}

        <div className="space-y-2">
          {steps.map((s) => {
            if (s.id === "webhooks") {
              return <StepRow key={s.id} step={webhookStep} retry={s.status === "error" ? handleWebhookRetry : undefined} skip={s.status === "error" ? handleWebhookSkip : undefined} />;
            }
            return <StepRow key={s.id} step={s} />;
          })}
        </div>

        {error && stage === "oauth" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authorization failed</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{error}</p>
              {retryable && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleRetryOAuth} disabled={retrying}>
                    {retrying ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Retrying…</> : <><RotateCw className="h-4 w-4 mr-1.5" />Retry OAuth</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStage("creds")}>Enter keys manually</Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {stage === "creds" && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2"><Key className="h-4 w-4 text-primary" /><div className="text-sm font-medium">Enter API credentials manually</div></div>
            <div className="space-y-2">
              <Label>Consumer Key</Label>
              <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="ck_…" />
            </div>
            <div className="space-y-2">
              <Label>Consumer Secret</Label>
              <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="cs_…" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveManualApiCreds} disabled={savingCreds || !apiKey.trim() || !apiSecret.trim()}>
                {savingCreds ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : "Save & continue"}
              </Button>
              <Button variant="ghost" onClick={() => setStage("oauth")}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            </div>
          </div>
        )}

        {stage === "wp" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Key className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-sm">WordPress Media Access</div>
                  <div className="text-xs text-muted-foreground">To upload product images directly to your WooCommerce media library, we need a WordPress Application Password. Click Authorize — you&apos;ll approve on your own site, no password needed here.</div>
                </div>
              </div>
              <Button className="w-full" onClick={startWpAuth}><ExternalLink className="h-4 w-4 mr-1.5" />Authorize via WordPress</Button>
              <div className="flex items-center justify-between text-xs">
                <button onClick={() => setShowManualWp((v) => !v)} className="text-muted-foreground hover:text-foreground underline">
                  {showManualWp ? "Hide manual entry" : "Having trouble? Enter credentials manually"}
                </button>
                <button onClick={() => skipWpAndContinue(siteId)} className="text-muted-foreground hover:text-foreground underline">
                  Skip for now — I&apos;ll set this up later
                </button>
              </div>
              {showManualWp && (
                <div className="space-y-2 pt-3 border-t">
                  <div className="space-y-2"><Label>Username</Label><Input value={wpUsername} onChange={(e) => setWpUsername(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Application Password</Label><Input type="password" value={wpAppPassword} onChange={(e) => setWpAppPassword(e.target.value)} /></div>
                  <Button onClick={handleManualWpSave} disabled={savingWp || !wpUsername.trim() || !wpAppPassword.trim()} size="sm">
                    {savingWp ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : "Save"}
                  </Button>
                </div>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground text-center">
              {nextDisabled ? "Finishing up in the background…" : "All set — launching your dashboard"}
            </div>
          </div>
        )}

        {stage === "prefetching" && showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50">
            <Lottie animationData={confettiAnim} loop={false} />
          </div>
        )}

        <div className="pt-4 text-center">
          <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3 inline mr-1" />Back to projects</Link>
        </div>
      </div>
    </ConnectLayout>
  );
}
