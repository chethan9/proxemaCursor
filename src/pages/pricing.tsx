import type { GetServerSideProps } from "next";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { formatDate } from "@/lib/format-number";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveCountry, getDefaultCurrencyForCountry, getBrowserTimezoneCountry, getSupportedCountries } from "@/lib/payments/routing";
import { useAuth } from "@/contexts/AuthProvider";
import { useCheckout } from "@/hooks/useCheckout";
import { useSubscription } from "@/hooks/queries/useSubscription";
import { useAppSettings } from "@/hooks/queries/useAppSettings";
import { isBillingEffectivelyEnforced } from "@/lib/billing-mode";
import { getPlanPrice } from "@/services/planService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PlanCard } from "@/components/pricing/PlanCard";
import { EnterpriseCard } from "@/components/pricing/EnterpriseCard";
import { CurrencySwitcher } from "@/components/pricing/CurrencySwitcher";
import { BillingIntervalToggle } from "@/components/pricing/BillingIntervalToggle";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { PlanChangeDialog } from "@/components/pricing/PlanChangeDialog";
import { BrandLogo } from "@/components/BrandLogo";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Tables } from "@/integrations/supabase/helpers";

type Plan = Tables<"plans">;
type Props = { plans: Plan[]; initialCountry: string; initialCurrency: string; detectionSource: string };

const STORAGE_KEY = "proxima-pricing-country";

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, locale }) => {
  const { country, currency, source } = resolveCountry({ headers: req.headers as Record<string, string | string[] | undefined> });
  const { data } = await supabaseAdmin.from("plans").select("*").eq("is_active", true).order("sort_order");
  return {
    props: {
      plans: (data || []) as Plan[],
      initialCountry: country,
      initialCurrency: currency,
      detectionSource: source,
      ...(await serverSideTranslations(locale ?? "en", ["common", "pricing"])),
    },
  };
};

