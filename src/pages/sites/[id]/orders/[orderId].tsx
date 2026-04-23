import { useRouter } from "next/router";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Package,
  Truck,
  Check,
  Loader2,
  ExternalLink,
  Send,
  Tag,
  FileText,
  ImageIcon,
  CheckCircle2,
  Circle,
  XCircle,
  Ban,
  RotateCcw,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStore } from "@/services/storeService";
import { updateOrderStatus, getCustomerName, getCustomerEmail, type OrderRow } from "@/services/orderService";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { useSiteMutation } from "@/hooks/useSiteMutation";

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; ring: string; label: string }> = {
  processing: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", ring: "ring-blue-200 dark:ring-blue-900", label: "Processing" },
  "on-hold": { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-900", label: "On Hold" },
  completed: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-900", label: "Completed" },
  cancelled: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500", ring: "ring-rose-200 dark:ring-rose-900", label: "Cancelled" },
  refunded: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500", ring: "ring-violet-200 dark:ring-violet-900", label: "Refunded" },
  failed: { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500", ring: "ring-slate-200 dark:ring-slate-700", label: "Failed" },
  pending: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-900", label: "Pending" },
};

const STATUS_OPTIONS = ["processing", "on-hold", "completed", "cancelled", "refunded", "failed"];

function fmtDateTime(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

function Stepper({ order, datePaid, dateCompleted }: { order: OrderRow; datePaid?: string; dateCompleted?: string }) {
  const status = order.status || "pending";
  const placed = { label: "Order Placed", date: order.date_created, done: true };
  const processing = { label: "Processing", date: datePaid || order.date_modified, done: ["processing", "on-hold", "completed"].includes(status) };
  const completed = { label: "Completed", date: dateCompleted, done: status === "completed" };

  const branchIcon = status === "cancelled" ? Ban : status === "refunded" ? RotateCcw : status === "failed" ? XCircle : null;
  const branchLabel = status === "cancelled" ? "Cancelled" : status === "refunded" ? "Refunded" : status === "failed" ? "Failed" : null;
  const steps = [placed, processing, completed];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Update Order Status</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {steps.map((step, i) => {
            const Icon = step.done ? CheckCircle2 : Circle;
            return (
              <div key={i} className={cn("flex items-center gap-3 p-3 rounded-lg border", step.done ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900" : "bg-muted/30 border-border")}>
                <Icon className={cn("h-5 w-5 shrink-0", step.done ? "text-emerald-600" : "text-muted-foreground/40")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{step.done ? fmtDateTime(step.date) : "Not yet"}</div>
                </div>
              </div>
            );
          })}
        </div>
        {branchIcon && branchLabel && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20">
            {(() => { const I = branchIcon; return <I className="h-5 w-5 text-rose-600 shrink-0" />; })()}
            <div className="text-sm font-medium text-rose-700 dark:text-rose-300">{branchLabel}</div>
            <div className="text-[11px] text-muted-foreground ml-auto">{fmtDateTime(order.date_modified)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const storeId = typeof router.query.id === "string" ? router.query.id : "";
  const orderId = typeof router.query.orderId === "string" ? router.query.orderId : "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Array<{ note: string; date_created: string; author?: string }>>([]);

  const { data: store } = useQuery({ queryKey: queryKeys.store(storeId), queryFn: () => getStore(storeId), enabled: !!storeId, staleTime: 60_000 });
  const { data: order, isLoading } = useQuery<OrderRow | null>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (error) throw error;
      return data as unknown as OrderRow | null;
    },
    enabled: !!orderId,
  });

  const custEmailForLookup = order ? getCustomerEmail(order.billing) : "";
  const { data: linkedCustomer } = useQuery({
    queryKey: ["order-customer-link", storeId, order?.customer_id, custEmailForLookup],
    queryFn: async () => {
      if (!order) return null;
      const hasWooId = order.customer_id && order.customer_id > 0;
      if (!hasWooId && !custEmailForLookup) return null;
      let query = supabase.from("customers").select("id").eq("store_id", storeId).limit(1);
      if (hasWooId) {
        query = query.eq("woo_id", order.customer_id as number);
      } else if (custEmailForLookup) {
        query = query.ilike("email", custEmailForLookup);
      }
      const { data, error } = await query.maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!(order && storeId && (order.customer_id || custEmailForLookup)),
    staleTime: 60_000,
  });

  const billing = (order?.billing || {}) as { first_name?: string; last_name?: string; email?: string; phone?: string; address_1?: string; address_2?: string; city?: string; state?: string; postcode?: string; country?: string };
  const shipping = (order?.shipping || {}) as typeof billing;
  const lineItems = Array.isArray(order?.line_items) ? (order!.line_items as Array<{ name?: string; sku?: string; quantity?: number; price?: number | string; total?: string; image?: { src?: string }; meta_data?: Array<{ key?: string; value?: string; display_key?: string; display_value?: string }> }>) : [];
  const coupons = Array.isArray(order?.coupon_lines) ? (order!.coupon_lines as Array<{ code?: string; discount?: string }>) : [];
  const shippingLines = Array.isArray(order?.shipping_lines) ? (order!.shipping_lines as Array<{ method_title?: string; total?: string }>) : [];
  const currency = order?.currency || "KWD";
  const raw = (order?.raw_data || {}) as {
    customer_ip_address?: string;
    order_notes?: Array<{ note?: string; date_created?: string; author?: string }>;
    date_paid?: string;
    date_completed?: string;
    customer_note?: string;
    transaction_id?: string;
  };
  const persistedNotes = Array.isArray(raw.order_notes) ? raw.order_notes : [];
  const allNotes = [...localNotes, ...persistedNotes.map((n) => ({ note: n.note || "", date_created: n.date_created || "", author: n.author }))];
  const statusStyle = order ? STATUS_STYLES[order.status || "pending"] || STATUS_STYLES.pending : STATUS_STYLES.pending;

  const statusMutation = useSiteMutation<OrderRow, string>({
    mutationFn: (newStatus) => updateOrderStatus(orderId, newStatus),
    invalidateKeys: [["order", orderId], storeId ? queryKeys.orders(storeId) : ["orders"]],
    optimisticUpdates: [
      {
        queryKey: ["order", orderId],
        updater: (old, newStatus) => old ? { ...(old as OrderRow), status: newStatus } : old,
      },
    ],
    siteName: store?.name,
    successToast: (_d, newStatus) => `Order → ${newStatus}`,
    onSuccessExtra: (updated) => queryClient.setQueryData(["order", orderId], updated),
  });

  const handleStatusChange = (newStatus: string) => {
    if (!order || newStatus === order.status) return;
    statusMutation.mutate(newStatus);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    setLocalNotes((prev) => [{ note: noteText.trim(), date_created: new Date().toISOString(), author: "You" }, ...prev]);
    setNoteText("");
    toast({ title: "Note added locally", description: "Syncing to WooCommerce will be available soon." });
  };

  const formatAddress = (a: typeof billing) => [
    [a.first_name, a.last_name].filter(Boolean).join(" "),
    [a.address_1, a.address_2].filter(Boolean).join(", "),
    [a.city, a.state, a.postcode].filter(Boolean).join(", "),
    a.country,
    a.phone,
    a.email,
  ].filter(Boolean);

  const itemMeta = (item: { meta_data?: Array<{ display_key?: string; display_value?: string; key?: string; value?: string }> }) => {
    if (!Array.isArray(item.meta_data)) return "";
    return item.meta_data
      .filter((m) => m.display_key && m.display_value && !String(m.key || "").startsWith("_"))
      .map((m) => `${m.display_value}`)
      .join(" / ");
  };

  return (
    <AuthGuard>
      <SiteLayout>
        <div className="px-6 py-5 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/sites/${storeId}/orders`}>
              <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">
                <Link href={`/sites/${storeId}/orders`} className="hover:text-foreground">Orders</Link> / Order Details
              </div>
              <h1 className="text-xl font-semibold leading-tight">
                {isLoading ? <Skeleton className="h-6 w-40" /> : `Order #${order?.order_number || order?.woo_id || "—"}`}
              </h1>
            </div>
            {order && (
              <Badge className={cn("h-7 px-3 text-xs font-medium ring-1 border-0 capitalize", statusStyle.bg, statusStyle.text, statusStyle.ring)}>
                <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", statusStyle.dot)} />
                {statusStyle.label}
              </Badge>
            )}
          </div>

          {isLoading || !order ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
              {/* Main column */}
              <div className="space-y-4 min-w-0">
                <Stepper order={order} datePaid={raw.date_paid} dateCompleted={raw.date_completed} />

                {/* 3-up info cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3"><User className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Customer Details</h3></div>
                      <dl className="text-sm space-y-1.5">
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Name</dt><dd className="text-right truncate">{getCustomerName(order.billing)}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Email</dt><dd className="text-right truncate">{getCustomerEmail(order.billing) || "—"}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Phone</dt><dd className="text-right truncate">{billing.phone || "—"}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Customer IP</dt><dd className="text-right font-mono text-xs truncate">{raw.customer_ip_address || "—"}</dd></div>
                      </dl>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3"><MapPin className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Address</h3></div>
                      <div className="text-xs space-y-2.5">
                        <div>
                          <div className="text-muted-foreground mb-1">Shipping Address</div>
                          <div className="text-sm leading-relaxed">{formatAddress(shipping).map((l, i) => <div key={i}>{l}</div>)}</div>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <div className="text-muted-foreground mb-1">Billing Address</div>
                          <div className="text-sm leading-relaxed">{formatAddress(billing).map((l, i) => <div key={i}>{l}</div>)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3"><Package className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Order Details</h3></div>
                      <dl className="text-sm space-y-1.5">
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Placed on</dt><dd className="text-right">{fmtDateTime(order.date_created)}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Payment</dt><dd className="text-right truncate">{order.payment_method_title || order.payment_method || "—"}</dd></div>
                        {raw.transaction_id && <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Txn ID</dt><dd className="text-right font-mono text-xs truncate">{raw.transaction_id}</dd></div>}
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Paid on</dt><dd className="text-right">{fmtDateTime(raw.date_paid)}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Updated</dt><dd className="text-right">{fmtDateTime(order.date_modified)}</dd></div>
                        {raw.customer_note && <div className="pt-1 border-t border-border"><dt className="text-muted-foreground text-xs mb-0.5">Customer note</dt><dd className="text-xs">{raw.customer_note}</dd></div>}
                      </dl>
                    </CardContent>
                  </Card>
                </div>

                {/* Items */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3"><Package className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Items Ordered <span className="ml-1 text-xs text-muted-foreground font-normal">({lineItems.length})</span></h3></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                            <th className="text-left py-2 pr-2">Item</th>
                            <th className="text-left py-2 px-2">SKU</th>
                            <th className="text-left py-2 px-2">Variation</th>
                            <th className="text-right py-2 px-2">Qty</th>
                            <th className="text-right py-2 px-2">Price</th>
                            <th className="text-right py-2 pl-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, i) => (
                            <tr key={i} className="border-b border-border last:border-0">
                              <td className="py-3 pr-2">
                                <div className="flex items-center gap-3">
                                  {item.image?.src ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.image.src} alt="" className="h-10 w-10 rounded object-cover border border-border shrink-0" />
                                  ) : (
                                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center border border-border shrink-0"><ImageIcon className="h-4 w-4 text-muted-foreground/40" /></div>
                                  )}
                                  <div className="min-w-0 font-medium truncate">{item.name || "—"}</div>
                                </div>
                              </td>
                              <td className="py-3 px-2 font-mono text-xs text-muted-foreground">{item.sku || "—"}</td>
                              <td className="py-3 px-2 text-xs text-muted-foreground">{itemMeta(item) || "—"}</td>
                              <td className="py-3 px-2 text-right">{item.quantity ?? 0}</td>
                              <td className="py-3 px-2 text-right font-mono">{item.price ?? "—"}</td>
                              <td className="py-3 pl-2 text-right font-mono font-medium">{item.total ?? "—"}</td>
                            </tr>
                          ))}
                          {lineItems.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">No items</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="mt-4 space-y-1.5 text-sm max-w-sm ml-auto">
                      <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{order.subtotal ?? "—"} {currency}</span></div>
                      {coupons.map((c, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground"><span className="flex items-center gap-1.5"><Tag className="h-3 w-3" />Coupon <Badge variant="outline" className="h-5 font-mono text-[10px]">{c.code}</Badge></span><span className="font-mono">-{c.discount ?? "0"} {currency}</span></div>
                      ))}
                      {shippingLines.map((s, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground"><span>{s.method_title || "Shipping"}</span><span className="font-mono">{s.total ?? "0"} {currency}</span></div>
                      ))}
                      {order.total_tax != null && Number(order.total_tax) > 0 && (
                        <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="font-mono">{order.total_tax} {currency}</span></div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border font-semibold text-base"><span>Total</span><span className="font-mono">{order.total ?? "—"} {currency}</span></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Actions</h3>
                    <div className="space-y-1.5">
                      {getCustomerEmail(order.billing) && (
                        <a href={`mailto:${getCustomerEmail(order.billing)}?subject=Order #${order.order_number || order.woo_id}`} className="flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border bg-background hover:bg-muted transition-colors">
                          <Mail className="h-3.5 w-3.5" /><span>Email invoice to customer</span><span className="ml-auto text-muted-foreground">→</span>
                        </a>
                      )}
                      {linkedCustomer?.id ? (
                        <Link href={`/sites/${storeId}/customers/${linkedCustomer.id}`} className="flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border bg-background hover:bg-muted transition-colors">
                          <User className="h-3.5 w-3.5" /><span>View customer profile</span><span className="ml-auto text-muted-foreground">→</span>
                        </Link>
                      ) : (
                        <button disabled title={custEmailForLookup ? "No matching customer profile found" : "No customer info on this order"} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border text-muted-foreground opacity-60 cursor-not-allowed">
                          <User className="h-3.5 w-3.5" /><span>View Customer</span><span className="ml-auto">→</span>
                        </button>
                      )}
                      <button disabled className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border text-muted-foreground opacity-60 cursor-not-allowed">
                        <Send className="h-3.5 w-3.5" /><span>Resend new order notification</span><span className="ml-auto">→</span>
                      </button>
                      {store?.url && (
                        <a href={`${store.url.replace(/\/$/, "")}/wp-admin/post.php?post=${order.woo_id}&action=edit`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border bg-background hover:bg-muted transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" /><span>Open in WP admin</span><span className="ml-auto text-muted-foreground">→</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Change Status</h3>
                    <div className="space-y-1.5">
                      {STATUS_OPTIONS.filter((s) => s !== order.status).map((s) => {
                        const style = STATUS_STYLES[s] || STATUS_STYLES.pending;
                        const isSaving = savingStatus === s;
                        return (
                          <button key={s} disabled={!!savingStatus} onClick={() => handleStatusChange(s)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs capitalize font-medium transition-all ring-1 hover:ring-2 disabled:opacity-50 disabled:cursor-not-allowed", style.bg, style.text, style.ring)}>
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />}
                            <span>{style.label}</span>
                            {isSaving && <Check className="h-3 w-3 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Order Notes</h3></div>
                    <div className="space-y-2 mb-3 max-h-[280px] overflow-y-auto">
                      {allNotes.length === 0 && <div className="text-xs text-muted-foreground italic">No notes yet</div>}
                      {allNotes.map((n, i) => (
                        <div key={i} className="rounded-md bg-muted/40 p-2.5 border border-border">
                          <div className="text-xs leading-relaxed whitespace-pre-wrap">{n.note}</div>
                          <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                            <span>{fmtDateTime(n.date_created)}</span>
                            {n.author && <span className="text-muted-foreground/60">· {n.author}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." className="text-xs resize-none min-h-[80px]" />
                    <Button size="sm" className="w-full mt-2" disabled={!noteText.trim()} onClick={handleAddNote}>Add note</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </SiteLayout>
    </AuthGuard>
  );
}