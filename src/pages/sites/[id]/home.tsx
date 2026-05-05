import { useEffect, useMemo } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "next-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { DateRangeFilter, type DateRangePresetValue } from "@/components/explore/DateRangeFilter";

const VALID_RANGE_PRESETS = new Set<DateRangePresetValue>([
  "all",
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "custom",
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

function fmtMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}

function HomeInner() {
  const { t } = useTranslation("site");
  const { store, loading: storeLoading } = useSiteFromRoute();
  const router = useRouter();
  const qc = useQueryClient();
  const storeId = store?.id;
  const urlCurrency = typeof router.query.currency === "string" ? router.query.currency : null;
  const storeTz = store?.timezone ?? null;

  const rangeParam = parseRangeQuery(router.query.range);
  const fromYmd = typeof router.query.from === "string" ? router.query.from : undefined;
  const toYmd = typeof router.query.to === "string" ? router.query.to : undefined;
  const combineAll =
    router.query.combine === "1" || router.query.combine === "true";

  const homeQuery: SiteHomeStatsQuery = useMemo(() => {
    let range = rangeParam;
    if (range === "custom" && (!fromYmd || !toYmd)) {
      range = "30d";
    }
    return {
      range,
      fromYmd: range === "custom" ? fromYmd : undefined,
      toYmd: range === "custom" ? toYmd : undefined,
      combineAll,
    };
  }, [rangeParam, fromYmd, toYmd, combineAll]);

  const rpcCurrency = combineAll ? null : urlCurrency;
  const { data, isLoading, isFetching, error, refetch } = useSiteHomeStats(
    storeId,
    rpcCurrency,
    storeTz,
    homeQuery
  );

  useEffect(() => {
    if (!storeId || storeLoading) return;
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
  }, [storeId, storeLoading, qc, urlCurrency, storeTz, homeQuery]);

  const statsLoading = !data && isLoading;
  const showRefreshing = !!data && isFetching;
  const snapshotRel =
    data?.snapshot_updated_at != null && String(data.snapshot_updated_at).length > 0
      ? formatDistanceToNow(new Date(String(data.snapshot_updated_at)), { addSuffix: true })
      : null;

  const s = data?.stats;
  const meta = data?.meta;
  const currencies = data?.currencies || [];
  const periodCustom = meta?.period_custom === true;
  const storeCurrency = (store as { currency?: string } | null)?.currency ?? "USD";
  const currency =
    data?.currency || (combineAll ? storeCurrency : urlCurrency || storeCurrency);

  const multiCurrency = currencies.length > 1;

  const aov = s && s.orders_month_count > 0 ? s.sales_month / s.orders_month_count : 0;
  const deltaPct = s && s.sales_prev_month > 0 ? ((s.sales_month - s.sales_prev_month) / s.sales_prev_month) * 100 : null;

  const salesSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.revenue })), [data]);
  const ordersSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.orders })), [data]);

  const rangeCaption = useMemo(() => {
    if (!periodCustom) return undefined;
    switch (homeQuery.range) {
      case "7d":
        return t("home.range.last7d");
      case "90d":
        return t("home.range.last90d");
      case "today":
        return t("home.range.today");
      case "yesterday":
        return t("home.range.yesterday");
      case "all":
        return t("home.range.all");
      case "custom":
        return t("home.range.selected");
      default:
        return t("home.range.last30d");
    }
  }, [periodCustom, homeQuery.range, t]);

  const statItems = useMemo(() => {
    if (periodCustom) {
      return [
        { label: t("home.stats.ordersInPeriod"), value: s?.orders_month_count ?? 0 },
        { label: t("home.stats.salesInRange"), value: fmtMoney(s?.sales_month ?? 0), suffix: currency },
        { label: t("home.stats.ordersInProgress"), value: s?.orders_in_progress ?? 0 },
        { label: t("home.stats.avgOrder"), value: fmtMoney(aov), suffix: currency },
      ];
    }
    return [
      { label: t("home.stats.ordersToday"), value: s?.orders_today ?? 0 },
      { label: t("home.stats.ordersInProgress"), value: s?.orders_in_progress ?? 0 },
      { label: t("home.stats.todaySales"), value: fmtMoney(s?.sales_today ?? 0), suffix: currency },
      { label: t("home.stats.weeklySales"), value: fmtMoney(s?.sales_week ?? 0), suffix: currency },
      { label: t("home.stats.monthlySales"), value: fmtMoney(s?.sales_month ?? 0), suffix: currency },
      { label: t("home.stats.avgOrder"), value: fmtMoney(aov), suffix: currency },
    ];
  }, [periodCustom, s, t, currency, aov]);

  const hasError = !!error;
  const querySucceeded = !storeLoading && !isLoading && !hasError && !!data;
  const showEmpty = querySucceeded && (!s || s.orders_total === 0);
  const hasCurrencySales = !!s && s.sales_month > 0;

  const handleCurrencyChange = (code: string) => {
    router.replace(
      { pathname: router.pathname, query: { ...router.query, currency: code } },
      undefined,
      { shallow: true, scroll: false }
    );
  };

  const handleRangeChange = (range: DateRangePresetValue, from?: Date, to?: Date) => {
    const q: Record<string, string | string[] | undefined> = { ...router.query };
    q.range = range;
    if (range === "custom" && from && to) {
      q.from = format(from, "yyyy-MM-dd");
      q.to = format(to, "yyyy-MM-dd");
    } else {
      delete q.from;
      delete q.to;
    }
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false });
  };

  const handleCombineChange = (v: boolean) => {
    const q: Record<string, string | string[] | undefined> = { ...router.query };
    if (v) {
      q.combine = "1";
      delete q.currency;
    } else {
      delete q.combine;
    }
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false });
  };

  const customFrom =
    homeQuery.fromYmd && homeQuery.range === "custom" ? parseISO(homeQuery.fromYmd) : undefined;
  const customTo =
    homeQuery.toYmd && homeQuery.range === "custom" ? parseISO(homeQuery.toYmd) : undefined;

  const ordersSparkSub = periodCustom
    ? multiCurrency && !combineAll
      ? t("home.spark.ordersInCurrency", { currency })
      : t("home.spark.ordersInRange")
    : multiCurrency
      ? t("home.spark.ordersInCurrency", { currency })
      : t("home.spark.ordersLast30d");

  const revenueSparkSub =
    deltaPct != null
      ? periodCustom
        ? t("home.spark.vsPrevPeriod")
        : t("home.spark.vsPrev30d")
      : periodCustom
        ? t("home.spark.revenueInRange")
        : t("home.spark.last30d");

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
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <DateRangeFilter
              range={homeQuery.range}
              from={customFrom}
              to={customTo}
              onChange={handleRangeChange}
            />
            <div className="flex flex-wrap items-center gap-4">
              {multiCurrency && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="combine-currencies"
                    checked={combineAll}
                    onCheckedChange={handleCombineChange}
                  />
                  <Label htmlFor="combine-currencies" className="text-xs text-muted-foreground cursor-pointer">
                    {t("home.combineAll")}
                  </Label>
                </div>
              )}
              {multiCurrency && !combineAll && (
                <CurrencySwitcher
                  currencies={currencies}
                  selected={currency}
                  onChange={handleCurrencyChange}
                />
              )}
            </div>
          </div>

          {multiCurrency && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground px-1">
              <span className="font-medium text-foreground">{t("home.multiCurrency")}</span>
              <span>·</span>
              <span>{t("home.viewingIn")}</span>
              <span className="font-mono font-semibold text-foreground">{currency}</span>
              {combineAll && (
                <span className="text-xs max-w-md">{t("home.combineHint")}</span>
              )}
            </div>
          )}

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

          {(snapshotRel || showRefreshing) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground px-1">
              {snapshotRel ? (
                <span>{t("home.dataUpdated", { relative: snapshotRel })}</span>
              ) : null}
              {showRefreshing ? (
                <span className="text-primary">{t("home.refreshingData")}</span>
              ) : null}
            </div>
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
