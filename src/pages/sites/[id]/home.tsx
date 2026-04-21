import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Sparkles } from "lucide-react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { useSiteHomeStats } from "@/hooks/queries/useSiteStats";
import { StatStrip } from "@/components/site/home/StatStrip";
import { SalesTrendCard } from "@/components/site/home/SalesTrendCard";
import { OrderStatusDonut } from "@/components/site/home/OrderStatusDonut";
import { SparklineTile } from "@/components/site/home/SparklineTile";
import { RecentOrdersCard } from "@/components/site/home/RecentOrdersCard";
import { TopProductsCard } from "@/components/site/home/TopProductsCard";

function fmtMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}

function HomeInner() {
  const { store, loading: storeLoading } = useSiteFromRoute();
  const qc = useQueryClient();
  const storeId = store?.id;
  const currency = (store as { currency?: string } | null)?.currency || "KWD";
  const { data, isLoading, isFetching } = useSiteHomeStats(storeId);

  const s = data?.stats;
  const aov = s && s.orders_month_count > 0 ? s.sales_month / s.orders_month_count : 0;
  const deltaPct = s && s.sales_prev_month > 0 ? ((s.sales_month - s.sales_prev_month) / s.sales_prev_month) * 100 : null;

  const salesSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.revenue })), [data]);
  const ordersSpark = useMemo(() => (data?.daily || []).map((d) => ({ v: d.orders })), [data]);

  const hasAnyData = s && s.orders_total > 0;

  if (storeLoading) return <SiteLoadingSkeleton />;

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{store?.name || "Site"}</h1>
          <p className="text-sm text-muted-foreground truncate">{store?.url || ""}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["site-home-stats", storeId] })}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!isLoading && !hasAnyData ? (
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <SalesTrendCard data={data?.daily || []} currency={currency} loading={isLoading} />
            </div>
            <div>
              <OrderStatusDonut data={data?.status_breakdown || []} loading={isLoading} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SparklineTile
              label="Sales"
              value={String(s?.orders_month_count ?? 0)}
              subtext={`orders in last 30 days`}
              data={ordersSpark}
              color="hsl(var(--primary))"
              loading={isLoading}
            />
            <SparklineTile
              label="Revenue"
              value={fmtMoney(s?.sales_month ?? 0)}
              suffix={currency}
              subtext={deltaPct != null ? `vs previous 30 days` : `last 30 days`}
              data={salesSpark}
              color="hsl(var(--success))"
              delta={deltaPct}
              loading={isLoading}
            />
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