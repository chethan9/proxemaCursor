import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "next-i18next";

const STATUS_COLORS: Record<string, string> = {
  processing: "hsl(221 83% 53%)",
  completed: "hsl(142 76% 36%)",
  "on-hold": "hsl(38 92% 50%)",
  pending: "hsl(215 20% 65%)",
  cancelled: "hsl(0 84% 60%)",
  refunded: "hsl(280 65% 60%)",
  failed: "hsl(0 72% 45%)",
  trash: "hsl(215 14% 34%)",
  unknown: "hsl(215 20% 65%)",
};

interface Props {
  data: { status: string; count: number }[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}

export function OrderStatusDonut({ data, loading, title, subtitle }: Props) {
  const { t } = useTranslation("site");
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map((d) => ({ ...d, color: STATUS_COLORS[d.status] || STATUS_COLORS.unknown }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title ?? t("home.cards.orderStatus.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle ?? t("home.cards.orderStatus.subtitle")}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : total === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">{t("home.cards.orderStatus.empty")}</div>
        ) : (
          <div className="flex flex-col">
            <div className="h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="count" nameKey="status" innerRadius={55} outerRadius={80} paddingAngle={2}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-2xl font-semibold">{total}</div>
                <div className="text-xs text-muted-foreground">{t("home.cards.orderStatus.total")}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {chartData.map((d) => (
                <div key={d.status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="capitalize">{d.status.replace(/-/g, " ")}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}