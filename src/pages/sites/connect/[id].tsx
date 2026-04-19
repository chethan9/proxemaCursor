import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertTriangle, Circle, KeyRound, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type StepStatus = "pending" | "active" | "done" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

const INITIAL_STEPS: Step[] = [
  { id: "auth", label: "Authorizing with WooCommerce", status: "active" },
  { id: "creds", label: "Receiving API credentials", status: "pending" },
  { id: "wp", label: "Authorize WordPress media access", status: "pending" },
  { id: "webhooks", label: "Registering webhooks", status: "pending" },
  { id: "sync", label: "Starting initial data sync", status: "pending" },
  { id: "redirect", label: "Redirecting to site dashboard", status: "pending" },
];

export default function ConnectSuccessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { id, success, wp } = router.query;
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [stage, setStage] = useState<"woo" | "wp" | "finishing">("woo");
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [showManual, setShowManual] = useState(false);
  const [manualUser, setManualUser] = useState("");
  const [manualPass, setManualPass] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

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
    return `${clean}/wp-admin/authorize-application.php?app_name=WooSync&app_id=${siteId}&success_url=${successUrl}&reject_url=${rejectUrl}`;
  }, [storeUrl, siteId, baseCallback]);

  const finishRemainingSteps = async () => {
    if (!siteId) return;
    setStage("finishing");
    advanceFrom("webhooks");
    try {
      const whRes = await fetch(`/api/stores/${siteId}/register-webhooks`, { method: "POST" });
      setStep("webhooks", whRes.ok ? "done" : "error");
    } catch {
      setStep("webhooks", "error");
    }

    advanceFrom("sync");
    try {
      const syncRes = await fetch(`/api/stores/${siteId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setStep("sync", syncRes.ok ? "done" : "error");
    } catch {
      setStep("sync", "error");
    }

    advanceFrom("redirect");
    await new Promise((r) => setTimeout(r, 600));
    setStep("redirect", "done");
    router.push(`/sites/${siteId}`);
  };

  useEffect(() => {
    if (!siteId || success !== "1") return;

    // Return trip from WP authorize
    if (wp) {
      if (wp === "ok") {
        setStage("finishing");
        setSteps((prev) =>
          prev.map((s) => {
            if (["auth", "creds", "wp"].includes(s.id)) return { ...s, status: "done" };
            return s;
          })
        );
        finishRemainingSteps();
      } else {
        // rejected / missing / error - show manual fallback
        setStage("wp");
        setSteps((prev) =>
          prev.map((s) => {
            if (["auth", "creds"].includes(s.id)) return { ...s, status: "done" };
            if (s.id === "wp") return { ...s, status: "error" };
            return s;
          })
        );
        setShowManual(true);
        setErrorMessage(
          wp === "rejected"
            ? "You rejected the WordPress authorization. You can enter credentials manually or skip for now."
            : "WordPress did not return credentials. Try manual entry or skip for now."
        );
      }
      return;
    }

    // Fresh arrival - poll for Woo keys
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
            if (data.wp_username) {
              // already have WP creds - skip
              setStep("wp", "done");
              finishRemainingSteps();
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

    return () => {
      cancelled = true;
    };
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
        finishRemainingSteps();
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
    finishRemainingSteps();
  };

  const completedCount = steps.filter((s) => s.status === "done").length;

  if (!siteId) {
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
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 pb-6">
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold mb-1">
                {failed ? "Connection Pending" : stage === "wp" ? "Authorize WordPress" : "Connecting Store"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {failed
                  ? "Something didn't complete as expected"
                  : `Step ${Math.min(completedCount + 1, steps.length)} of ${steps.length}`}
              </p>
            </div>

            <div className="space-y-2 mb-5">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="shrink-0">
                    {step.status === "done" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    {step.status === "active" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {step.status === "pending" && <Circle className="h-5 w-5 text-muted-foreground/40" />}
                    {step.status === "error" && <AlertTriangle className="h-5 w-5 text-warning" />}
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

            {stage === "wp" && !failed && (
              <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">WordPress Media Access</p>
                    <p className="text-xs text-muted-foreground">
                      To upload product images directly to your WooCommerce media library, we need a WordPress Application Password. Click Authorize — you'll approve on your own site, no password needed here.
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
                  <button
                    type="button"
                    onClick={() => setShowManual((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {showManual ? "Hide manual entry" : "Having trouble? Enter credentials manually"}
                  </button>
                </div>

                {showManual && (
                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <p className="text-xs text-muted-foreground">
                      Generate an app password at{" "}
                      <a
                        href={`${storeUrl.replace(/\/$/, "")}/wp-admin/profile.php#application-passwords-section`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        your WP profile page
                      </a>
                      .
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="wp-user" className="text-xs">Username or email</Label>
                      <Input
                        id="wp-user"
                        value={manualUser}
                        onChange={(e) => setManualUser(e.target.value)}
                        placeholder="admin"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wp-pass" className="text-xs">Application password</Label>
                      <Input
                        id="wp-pass"
                        type="password"
                        value={manualPass}
                        onChange={(e) => setManualPass(e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx"
                        className="h-9 font-mono"
                      />
                    </div>
                    <Button
                      onClick={handleManualSave}
                      disabled={!manualUser || !manualPass || manualBusy}
                      className="w-full"
                      size="sm"
                    >
                      {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test & Save"}
                    </Button>
                  </div>
                )}

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleSkipWp}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Skip for now — I&apos;ll set this up later
                  </button>
                </div>
              </div>
            )}

            {failed && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-muted-foreground text-center">{errorMessage}</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sites/${siteId}`}>
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