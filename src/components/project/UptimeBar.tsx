import type { UptimePoint } from "@/hooks/queries/useSitesUptime";

interface Props {
  history: UptimePoint[];
  barCount?: number;
  className?: string;
}

export function UptimeBar({ history, barCount = 14, className = "" }: Props) {
  const bars: (UptimePoint | null)[] = [];
  for (let i = 0; i < barCount; i++) bars.push(history[i] || null);
  const ordered = bars.reverse();

  const successCount = history.filter((h) => h.status === "completed").length;
  const pct = history.length > 0 ? Math.round((successCount / history.length) * 100) : null;

  return (
    <div className={className}>
      <div className="flex items-end gap-[2px] h-5">
        {ordered.map((h, i) => {
          let color = "bg-muted-foreground/15";
          let title = "No data";
          if (h) {
            const when = h.started_at ? new Date(h.started_at).toLocaleString() : "";
            if (h.status === "completed") {
              color = "bg-emerald-500";
              title = `Success — ${when}`;
            } else if (h.status === "failed") {
              color = "bg-red-500";
              title = `Failed — ${when}`;
            } else if (h.status === "cancelled") {
              color = "bg-amber-400";
              title = `Cancelled — ${when}`;
            } else if (h.status === "running" || h.status === "queued") {
              color = "bg-blue-500 animate-pulse";
              title = `In progress — ${when}`;
            } else {
              title = `${h.status} — ${when}`;
            }
          }
          return <div key={i} className={`flex-1 h-full rounded-[2px] ${color}`} title={title} />;
        })}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">Uptime</span>
        <span className="text-[9px] text-muted-foreground font-medium tabular-nums">
          {pct != null ? `${pct}%` : "—"}
        </span>
      </div>
    </div>
  );
}