import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Lottie from "lottie-react";
import { ConnectLayout } from "@/components/layout/ConnectLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertTriangle, Circle, KeyRound, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildWooCommerceAuthUrl } from "@/lib/woocommerce-auth";
import { updateStore } from "@/services/storeService";
import { ConnectionDiagnostic } from "@/components/project/ConnectionDiagnostic";

type StepStatus = "pending" | "active" | "done" | "error";
interface Step { id: string; label: string; status: StepStatus; }
type Stage = "loading" | "credentials" | "woo" | "wp" | "prefetching" | "done";

const INITIAL_STEPS: Step[] = [
  { id: "auth", label: "Authorizing with WooCommerce", status: "pending" },
  { id: "creds", label: "Receiving API credentials", status: "pending" },
  { id: "wp", label: "Authorize WordPress media access", status: "pending" },
  { id: "webhooks", label: "Registering webhooks", status: "pending" },
];

export default function ConnectSuccessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { id, success, wp, resume } = router.query;
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [stage, setStage] = useState<Stage>("loading");
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [showManual, setShowManual] = useState(false);
  const [manualUser, setManualUser] = useState("");
  const [manualPass, setManualPass] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [confettiData, setConfettiData] = useState<object | null>(null);
  const webhookRegisteredRef = useRef(false);
  const initRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCredsManual, setShowCredsManual] = useState(false);
  const [credsKey, setCredsKey] = useState("");
  const [credsSecret, setCredsSecret] = useState("");
  const [credsBusy, setCredsBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    fetch("/confetti.json").then(r => r.json()).then(setConfettiData).catch(() => setConfettiData(null));
  }, []);

  useEffect(() => () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); }, []);

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

  const launchToProducts = (sid: string) => {
    setStage("prefetching");
    setStep("webhooks", "done");

    fetch(`/api/stores/${sid}/prefetch`, { method: "POST" }).catch((e) => console.error("[prefetch]", e));

    redirectTimerRef.current = setTimeout(() => {
      router.push(`/sites/${sid}/products`);
    }, 2200);
  };

  const registerWebhooks = async (sid: string): Promise<boolean> => {
    setWebhookError(null);
    setStep("webhooks", "active");
    try {
      const res = await fetch(`/api/stores/${sid}/register-webhooks`, { method: "POST" });
      const text = await res.text();
      let json: { success?: boolean; message?: string; error?: string } = {};
      try { json = JSON.parse(text); } catch {
        const preview = text.slice(0, 120).replace(/\s+/g, " ");
        setWebhookError(`Server returned non-JSON (HTTP ${res.status}). ${preview}`);
        setStep("webhooks", "error");
        return false;
      }
      if (!res.ok || !json.success) {
        setWebhookError(json.error || json.message || `HTTP ${res.status}`);
        setStep("webhooks", "error");
        return false;
      }
      setStep("webhooks", "done");
      webhookRegisteredRef.current = true;
      return true;
    } catch (e) {
      setWebhookError(e instanceof Error ? e.message : "Network error registering webhooks");
      setStep("webhooks", "error");
      return false;
    }
  };

  const runWebhooksAndLaunch = async () => {
    if (!siteId) return;
    if (!webhookRegisteredRef.current && !webhookError) {
      const ok = await registerWebhooks(siteId);
      if (!ok) return;
    }
    launchToProducts(siteId);
  };

  const handleWebhookRetry = async () => {
    if (!siteId) return;
    const ok = await registerWebhooks(siteId);
    if (ok) launchToProducts(siteId);
  };

  const handleWebhookSkip = () => {
    if (!siteId) return;
    webhookRegisteredRef.current = true;
    setStep("webhooks", "error");
    launchToProducts(siteId);
  };

  const startOAuthPolling = (sid: string) => {
    setStep("auth", "active");
    setStage("woo");
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;
    (async () => {
      while (attempts < maxAttempts && !cancelled) {
        attempts += 1;
        const { data } = await supabase
          .from("stores")
          .select("id, url, name, consumer_key, consumer_secret, wp_username")
          .eq("id", sid)
          .maybeSingle();
        if (data?.consumer_key && data?.consumer_secret) {
          setStoreUrl(data.url);
          setStoreName(data.name || "your store");
          setStep("auth", "done");
          setStep("creds", "done");
          if (data.wp_username) {
            setStep("wp", "done");
            runWebhooksAndLaunch();
          } else {
            setStage("wp");
            advanceFrom("wp");
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (cancelled) return;
      setStep("auth", "error");
      setStage("credentials");
      setErrorMessage("We didn't receive credentials from WooCommerce within 30 seconds. You can restart the OAuth flow or enter your keys manually.");
    })();
    return () => { cancelled = true; };
  };

  const handleRestartOAuth = () => {
    if (!siteId || !storeUrl) return;
    window.location.href = buildWooCommerceAuthUrl({ storeUrl, storeId: siteId });
  };

  const handleSaveManualCreds = async () => {
    if (!siteId || !credsKey.trim() || !credsSecret.trim()) return;
    setCredsBusy(true);
    try {
      await updateStore(siteId, {
        consumer_key: credsKey.trim(),
        consumer_secret: credsSecret.trim(),
        status: "connected",
      });
      setStep("auth", "done");
      setStep("creds", "done");
      const { data } = await supabase.from("stores").select("wp_username, name").eq("id", siteId).maybeSingle();
      if (data?.name) setStoreName(data.name);
      if (data?.wp_username) {
        setStep("wp", "done");
        runWebhooksAndLaunch();
      } else {
        setStage("wp");
        advanceFrom("wp");
      }
      toast({ title: "Credentials saved" });
    } catch (e) {
      toast({ title: "Failed to save", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setCredsBusy(false);
    }
  };

  useEffect(() => {
    if (!siteId || initRef.current) return;
    initRef.current = true;

    if (wp) {
      if (wp === "ok") {
        setSteps((prev) => prev.map((s) =>
          ["auth", "creds", "wp"].includes(s.id) ? { ...s, status: "done" } : s
        ));
        (async () => {
          const { data } = await supabase.from("stores").select("url, name").eq("id", siteId).maybeSingle();
          if (data?.url) setStoreUrl(data.url);
          if (data?.name) setStoreName(data.name);
          runWebhooksAndLaunch();
        })();
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
        (async () => {
          const { data } = await supabase.from("stores").select("url, name").eq("id", siteId).maybeSingle();
          if (data?.url) setStoreUrl(data.url);
          if (data?.name) setStoreName(data.name);
        })();
      }
      return;
    }

    (async () => {
      const { data: store } = await supabase
        .from("stores")
        .select("id, url, name, consumer_key, consumer_secret, wp_username, onboarding_completed_at")
        .eq("id", siteId)
        .maybeSingle();

      if (!store) {
        setFailed(true);
        setErrorMessage("Site not found.");
        return;
      }

      setStoreUrl(store.url);
      setStoreName(store.name || "your store");

      if (store.onboarding_completed_at) {
        router.replace(`/sites/${siteId}/products`);
        return;
      }

      if (success === "1" && !store.consumer_key) {
        startOAuthPolling(siteId);
        return;
      }

      if (!store.consumer_key || !store.consumer_secret) {
        setStep("auth", "error");
        setStage("credentials");
        if (resume === "1") {
          setErrorMessage("Looks like the connection didn't complete. Restart OAuth or enter your keys manually to continue.");
        }
        return;
      }

      setStep("auth", "done");
      setStep("creds", "done");

      if (!store.wp_username) {
        setStage("wp");
        advanceFrom("wp");
        if (resume === "1") {
          setErrorMessage("Continuing setup — authorize WordPress to enable media uploads, or skip for now.");
        }
        return;
      }

      setStep("wp", "done");
      runWebhooksAndLaunch();
    })();
  }, [siteId, success, wp, resume]);

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
        runWebhooksAndLaunch();
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
    runWebhooksAndLaunch();
  };

  const completedCount = steps.filter((s) => s.status === "done").length;

  if (!siteId || stage === "loading") {
    return (
      <ConnectLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ConnectLayout>
    );
  }

  if (stage === "prefetching") {
    return (
      <ConnectLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 relative overflow-hidden">
          {confettiData && (
            <div className="absolute inset-0 pointer-events-none">
              <Lottie animationData={confettiData} loop={false} autoplay />
            </div>
          )}
          <div className="relative z-10 text-center space-y-3 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-5xl">🚀</div>
            <h1 className="text-3xl font-bold">Welcome to Proxima</h1>
            <p className="text-muted-foreground">Your site is ready</p>
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-4" />
          </div>
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
                  : stage === "credentials" ? "Resume Setup"
                  : stage === "wp" ? "Authorize WordPress"
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

            {stage === "credentials" && (
              <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Credentials not received</p>
                    <p className="text-xs text-muted-foreground">
                      {errorMessage || "We don't have API credentials for this store yet. You can restart the OAuth flow or paste keys manually."}
                    </p>
                  </div>
                </div>

                {siteId && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Connection diagnostic</p>
                    <ConnectionDiagnostic storeId={siteId} autoRun />
                  </div>
                )}

                <Button onClick={handleRestartOAuth} className="w-full" size="lg" disabled={!storeUrl}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restart OAuth
                </Button>

                <div className="text-center">
                  <button type="button" onClick={() => setShowCredsManual((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground underline">
                    {showCredsManual ? "Hide manual entry" : "Enter API keys manually instead"}
                  </button>
                </div>

                {showCredsManual && (
                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <p className="text-xs text-muted-foreground">
                      Create keys in WooCommerce → Settings → Advanced → REST API (Read/Write).
                      {storeUrl && (
                        <> {" "}
                          <a
                            href={`${storeUrl.replace(/\/$/, "")}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline inline-flex items-center gap-0.5"
                          >
                            Open in store <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="ck-key" className="text-xs">Consumer Key</Label>
                      <Input id="ck-key" value={credsKey} onChange={(e) => setCredsKey(e.target.value)} placeholder="ck_..." className="h-9 font-mono text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cs-key" className="text-xs">Consumer Secret</Label>
                      <Input id="cs-key" type="password" value={credsSecret} onChange={(e) => setCredsSecret(e.target.value)} placeholder="cs_..." className="h-9 font-mono text-xs" />
                    </div>
                    <Button onClick={handleSaveManualCreds} disabled={!credsKey || !credsSecret || credsBusy} className="w-full" size="sm">
                      {credsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Continue"}
                    </Button>
                  </div>
                )}

                <div className="text-center pt-1">
                  <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground underline">
                    Cancel — I&apos;ll finish later from the sites list
                  </Link>
                </div>
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