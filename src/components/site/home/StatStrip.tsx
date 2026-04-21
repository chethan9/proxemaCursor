import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatItem {
  label: string;
  value: string | number;
  suffix?: string;
}

export function StatStrip({ items, loading }: { items: StatItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 divide-y md:divide-y-0 md:divide-x">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-2">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 md:divide-x">
        {items.map((it) => (
          <div key={it.label} className="px-5 py-4">
            <div className="text-xs text-muted-foreground mb-1">{it.label}</div>
            <div className="text-2xl font-semibold tracking-tight">
              {it.value}
              {it.suffix ? <span className="text-sm text-muted-foreground font-normal ml-1">{it.suffix}</span> : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}