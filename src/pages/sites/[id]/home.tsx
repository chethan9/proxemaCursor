import { useCallback, useEffect, useMemo, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "next-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { SitePageShell, useSiteFromRoute } from "@/components/site/shared";
import { useSiteHomeStats } from "@/hooks/queries/useSiteStats";
import { StatStrip } from "@/components/site/home/StatStrip";
import { RecentOrdersCard } from "@/components/site/home/RecentOrdersCard";
import { TopProductsCard } from "@/components/site/home/TopProductsCard";
import { CurrencySwitcher } from "@/components/site/home/CurrencySwitcher";
import { SiteBlockedBanner } from "@/components/site/SiteBlockedBanner";
import { EmptyState } from "@/components/EmptyState";
import { NoDataIllustration } from "@/components/illustrations/EmptyIllustrations";
import { SitePreferencesOnboardingDialog } from "@/components/site/store-preferences/SitePreferencesOnboardingDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  type SiteHomeStatsQuery,
} from "@/services/siteStatsService";
import { type DateRangePresetValue } from "@/components/explore/DateRangeFilter";
import { formatNumber } from "@/lib/format-number";

const VALID_RANGE_PRESETS = new Set<DateRangePresetValue>([
  "30d",
]);

function parseRangeQuery(q: unknown): DateRangePresetValue {
  return typeof q === "string" && VALID_RANGE_PRESETS.has(q as DateRangePresetValue)
    ? (q as DateRangePresetValue)
    : "30d";
}

const SalesTrendCard = dynamic(
  () => import("@/components/site/home/SalesTrendCard").then((m) => m.SalesTrendCard),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="h-[320px]" />
      </Card>
    ),
  }
);

const OrderStatusDonut = dynamic(
  () => import("@/components/site/home/OrderStatusDonut").then((m) => m.OrderStatusDonut),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="h-[320px]" />
      </Card>
    ),
  }
);

const SparklineTile = dynamic(
  () => import("@/components/site/home/SparklineTile").then((m) => m.SparklineTile),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="h-[148px]" />
      </Card>
    ),
  }
);

