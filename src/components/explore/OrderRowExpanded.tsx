import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, User, ExternalLink, Loader2, Package, MapPin, Truck, Tag, ImageIcon, FileText } from "lucide-react";
import { updateOrderStatus, getCustomerName, getCustomerEmail, type OrderRow } from "@/services/orderService";
import { useToast } from "@/hooks/use-toast";

interface Props {
  order: OrderRow;
  storeUrl?: string | null;
  onSaved: (o: OrderRow) => void;
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; ring: string }> = {
  processing: { dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", ring: "ring-blue-200 dark:ring-blue-900" },
  "on-hold": { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-900" },
  completed: { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200 dark:ring-emerald-900" },
  cancelled: { dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-200 dark:ring-rose-900" },
  refunded: { dot: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-200 dark:ring-violet-900" },
  failed: { dot: "bg-slate-500", bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", ring: "ring-slate-200 dark:ring-slate-700" },
  pending: { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-900" },
};

const STATUS_CHANGE_OPTIONS = ["processing", "on-hold", "completed", "cancelled", "refunded", "failed"];

export function OrderRowExpanded({ order, storeUrl, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const billing = (order.billing || {}) as {
    first_name?: string; last_name?: string; email?: string; phone?: string;
    address_1?: string; address_2?: string; city?: string; state?: string; postcode?: string; country?: string;
  };
  const shipping = (order.shipping || {}) as typeof billing;
  const lineItems = Array.isArray(order.line_items) ? (order.line_items as Array<{
    name?: string; sku?: string; quantity?: number; price?: number | string; total?: string; image?: { src?: string };
  }>) : [];
  const coupons = Array.isArray(order.coupon_lines) ? (order.coupon_lines as Array<{ code?: string; discount?: string }>) : [];
  const shippingLines = Array.isArray(order.shipping_lines) ? (order.shipping_lines as Array<{ method_title?: string; total?: string }>) : [];

  const custName = getCustomerName(order.billing);
  const custEmail = getCustomerEmail(order.billing);
  const currency = order.currency || "KWD";

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === order.status) return;
    setSaving(newStatus);
    const previousStatus = order.status;
    onSaved({ ...order, status: newStatus });
    try {
      const updated = await updateOrderStatus(order.id, newStatus);
      onSaved(updated);
      toast({ title: "Status updated", description: `Order #${order.order_number || order.woo_id} → ${newStatus}` });
    } catch (e) {
      onSaved({ ...order, status: previousStatus });
      toast({ title: "Update failed — reverted", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const formatAddress = (a: typeof billing) => {
    const lines = [
      [a.address_1, a.address_2].filter(Boolean).join(", "),
      [a.city, a.state, a.postcode].filter(Boolean).join(", "),
      a.country,
    ].filter(Boolean);
    return lines.length > 0 ? lines : ["—"];
  };

  return (
    <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_150px] gap-5">
      {/* Col 1: Line items + shipping + coupons */}
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />Items ({lineItems.length})
          </div>
          <div className="space-y-2">
            {lineItems.length === 0 && <div className="text-xs text-muted-foreground">No items</div>}
            {lineItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-md border border-border bg-background">
                {item.image?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image.src} alt="" className="h-12 w-12 rounded object-cover border border-border shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                    <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name || "—"}</div>
                  {item.sku && <div className="text-[11px] text-muted-foreground font-mono">SKU: {item.sku}</div>}
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <Badge variant="secondary" className="h-5 px-1.5 font-mono">{item.price ?? "—"} {currency}</Badge>
                    <span className="text-muted-foreground">×</span>
                    <Badge variant="secondary" className="h-5 px-1.5">Qty: {item.quantity ?? 0}</Badge>
                    <span className="text-muted-foreground ml-auto font-mono font-semibold">{item.total ?? "—"} {currency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {shippingLines.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />Shipping
            </div>
            {shippingLines.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded-md border border-border bg-background">
                <span>{s.method_title || "—"}</span>
                <span className="font-mono text-xs">{s.total} {currency}</span>
              </div>
            ))}
          </div>
        )}

        {coupons.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />Coupons
            </div>
            <div className="flex flex-wrap gap-1.5">
              {coupons.map((c, i) => (
                <Badge key={i} variant="outline" className="font-mono text-[11px]">
                  {c.code} {c.discount && <span className="ml-1 text-muted-foreground">-{c.discount}</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1 pt-2 border-t border-border text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-mono">{order.subtotal ?? "—"} {currency}</span>
          </div>
          {order.total_tax != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="font-mono">{order.total_tax} {currency}</span>
            </div>
          )}
          {order.shipping_total != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span className="font-mono">{order.shipping_total} {currency}</span>
            </div>
          )}
          {order.discount_total && Number(order.discount_total) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="font-mono">-{order.discount_total} {currency}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-border font-semibold">
            <span>Total</span>
            <span className="font-mono">{order.total ?? "—"} {currency}</span>
          </div>
        </div>
      </div>

      {/* Col 2: Customer + addresses (wider now) */}
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />Customer
          </div>
          <div className="space-y-1.5">
            <div className="text-sm font-medium">{custName}</div>
            {custEmail && (
              <a href={`mailto:${custEmail}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary break-all">
                <Mail className="h-3 w-3 shrink-0" />{custEmail}
              </a>
            )}
            {billing.phone && (
              <a href={`tel:${billing.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                <Phone className="h-3 w-3" />{billing.phone}
              </a>
            )}
            <div className="text-xs text-muted-foreground pt-1">
              Payment: <span className="text-foreground">{order.payment_method_title || order.payment_method || "—"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />Billing
            </div>
            <div className="text-sm space-y-0.5 leading-relaxed">
              {formatAddress(billing).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />Shipping
            </div>
            <div className="text-sm space-y-0.5 leading-relaxed">
              {formatAddress(shipping).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        </div>
      </div>

      {/* Col 3: Status change + actions (narrower) */}
      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Change status</div>
          <div className="space-y-1">
            {STATUS_CHANGE_OPTIONS.filter((s) => s !== order.status).map((s) => {
              const style = STATUS_STYLES[s] || STATUS_STYLES.pending;
              const isSaving = saving === s;
              return (
                <button
                  key={s}
                  disabled={!!saving}
                  onClick={() => handleStatusChange(s)}
                  className={`w-full inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium capitalize ring-1 ring-inset transition-all ${style.bg} ${style.text} ${style.ring} hover:ring-2 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:ring-1`}
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot} shrink-0`} />
                  )}
                  <span className="truncate">{s}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Actions</div>
          <div className="space-y-1">
            <Link href={`/sites/${order.store_id}/orders/${order.id}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <FileText className="h-2.5 w-2.5" />
              <span className="font-medium">Open order details</span>
              <span className="ml-auto">→</span>
            </Link>
            {custEmail && (
              <a href={`mailto:${custEmail}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] border border-border bg-background hover:bg-muted transition-colors">
                <Mail className="h-2.5 w-2.5" />
                <span>Email</span>
                <span className="ml-auto text-muted-foreground">→</span>
              </a>
            )}
            {storeUrl && (
              <a href={`${storeUrl.replace(/\/$/, "")}/wp-admin/post.php?post=${order.woo_id}&action=edit`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] border border-border bg-background hover:bg-muted transition-colors">
                <ExternalLink className="h-2.5 w-2.5" />
                <span>WP admin</span>
                <span className="ml-auto text-muted-foreground">→</span>
              </a>
            )}
            <button disabled className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] border border-border text-muted-foreground opacity-60 cursor-not-allowed">
              <User className="h-2.5 w-2.5" />
              <span>Customer</span>
              <span className="ml-auto">→</span>
            </button>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground pt-2 border-t border-border space-y-0.5">
          <div>Woo ID: <span className="font-mono text-foreground">{order.woo_id}</span></div>
          {order.date_created && <div>{new Date(order.date_created).toLocaleDateString()}</div>}
        </div>
      </div>
    </div>
  );
}