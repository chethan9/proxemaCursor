"use client";

import Link from "next/link";
import { AlertTriangle, Info, Package, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProximaWidget } from "@/lib/assistant/widget-schema";

type Props = {
  widget: ProximaWidget;
  storeId: string | null;
};

function formatDelta(pct: number | null | undefined): string | null {
  if (pct == null || Number.isNaN(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function MetricStrip({ widget }: { widget: ProximaWidget }) {
  if (widget.kind !== "metric_strip") return null;
  return (
    <div className="not-prose space-y-2">
      {widget.title ? <p className="text-xs font-medium text-muted-foreground">{widget.title}</p> : null}
      <div className="flex flex-wrap gap-2">
        {widget.metrics.map((m, i) => {
          const delta = formatDelta(m.delta_pct ?? null);
          const pos = (m.delta_pct ?? 0) > 0;
          const neg = (m.delta_pct ?? 0) < 0;
          return (
            <div
              key={`${m.label}-${i}`}
              className="min-w-[100px] flex-1 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{m.value}</p>
              {delta ? (
                <p
                  className={cn(
                    "text-[11px] tabular-nums",
                    pos && "text-emerald-600 dark:text-emerald-400",
                    neg && "text-rose-600 dark:text-rose-400",
                    !pos && !neg && "text-muted-foreground",
                  )}
                >
                  {delta}
                  {m.hint ? <span className="ml-1 font-normal text-muted-foreground">({m.hint})</span> : null}
                </p>
              ) : m.hint ? (
                <p className="text-[11px] text-muted-foreground">{m.hint}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductMiniGrid({
  widget,
  storeId,
}: {
  widget: ProximaWidget;
  storeId: string | null;
}) {
  if (widget.kind !== "product_grid") return null;
  return (
    <div className="not-prose space-y-2">
      {widget.title ? <p className="text-xs font-medium text-muted-foreground">{widget.title}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {widget.items.map((p, i) => {
          const href =
            p.href ?? (storeId && p.id ? `/sites/${storeId}/products/edit/${p.id}` : undefined);
          const inner = (
            <>
              <div className="relative mb-1.5 aspect-square w-full overflow-hidden rounded-lg border border-border/70 bg-muted/50 ring-1 ring-black/[0.04] dark:ring-white/10">
                {p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote thumbs
                  <img
                    src={p.thumbnail_url}
                    alt=""
                    className="h-full w-full object-contain p-1"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground/50" aria-hidden />
                  </div>
                )}
              </div>
              <p className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">{p.name}</p>
              {(p.units != null || p.revenue != null) && (
                <p className="text-[10px] text-muted-foreground">
                  {p.units != null ? <span>{p.units} sold</span> : null}
                  {p.units != null && p.revenue != null ? " · " : null}
                  {p.revenue != null ? <span>{p.revenue}</span> : null}
                </p>
              )}
            </>
          );
          return href ? (
            <Link
              key={`${p.name}-${i}`}
              href={href}
              className="block rounded-xl border border-transparent p-1.5 transition hover:border-primary/25 hover:bg-muted/60"
            >
              {inner}
            </Link>
          ) : (
            <div key={`${p.name}-${i}`} className="rounded-xl p-1.5">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderList({
  widget,
  storeId,
}: {
  widget: ProximaWidget;
  storeId: string | null;
}) {
  if (widget.kind !== "order_list") return null;
  return (
    <div className="not-prose space-y-2">
      {widget.title ? <p className="text-xs font-medium text-muted-foreground">{widget.title}</p> : null}
      <ul className="space-y-1.5">
        {widget.orders.map((o, i) => {
          const href =
            o.href ??
            (storeId && o.id ? `/sites/${storeId}/orders/${o.id}` : storeId ? `/sites/${storeId}/orders` : undefined);
          const row = (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2 text-[11px] ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">
                  #{o.order_number ?? (o.id ? o.id.slice(0, 8) : "—")}
                </span>
                {o.status ? (
                  <span className="ml-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
                    {o.status}
                  </span>
                ) : null}
                {o.date_created ? (
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{o.date_created}</span>
                ) : null}
              </div>
              {o.total != null && (
                <span className="shrink-0 tabular-nums font-medium text-foreground">
                  {o.currency ? `${o.currency} ` : ""}
                  {o.total}
                </span>
              )}
            </div>
          );
          const rowKey = o.id ?? o.order_number ?? String(i);
          return href ? (
            <li key={rowKey}>
              <Link href={href} className="block transition hover:opacity-90">
                {row}
              </Link>
            </li>
          ) : (
            <li key={rowKey}>{row}</li>
          );
        })}
      </ul>
    </div>
  );
}

function KvTable({ widget }: { widget: ProximaWidget }) {
  if (widget.kind !== "kv_table") return null;
  return (
    <div className="not-prose overflow-hidden rounded-lg border border-border/80 bg-muted/25 ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      {widget.title ? (
        <div className="border-b border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">{widget.title}</div>
      ) : null}
      <table className="w-full text-left text-[11px]">
        <tbody>
          {widget.rows.map((r, i) => (
            <tr key={`${r.key}-${i}`} className="border-b border-border/50 last:border-0">
              <th className="w-[40%] whitespace-normal px-3 py-2 align-top font-medium text-muted-foreground">{r.key}</th>
              <td className="px-3 py-2 text-foreground">{typeof r.value === "number" ? String(r.value) : r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertList({ widget }: { widget: ProximaWidget }) {
  if (widget.kind !== "alert_list") return null;
  return (
    <div className="not-prose space-y-2">
      {widget.title ? <p className="text-xs font-medium text-muted-foreground">{widget.title}</p> : null}
      <ul className="space-y-1.5">
        {widget.alerts.map((a, i) => {
          const sev = a.severity ?? "info";
          const Icon = sev === "danger" ? AlertTriangle : Info;
          return (
            <li
              key={`${i}-${a.message.slice(0, 24)}`}
              className={cn(
                "flex gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug ring-1",
                sev === "info" && "border-border/70 bg-muted/30 ring-black/[0.03] dark:ring-white/[0.06]",
                sev === "warning" && "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
                sev === "danger" && "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{a.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AssistantWidgets({ widget, storeId }: Props) {
  switch (widget.kind) {
    case "metric_strip":
      return <MetricStrip widget={widget} />;
    case "product_grid":
      return <ProductMiniGrid widget={widget} storeId={storeId} />;
    case "order_list":
      return <OrderList widget={widget} storeId={storeId} />;
    case "kv_table":
      return <KvTable widget={widget} />;
    case "alert_list":
      return <AlertList widget={widget} />;
    default:
      return null;
  }
}