function HomeInner() {
  const { t, i18n } = useTranslation("site");
  const { t: tCommon } = useTranslation("common");

  const fmtMoney = useCallback(
    (n: number) =>
      formatNumber(n, i18n.language, { maximumFractionDigits: 2, minimumFractionDigits: 0 }),
    [i18n.language]
  );
  const { store, loading: storeLoading } = useSiteFromRoute();
  const router = useRouter();
  const qc = useQueryClient();
  const storeId = store?.id;
  const urlCurrency = typeof router.query.currency === "string" ? router.query.currency : null;
  const storeTz = store?.timezone ?? null;

  const rangeParam = parseRangeQuery(router.query.range);
  const combineAll =
    router.query.combine === "1" || router.query.combine === "true";

  const homeQuery: SiteHomeStatsQuery = useMemo(() => {
    return {
      range: rangeParam,
      combineAll,
    };
  }, [rangeParam, combineAll]);

  const rpcCurrency = combineAll ? null : urlCurrency;
  const { data, isLoading, isFetching, error, refetch } = useSiteHomeStats(
    storeId,
    rpcCurrency,
    storeTz,
    homeQuery
  );

  const didWarmSummaryRef = useRef<string | null>(null);
  const didAttemptFxRefreshRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storeId || storeLoading) return;
    if (didWarmSummaryRef.current === storeId) return;
    didWarmSummaryRef.current = storeId;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const tok = sessionData.session?.access_token;
        if (!tok || cancelled) return;
        const r = await fetch(`/api/stores/${storeId}/dashboard-summary/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!cancelled && r.ok) {
          qc.invalidateQueries({ queryKey: ["site-home-stats", storeId] });
        }
      } catch {
        /* ignore */
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [storeId, storeLoading, qc]);

  useEffect(() => {
    if (!storeId || !combineAll) return;
    if (!data?.meta?.fx_fallback) return;
    const runKey = `${storeId}:fx`;
    if (didAttemptFxRefreshRef.current === runKey) return;
    didAttemptFxRefreshRef.current = runKey;
    let cancelled = false;

    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const tok = sessionData.session?.access_token;
        if (!tok || cancelled) return;
        const r = await fetch(`/api/stores/${storeId}/dashboard-summary/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (r.ok && !cancelled) {
          qc.invalidateQueries({ queryKey: ["site-home-stats", storeId] });
        }
      } catch {
        /* ignore; warning banner remains visible */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId, combineAll, data?.meta?.fx_fallback, qc]);

  const statsLoading = !data && isLoading;
  const showRefreshing = !!data && isFetching;
  const dateFnsLocale = i18n.language?.toLowerCase().startsWith("ar") ? ar : undefined;
  const snapshotRel = useMemo(() => {
    if (data?.snapshot_updated_at == null || String(data.snapshot_updated_at).length === 0) return null;
    return formatDistanceToNow(new Date(String(data.snapshot_updated_at)), {
      addSuffix: true,
      locale: dateFnsLocale,
    });
  }, [data?.snapshot_updated_at, dateFnsLocale]);

  const s = data?.stats;
  const meta = data?.meta;
  const currencies = data?.currencies || [];
  const storeCurrency = (store as { currency?: string } | null)?.currency ?? "USD";
  const currency =
    data?.currency || (combineAll ? storeCurrency : urlCurrency || storeCurrency);

  const multiCurrency = currencies.length > 1;
  const allLabel = tCommon("common.all");

  const aov = s && s.orders_month_count > 0 ? s.sales_month / s.orders_month_count : 0;
  const deltaPct = s && s.sales_prev_month > 0 ? ((s.sales_month - s.sales_prev_month) / s.sales_prev_month) * 100 : null;

  const salesSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.revenue })), [data]);
  const ordersSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.orders })), [data]);

  const rangeCaption = useMemo(() => {
    return t("home.range.last30d", { defaultValue: "Last 30 days" });
  }, [t]);

  const rangeSelectOptions = useMemo(
    (): { value: DateRangePresetValue; label: string }[] => [
      { value: "30d", label: t("home.range.last30d", { defaultValue: "Last 30 days" }) },
    ],
    [t]
  );

  const statItems = useMemo(() => {
    return [
      { label: t("home.stats.ordersToday"), value: s?.orders_today ?? 0 },
      { label: t("home.stats.ordersInProgress"), value: s?.orders_in_progress ?? 0 },
      { label: t("home.stats.todaySales"), value: fmtMoney(s?.sales_today ?? 0), suffix: currency },
      { label: t("home.stats.weeklySales"), value: fmtMoney(s?.sales_week ?? 0), suffix: currency },
      { label: t("home.stats.monthlySales"), value: fmtMoney(s?.sales_month ?? 0), suffix: currency },
      { label: t("home.stats.avgOrder"), value: fmtMoney(aov), suffix: currency },
    ];
  }, [s, t, currency, aov, fmtMoney]);

  const ordersSparkSub = multiCurrency && !combineAll
    ? t("home.spark.ordersInCurrency", { currency })
    : t("home.spark.ordersInRange");

  const revenueSparkSub =
    deltaPct != null
      ? t("home.spark.vsPrevPeriod")
      : t("home.spark.revenueInRange");

  const hasError = !!error;
  const querySucceeded = !storeLoading && !isLoading && !hasError && !!data;
  const showEmpty = querySucceeded && (!s || s.orders_total === 0);
  const hasCurrencySales = !!s && s.sales_month > 0;

  const handleCurrencyChange = (code: string) => {
    if (code === "__all__") {
      const q: Record<string, string | string[] | undefined> = { ...router.query, combine: "1" };
      delete q.currency;
      router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false });
      return;
    }
    router.replace(
      { pathname: router.pathname, query: { ...router.query, currency: code, combine: undefined } },
      undefined,
      { shallow: true, scroll: false }
    );
  };

  const handleRangeChange = (range: DateRangePresetValue) => {
    const q: Record<string, string | string[] | undefined> = { ...router.query };
    q.range = range;
    delete q.from;
    delete q.to;
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false });
  };

  return (
    <div className="px-6 pt-2 pb-6 space-y-4 max-w-[1600px] mx-auto">
      <SitePreferencesOnboardingDialog store={store} />
      {storeId && <SiteBlockedBanner storeId={storeId} />}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-20 right-6 h-10 w-10 rounded-full shadow-lg bg-background hover:shadow-xl"
        style={{ zIndex: 9998 }}
        onClick={() => qc.invalidateQueries({ queryKey: ["site-home-stats", storeId] })}
        disabled={isFetching}
        title={t("home.refresh")}
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>

      {hasError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-1">{t("home.errorTitle")}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {(error as Error)?.message || t("home.errorBody")}
            </p>
            <Button onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              {t("home.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : showEmpty ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              size="lg"
              illustration={<NoDataIllustration className="w-full h-full" />}
              title={t("home.emptyTitle")}
              description={t("home.emptyBody")}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {multiCurrency ? (
            <div className="rounded-lg border bg-card/70 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <CurrencySwitcher
                    currencies={currencies}
                    selected={currency}
                    onChange={handleCurrencyChange}
                    includeAll
                    allSelected={combineAll}
                    allLabel={allLabel}
                  />
                  {combineAll && meta?.fx_fallback && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      {t("home.fxFallback")}
                    </span>
                  )}
                  {snapshotRel || showRefreshing ? (
                    <span className="text-xs text-muted-foreground">
                      {snapshotRel ? t("home.dataUpdated", { relative: snapshotRel }) : null}
                      {snapshotRel && showRefreshing ? " · " : null}
                      {showRefreshing ? t("home.refreshingData") : null}
                    </span>
                  ) : null}
                </div>
                <div className="ml-auto">
                  <Select
                    value={homeQuery.range}
                    onValueChange={(v) => handleRangeChange(v as DateRangePresetValue)}
                  >
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {rangeSelectOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {combineAll && meta?.fx_fallback && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-3 text-sm text-amber-900">{t("home.fxFallback")}</CardContent>
            </Card>
          )}

          {multiCurrency && !combineAll && !hasCurrencySales && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-4 text-sm text-amber-900">
                {t("home.noSalesInCurrency", { currency })}
              </CardContent>
            </Card>
          )}

          <StatStrip loading={statsLoading} items={statItems} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6">
              <SalesTrendCard
                data={data?.daily || []}
                currency={currency}
                loading={statsLoading}
                subtitle={rangeCaption}
              />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-4">
              <SparklineTile
                label={t("home.spark.sales")}
                value={String(s?.orders_month_count ?? 0)}
                subtext={ordersSparkSub}
                data={ordersSpark}
                color="hsl(var(--primary))"
                loading={statsLoading}
                compact
              />
              <SparklineTile
                label={t("home.spark.revenue")}
                value={fmtMoney(s?.sales_month ?? 0)}
                suffix={currency}
                subtext={revenueSparkSub}
                data={salesSpark}
                color="hsl(var(--success))"
                delta={deltaPct}
                loading={statsLoading}
                compact
              />
            </div>
            <div className="lg:col-span-4">
              <OrderStatusDonut data={data?.status_breakdown || []} loading={statsLoading} subtitle={rangeCaption} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <RecentOrdersCard
                orders={data?.recent_orders || []}
                storeId={storeId || ""}
                currency={currency}
                storeTimezone={storeTz}
                loading={statsLoading}
              />
            </div>
            <div>
              <TopProductsCard
                products={data?.top_products || []}
                storeId={storeId || ""}
                currency={currency}
                loading={statsLoading}
                subtitle={rangeCaption}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SiteHomePage() {
  return (
    <SitePageShell>
      <HomeInner />
    </SitePageShell>
  );
}
