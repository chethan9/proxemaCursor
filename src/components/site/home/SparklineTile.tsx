import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  suffix?: string;
  subtext?: string;
  data: { v: number }[];
  color: string;
  delta?: number | null;
  loading?: boolean;
  compact?: boolean;
}

export function SparklineTile({ label, value, suffix, subtext, data, color, delta, loading, compact }: Props) {
  return (
    <Card className="h-full">
      <CardContent className={cn(compact ? "p-3" : "p-4", "h-full flex flex-col justify-between gap-2")}>
        {loading ? (
          <>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className={cn("text-muted-foreground font-medium", compact ? "text-[11px]" : "text-xs")}>{label}</span>
              {delta != null && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.5 rounded",
                  delta >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
                )}>
                  {delta >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {Math.abs(delta).toFixed(1)}%
                </span>
              )}
            </div>
            <div className={cn("font-semibold leading-tight truncate", compact ? "text-lg" : "text-2xl")}>
              {value}
              {suffix && <span className={cn("ml-1 text-muted-foreground font-normal", compact ? "text-[10px]" : "text-xs")}>{suffix}</span>}
            </div>
            <div className={cn(compact ? "h-8" : "h-10", "-mx-1")}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {subtext && <div className="text-[10px] text-muted-foreground truncate">{subtext}</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}