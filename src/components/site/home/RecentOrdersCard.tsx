import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { formatStoreDateTime } from "@/lib/format-store-date";
import { useRouter } from "next/router";
import Image from "next/image";
import { useTranslation } from "next-i18next";

interface RecentOrder {
  id: string;
  woo_id: number | null;
  order_number: string | null;
  status: string | null;
  total: string | null;
  currency: string | null;
  date_created: string | null;
  line_items: unknown;
  billing: unknown;
}

interface Props {
  orders: RecentOrder[];
  storeId: string;
  currency: string;
  storeTimezone?: string | null;
  loading?: boolean;
}

function customerName(billing: unknown): string {
  if (!billing || typeof billing !== "object") return "—";
  const b = billing as { first_name?: string; last_name?: string; email?: string };
  const n = [b.first_name, b.last_name].filter(Boolean).join(" ").trim();
  return n || b.email || "—";
}

export function RecentOrdersCard({ orders, storeId, currency, storeTimezone, loading }: Props) {
  const { t, i18n } = useTranslation("site");
  const router = useRouter();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("home.cards.recentOrders.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("home.cards.recentOrders.subtitle")}</p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("home.cards.recentOrders.empty")}</div>
        ) : (
          <div className="divide-y">
            {orders.map((o) => {
              const items = Array.isArray(o.line_items) ? (o.line_items as Array<Record<string, unknown>>) : [];
              return (
                <button
                  key={o.id}
                  onClick={() => router.push(`/sites/${storeId}/orders/${o.id}`)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <StatusBadge variant={getStatusVariant(o.status || "")} className="shrink-0">
                    {o.status || "—"}
                  </StatusBadge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">#{o.order_number || o.woo_id || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{customerName(o.billing)}</div>
                  </div>
                  <div className="hidden sm:flex items-center -space-x-2">
                    {items.slice(0, 3).map((li, i) => {
                      const img = (li.image as { src?: string } | undefined)?.src;
                      const qty = (li.quantity as number) || 0;
                      return (
                        <div key={i} className="relative h-9 w-9 rounded-md border bg-muted overflow-hidden ring-2 ring-background">
                          {img ? (
                            <Image src={img} alt="" fill sizes="36px" className="object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">—</div>
                          )}
                          {qty > 1 && (
                            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] leading-none rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                              {qty}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-right shrink-0 w-24">
                    <div className="text-sm font-semibold tabular-nums">
                      {Number(o.total || 0).toFixed(2)} <span className="text-xs text-muted-foreground">{o.currency || currency}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.date_created
                        ? formatStoreDateTime(o.date_created, storeTimezone, i18n.language)
                        : "—"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}