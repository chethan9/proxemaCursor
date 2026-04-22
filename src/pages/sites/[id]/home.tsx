import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Sparkles, AlertTriangle } from "lucide-react";
import { SitePageShell, useSiteFromRoute } from "@/components/site/shared";
import { useSiteHomeStats } from "@/hooks/queries/useSiteStats";
import { StatStrip } from "@/components/site/home/StatStrip";
import { SalesTrendCard } from "@/components/site/home/SalesTrendCard";
import { OrderStatusDonut } from "@/components/site/home/OrderStatusDonut";
import { SparklineTile } from "@/components/site/home/SparklineTile";
import { RecentOrdersCard } from "@/components/site/home/RecentOrdersCard";
import { TopProductsCard } from "@/components/site/home/TopProductsCard";
import { SiteBlockedBanner } from "@/components/site/SiteBlockedBanner";

function fmtMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}

function HomeInner() {
  const { store, loading: storeLoading } = useSiteFromRoute();
  const qc = useQueryClient();
  const storeId = store?.id;
  const currency = (store as { currency?: string } | null)?.currency || "KWD";
  const { data, isLoading, isFetching, error, refetch } = useSiteHomeStats(storeId);

  const s = data?.stats;
  const aov = s && s.orders_month_count > 0 ? s.sales_month / s.orders_month_count : 0;
  const deltaPct = s && s.sales_prev_month > 0 ? ((s.sales_month - s.sales_prev_month) / s.sales_prev_month) * 100 : null;

  const salesSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.revenue })), [data]);
  const ordersSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.orders })), [data]);

  const hasError = !!error;
  const querySucceeded = !storeLoading && !isLoading && !hasError && !!data;
  const showEmpty = querySucceeded && (!s || s.orders_total === 0);

  return (
    <div className="px-6 pt-2 pb-6 space-y-4 max-w-[1600px] mx-auto">
      {storeId && <SiteBlockedBanner storeId={storeId} />}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-20 right-6 h-10 w-10 rounded-full shadow-lg bg-background hover:shadow-xl"
        style={{ zIndex: 9998 }}
        onClick={() => qc.invalidateQueries({ queryKey: ["site-home-stats", storeId] })}
        disabled={isFetching}
        title="Refresh"
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>

      {hasError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Unable to load dashboard stats</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {(error as Error)?.message || "Something went wrong fetching site statistics."}
            </p>
            <Button onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : showEmpty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your dashboard will populate automatically once your first order arrives.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatStrip
            loading={isLoading}
            items={[
              { label: "Orders Today", value: s?.orders_today ?? 0 },
              { label: "Orders in Progress", value: s?.orders_in_progress ?? 0 },
              { label: "Today Sales", value: fmtMoney(s?.sales_today ?? 0), suffix: currency },
              { label: "Weekly Sales", value: fmtMoney(s?.sales_week ?? 0), suffix: currency },
              { label: "Monthly Sales", value: fmtMoney(s?.sales_month ?? 0), suffix: currency },
              { label: "Avg Order (30d)", value: fmtMoney(aov), suffix: currency },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6">
              <SalesTrendCard data={data?.daily || []} currency={currency} loading={isLoading} />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-4">
              <SparklineTile
                label="Sales"
                value={String(s?.orders_month_count ?? 0)}
                subtext="orders last 30d"
                data={ordersSpark}
                color="hsl(var(--primary))"
                loading={isLoading}
                compact
              />
              <SparklineTile
                label="Revenue"
                value={fmtMoney(s?.sales_month ?? 0)}
                suffix={currency}
                subtext={deltaPct != null ? "vs prev 30d" : "last 30d"}
                data={salesSpark}
                color="hsl(var(--success))"
                delta={deltaPct}
                loading={isLoading}
                compact
              />
            </div>
            <div className="lg:col-span-4">
              <OrderStatusDonut data={data?.status_breakdown || []} loading={isLoading} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <RecentOrdersCard
                orders={data?.recent_orders || []}
                storeId={storeId || ""}
                currency={currency}
                loading={isLoading}
              />
            </div>
            <div>
              <TopProductsCard
                products={data?.top_products || []}
                storeId={storeId || ""}
                currency={currency}
                loading={isLoading}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SiteHomePage() {
  return <SitePageShell><HomeInner /></SitePageShell>;
}