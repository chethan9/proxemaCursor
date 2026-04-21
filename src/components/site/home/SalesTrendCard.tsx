import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, ComposedChart } from "recharts";
import { format, parseISO } from "date-fns";

interface Props {
  data: { day: string; orders: number; revenue: number }[];
  currency: string;
  loading?: boolean;
}

export function SalesTrendCard({ data, currency, loading }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.day), "MMM d"),
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sales Trend (30d)</CardTitle>
        <p className="text-xs text-muted-foreground">Daily revenue and order count</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={40} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={28} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                    padding: "8px 10px",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  formatter={(value: number, name: string) => {
                    if (name === "Revenue") return [`${value.toFixed(2)} ${currency}`, name];
                    return [value, name];
                  }}
                />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}