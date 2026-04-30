import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation, Trans } from "next-i18next";
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
  const { t } = useTranslation("billing");
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

  const [resolvedGateway, setResolvedGateway] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const r = await fetch(`/api/billing/resolve-gateway?country=${encodeURIComponent(country)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = (await r.json()) as { gateway?: string };
      if (!cancelled && j.gateway) setResolvedGateway(j.gateway);
    })();
    return () => {
      cancelled = true;
    };
  }, [country]);

  const gateway = resolvedGateway ?? getGatewayForCountry(country);
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
        toast({ title: t("checkout.invalidCoupon"), description: j.error || j.message || t("checkout.couponInvalidBody"), variant: "destructive" });
        return;
      }
      setAppliedCoupon({ code: coupon.trim(), discountMinor: j.discountMinor || 0 });
      toast({ title: t("checkout.couponApplied"), description: t("checkout.couponDiscount", { amount: (j.discountMinor / 100).toFixed(2), currency }) });
    } catch (e) {
      toast({ title: t("checkout.couponValidateError"), description: e instanceof Error ? e.message : "", variant: "destructive" });
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
        <p className="text-muted-foreground">{t("checkout.notFound")}</p>
        <Link href="/pricing"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1.5" />{t("checkout.back")}</Button></Link>
      </div>
    );
  }

  if (baseAmount == null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">{t("checkout.noPrice", { currency })}</p>
        <p className="text-sm text-muted-foreground">{t("checkout.contactSalesHint")}</p>
        <a href={`mailto:sales@proxima.app?subject=Quote%20for%20${encodeURIComponent(plan.name)}`}><Button>{t("checkout.contactSales")}</Button></a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/pricing" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />{t("checkout.back")}
          </Link>
          <BrandLogo />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("checkout.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("checkout.subtitle")}</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  {plan.name}
                  {isCurrent ? <Badge variant="secondary">{t("checkout.currentPlan")}</Badge> : null}
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
                <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" />{t("checkout.regionTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout.country")}</span>
                  <select value={country} onChange={(e) => { const newC = e.target.value; setCountry(newC); setCurrency(getDefaultCurrencyForCountry(newC)); localStorage.setItem("proxima-pricing-country", newC); }} className="border rounded-md px-2 py-1 bg-background">
                    {getSupportedCountries().map((c) => (<option key={c.code} value={c.code}>{c.name} ({c.currency})</option>))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("checkout.currency")}</span>
                  <span className="font-mono">{currency}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-4 w-4" />{t("checkout.gateway")}</span>
                  <Badge variant="outline">{GATEWAY_LABEL[gateway]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-1">{t("checkout.gatewayHint", { gateway: GATEWAY_LABEL[gateway] })}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4" />{t("checkout.couponTitle")}</CardTitle>
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
                    <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder={t("checkout.couponPlaceholder")} className="font-mono uppercase" />
                    <Button variant="outline" onClick={validateCoupon} disabled={!coupon.trim() || validating}>
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("checkout.apply")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader><CardTitle>{t("checkout.summaryTitle")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{plan.name}</span>
                  <span>{baseAmount.toFixed(2)} {currency}</span>
                </div>
                {appliedCoupon ? (
                  <div className="flex justify-between text-sm text-emerald-700">
                    <span>{t("checkout.couponLine", { code: appliedCoupon.code })}</span>
                    <span>-{(appliedCoupon.discountMinor / 100).toFixed(2)} {currency}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>{t("checkout.totalToday")}</span>
                  <span>{finalAmount?.toFixed(2)} {currency}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("checkout.billedInterval", { interval: plan.billing_interval || "monthly" })}</p>
                <Button onClick={handleContinue} disabled={checkoutLoading || isCurrent} className="w-full" size="lg">
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isCurrent ? t("checkout.currentPlan") : t("checkout.payWith", { gateway: GATEWAY_LABEL[gateway] })}
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{t("checkout.securedBy", { gateway: GATEWAY_LABEL[gateway] })}</span>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground text-center mt-4 px-4">
              <Trans
                i18nKey="checkout.terms"
                ns="billing"
                components={{
                  terms: <Link href="/terms" className="underline" />,
                  privacy: <Link href="/privacy" className="underline" />,
                }}
              />
              {" "}
              {user?.email ? t("checkout.subscribingAs", { email: user.email }) : null}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <CheckoutInner />
    </AuthGuard>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "billing"])),
  },
});