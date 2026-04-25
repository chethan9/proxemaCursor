import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthProvider";
import { useCheckout } from "@/hooks/useCheckout";
import { useSubscription } from "@/hooks/queries/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { getPlanPrice } from "@/services/planService";
import { getGatewayForCountry, getDefaultCurrencyForCountry, getSupportedCountries } from "@/lib/payments/routing";
import { AuthGuard } from "@/components/AuthGuard";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, CheckCircle2, Tag, X, CreditCard, Globe, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/helpers";

type Plan = Tables<"plans">;

const GATEWAY_LABEL: Record<string, string> = {
  myfatoorah: "MyFatoorah",
  razorpay: "Razorpay",
  tap: "Tap Payments",
};

function CheckoutInner() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { startCheckout, loading: checkoutLoading } = useCheckout();
  const { subscription } = useSubscription();

  const planId = typeof router.query.plan === "string" ? router.query.plan : "";
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountMinor: number } | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle();
      if (cancelled) return;
      setPlan((data as Plan) || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [planId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("proxima-pricing-country");
    if (saved) {
      const match = getSupportedCountries().find((c) => c.code === saved);
      if (match) {
        setCountry(match.code);
        setCurrency(match.currency);
        return;
      }
    }
    if (profile?.client_id) {
      supabase.from("clients").select("country, currency").eq("id", profile.client_id).maybeSingle().then(({ data }) => {
        if (data?.country) setCountry(data.country);
        if (data?.currency) setCurrency(data.currency);
      });
    }
  }, [profile?.client_id]);

  const gateway = useMemo(() => getGatewayForCountry(country), [country]);
  const baseAmount = plan ? getPlanPrice(plan, currency) : null;
  const discountMinor = appliedCoupon?.discountMinor || 0;
  const finalAmount = baseAmount != null ? Math.max(0, baseAmount * 100 - discountMinor) / 100 : null;

  const validateCoupon = async () => {
    if (!coupon.trim() || !plan || baseAmount == null) return;
    setValidating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const r = await fetch("/api/billing/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ code: coupon.trim(), planId: plan.id, currency, amountMinor: Math.round(baseAmount * 100) }),
      });
      const j = await r.json();
      if (!r.ok || !j.valid) {
        toast({ title: "Invalid coupon", description: j.error || j.message || "This coupon cannot be applied.", variant: "destructive" });
        return;
      }
      setAppliedCoupon({ code: coupon.trim(), discountMinor: j.discountMinor || 0 });
      toast({ title: "Coupon applied", description: `Discount: ${(j.discountMinor / 100).toFixed(2)} ${currency}` });
    } catch (e) {
      toast({ title: "Could not validate coupon", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCoupon(""); };

  const handleContinue = async () => {
    if (!plan) return;
    await startCheckout(plan.id, appliedCoupon?.code);
  };

  const isCurrent = subscription?.plan_id === planId && subscription?.status === "active";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Plan not found.</p>
        <Link href="/pricing"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1.5" />Back to pricing</Button></Link>
      </div>
    );
  }

  if (baseAmount == null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">No price configured for this plan in {currency}.</p>
        <p className="text-sm text-muted-foreground">Contact sales for a custom quote.</p>
        <a href={`mailto:sales@proxima.app?subject=Quote%20for%20${encodeURIComponent(plan.name)}`}><Button>Contact sales</Button></a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/pricing" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Back to pricing
          </Link>
          <BrandLogo />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Complete your subscription</h1>
          <p className="text-muted-foreground mt-1">Review your plan and continue to secure payment.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  {plan.name}
                  {isCurrent ? <Badge variant="secondary">Current plan</Badge> : null}
                </CardTitle>
                {plan.description ? <p className="text-sm text-muted-foreground mt-1">{plan.description}</p> : null}
              </CardHeader>
              <CardContent>
                {Array.isArray(plan.features) && plan.features.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {(plan.features as string[]).slice(0, 8).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" />Region & payment method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Country</span>
                  <select value={country} onChange={(e) => { const newC = e.target.value; setCountry(newC); setCurrency(getDefaultCurrencyForCountry(newC)); localStorage.setItem("proxima-pricing-country", newC); }} className="border rounded-md px-2 py-1 bg-background">
                    {getSupportedCountries().map((c) => (<option key={c.code} value={c.code}>{c.name} ({c.currency})</option>))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-mono">{currency}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-4 w-4" />Gateway</span>
                  <Badge variant="outline">{GATEWAY_LABEL[gateway]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Auto-selected based on your country. Cards processed by {GATEWAY_LABEL[gateway]} — your payment details never touch our servers.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4" />Coupon code</CardTitle>
              </CardHeader>
              <CardContent>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                    <div>
                      <span className="font-mono text-sm font-medium text-emerald-700">{appliedCoupon.code}</span>
                      <span className="text-xs text-emerald-600 ml-2">-{(appliedCoupon.discountMinor / 100).toFixed(2)} {currency}</span>
                    </div>
                    <button onClick={removeCoupon} className="text-emerald-700 hover:text-emerald-900"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Enter code" className="font-mono uppercase" />
                    <Button variant="outline" onClick={validateCoupon} disabled={!coupon.trim() || validating}>
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader><CardTitle>Order summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{plan.name}</span>
                  <span>{baseAmount.toFixed(2)} {currency}</span>
                </div>
                {appliedCoupon ? (
                  <div className="flex justify-between text-sm text-emerald-700">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>-{(appliedCoupon.discountMinor / 100).toFixed(2)} {currency}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total today</span>
                  <span>{finalAmount?.toFixed(2)} {currency}</span>
                </div>
                <p className="text-xs text-muted-foreground">Billed {plan.billing_interval || "monthly"}. Cancel anytime.</p>
                <Button onClick={handleContinue} disabled={checkoutLoading || isCurrent} className="w-full" size="lg">
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isCurrent ? "Current plan" : `Pay with ${GATEWAY_LABEL[gateway]}`}
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Secured by {GATEWAY_LABEL[gateway]}</span>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground text-center mt-4 px-4">
              By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>. {user?.email ? <>Subscribing as <span className="font-medium">{user.email}</span>.</> : null}
            </p>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <CheckoutInner />
    </AuthGuard>
  );
}
