import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  label: string;
  value: string;
  suffix?: string;
  subtext?: string;
  data: { v: number }[];
  color?: string;
  delta?: number | null;
  loading?: boolean;
}

export function SparklineTile({ label, value, suffix, subtext, data, color = "hsl(var(--success))", delta, loading }: Props) {
  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">{label}</div>
          <div className="h-10 w-24">
            {!loading && data.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={color} fill={`url(#sg-${label})`} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight">
            {value}
            {suffix ? <span className="text-sm text-muted-foreground font-normal ml-1">{suffix}</span> : null}
          </div>
        )}
        {subtext && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {delta != null && delta !== 0 && (
              <span className={`inline-flex items-center gap-0.5 ${delta > 0 ? "text-success" : "text-destructive"}`}>
                {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            <span>{subtext}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}