export default function PricingPage({ plans, initialCountry, initialCurrency, detectionSource }: Props) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("pricing");
  const { startCheckout, loading: checkoutLoading } = useCheckout();
  const { subscription, refetch } = useSubscription();
  const { settings: appSettings } = useAppSettings();
  const inApp = !!user && (router.query.app === "1" || !subscription);
  const enforce = isBillingEffectivelyEnforced(appSettings);
  const showOnboarding = inApp && enforce && !subscription;

  const [country, setCountry] = useState(initialCountry);
  const [currency, setCurrency] = useState(initialCurrency);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"upgrade" | "downgrade">("upgrade");
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [changeLoading, setChangeLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const match = getSupportedCountries().find((c) => c.code === saved);
      if (match) {
        setCountry(match.code);
        setCurrency(match.currency);
        return;
      }
    }
    if (detectionSource === "default") {
      const tz = getBrowserTimezoneCountry();
      if (tz) {
        setCountry(tz);
        setCurrency(getDefaultCurrencyForCountry(tz));
      }
    }
  }, [detectionSource]);

  useEffect(() => {
    if (user && profile?.client_id) {
      supabase.from("clients").select("currency, country").eq("id", profile.client_id).maybeSingle().then(({ data }) => {
        if (data?.currency) setCurrency(data.currency);
        if (data?.country) setCountry(data.country);
      });
    }
  }, [user, profile?.client_id]);

  const handleCountryChange = (newCountry: string, newCurrency: string) => {
    setCountry(newCountry);
    setCurrency(newCurrency);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, newCountry);
  };

  const { mainPlans, currentPlan, currentPlanIndex } = useMemo(() => {
    const main = plans.slice(0, 3);
    const current = subscription?.plan_id ? plans.find((p) => p.id === subscription.plan_id) || null : null;
    const currentIdx = current ? plans.findIndex((p) => p.id === current.id) : -1;
    return { mainPlans: main, currentPlan: current, currentPlanIndex: currentIdx };
  }, [plans, subscription]);

  const getAction = (plan: Plan, idx: number): "subscribe" | "upgrade" | "downgrade" | "current" | "contact" => {
    if (getPlanPrice(plan, currency) == null) return "contact";
    if (!user) return "subscribe";
    if (!currentPlan) return "subscribe";
    if (plan.id === currentPlan.id) return "current";
    return idx > currentPlanIndex ? "upgrade" : "downgrade";
  };

  const handlePlanAction = (plan: Plan, idx: number) => {
    const action = getAction(plan, idx);
    if (action === "contact") {
      window.location.href = `mailto:sales@proxima.app?subject=Pricing%20enquiry%20for%20${encodeURIComponent(plan.name)}`;
      return;
    }
    if (action === "subscribe") {
      if (!user) {
        router.push(`/auth/signup?plan=${plan.id}&country=${country}`);
        return;
      }
      router.push(`/billing/checkout?plan=${plan.id}`);
      return;
    }
    if (action === "upgrade") {
      router.push(`/billing/checkout?plan=${plan.id}`);
      return;
    }
    if (action === "downgrade") {
      setDialogMode("downgrade");
      setPendingPlan(plan);
      setDialogOpen(true);
      return;
    }
  };

  const confirmPlanChange = async () => {
    if (!pendingPlan || !user || !profile?.client_id) return;
    setChangeLoading(true);
    try {
      if (dialogMode === "upgrade") {
        await startCheckout(pendingPlan.id);
      } else {
        const sub = subscription;
        if (!sub) throw new Error(t("toast.noActiveSubscription"));
        const before = { plan_id: sub.plan_id };
        const after = { scheduled_plan_id: pendingPlan.id, effective_at: sub.current_period_end };
        await supabase.from("subscription_events").insert({
          subscription_id: sub.id,
          event_type: "plan_downgrade_scheduled",
          metadata: { from_plan_id: sub.plan_id, to_plan_id: pendingPlan.id, effective_at: sub.current_period_end },
          actor_user_id: user.id,
        });
        await supabase.from("activity_log").insert({
          actor_user_id: user.id,
          actor_email: user.email || null,
          actor_type: "user",
          action: "subscription.downgrade_scheduled",
          entity_type: "subscription",
          entity_id: sub.id,
          client_id: profile.client_id,
          diff: { before, after },
        });
        toast({
          title: t("toast.downgradeScheduled"),
          description: sub.current_period_end
            ? t("toast.downgradeOn", { date: formatDate(sub.current_period_end, i18n.language) })
            : t("toast.downgradePeriodEnd"),
        });
        refetch();
      }
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: t("toast.errorTitle"),
        description: e instanceof Error ? e.message : t("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setChangeLoading(false);
    }
  };

  const popularPlanId = plans.find((p) => p.name.toLowerCase().includes("growth"))?.id || mainPlans[1]?.id;

  const planGrid = (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
      {mainPlans.map((plan, idx) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          currency={currency}
          billingInterval={billingInterval}
          isCurrent={currentPlan?.id === plan.id}
          isPopular={plan.id === popularPlanId}
          action={getAction(plan, idx)}
          onAction={() => handlePlanAction(plan, idx)}
          loading={checkoutLoading}
        />
      ))}
      <EnterpriseCard />
    </div>
  );

  const dialog = (
    <PlanChangeDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      mode={dialogMode}
      currentPlan={currentPlan}
      newPlan={pendingPlan}
      currency={currency}
      periodEnd={subscription?.current_period_end}
      onConfirm={confirmPlanChange}
      loading={changeLoading || checkoutLoading}
    />
  );

  if (inApp) {
    return (
      <AppLayout
        title={
          showOnboarding
            ? t("inApp.onboardingTitle", { defaultValue: "Choose a plan to get started" })
            : t("inApp.title", { defaultValue: "Plans" })
        }
      >
        <div className="px-6 py-8 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {showOnboarding
                  ? t("inApp.onboardingTitle", { defaultValue: "Choose a plan to get started" })
                  : t("inApp.title", { defaultValue: "Plans" })}
              </h1>
              <p className="text-sm text-muted-foreground">
                {showOnboarding
                  ? t("inApp.onboardingSubtitle", {
                      defaultValue: "Pick the plan that fits your team. Checkout saves your payment method for when the trial ends.",
                    })
                  : t("inApp.subtitle", { defaultValue: "Compare available plans, change anytime." })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CurrencySwitcher country={country} onChange={handleCountryChange} />
              <BillingIntervalToggle value={billingInterval} onChange={setBillingInterval} />
            </div>
          </div>

          {planGrid}

          {detectionSource !== "default" && (
            <p className="text-xs text-muted-foreground">{t("localeNote", { currency })}</p>
          )}

          {dialog}
        </div>
      </AppLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/"><BrandLogo /></Link>
          <div className="flex gap-3 items-center">
            <LocaleSwitcher variant="compact" />
            <CurrencySwitcher country={country} onChange={handleCountryChange} />
            <Link href="/auth/login" className="text-sm font-medium hover:underline">{t("header.login")}</Link>
            <Link href="/auth/signup" className="text-sm font-medium px-4 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">{t("header.signup")}</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-5xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-lg text-muted-foreground mt-4">{t("subtitle")}</p>
          <div className="mt-8 flex justify-center">
            <BillingIntervalToggle value={billingInterval} onChange={setBillingInterval} />
          </div>
        </div>

        {planGrid}

        {detectionSource !== "default" && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {t("localeNote", { currency })}
          </p>
        )}

        <PricingFAQ />

        <section className="mt-24 text-center py-12 bg-muted/30 rounded-2xl">
          <h2 className="text-2xl font-semibold">{t("questions.title")}</h2>
          <p className="text-muted-foreground mt-2">{t("questions.body")}</p>
          <a href="mailto:sales@proxima.app" className="inline-block mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium">
            {t("questions.cta")}
          </a>
        </section>
      </main>

      {dialog}
    </div>
  );
}