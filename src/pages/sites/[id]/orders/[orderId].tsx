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
  MapPin,
  Package,
  Truck,
  Check,
  Loader2,
  ExternalLink,
  Tag,
  FileText,
  ImageIcon,
  CheckCircle2,
  Circle,
  XCircle,
  Ban,
  RotateCcw,
  Hourglass,
  PauseCircle,
  AlertCircle,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStore } from "@/services/storeService";
import { updateOrderStatus, getCustomerName, getCustomerEmail, type OrderRow } from "@/services/orderService";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { authorizedFetch } from "@/lib/api-client";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";
import { Checkbox } from "@/components/ui/checkbox";
import { TemplatePrintMenu } from "@/components/templates/TemplatePrintMenu";
import { useBlockingEffect } from "@/contexts/LoadingProvider";
import { useTranslation } from "next-i18next";
import { formatDateTime } from "@/lib/format-number";
import { listTemplates } from "@/services/templateService";
import { resolveDefaultTemplateForPrint } from "@/lib/template-resolve-default";
import { buildOrderTemplatePdfUrl } from "@/lib/templates/order-template-pdf-url";
import { useAuth } from "@/contexts/AuthProvider";

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; ring: string; label: string; Icon: LucideIcon }> = {
  processing: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", ring: "ring-blue-200 dark:ring-blue-900", label: "Processing", Icon: CircleDashed },
  "on-hold": { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-900", label: "On Hold", Icon: PauseCircle },
  completed: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-900", label: "Completed", Icon: CheckCircle2 },
  cancelled: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500", ring: "ring-rose-200 dark:ring-rose-900", label: "Cancelled", Icon: XCircle },
  refunded: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500", ring: "ring-violet-200 dark:ring-violet-900", label: "Refunded", Icon: RotateCcw },
  failed: { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500", ring: "ring-slate-200 dark:ring-slate-700", label: "Failed", Icon: AlertCircle },
  pending: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-900", label: "Pending", Icon: Hourglass },
};

const STATUS_OPTIONS = ["processing", "on-hold", "completed", "cancelled", "refunded", "failed"];

function fmtDateTime(s?: string | null, locale?: string) {
  if (!s) return "—";
  return formatDateTime(s, locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Stepper({ order, datePaid, dateCompleted }: { order: OrderRow; datePaid?: string; dateCompleted?: string }) {
  const { t, i18n } = useTranslation("site");
  const status = order.status || "pending";
  const placed = { label: t("orderDetail.stepper.orderPlaced"), date: order.date_created, done: true };
  const processing = { label: t("orderDetail.stepper.processing"), date: datePaid || order.date_modified, done: ["processing", "on-hold", "completed"].includes(status) };
  const completed = { label: t("orderDetail.stepper.completed"), date: dateCompleted, done: status === "completed" };

  const branchIcon = status === "cancelled" ? Ban : status === "refunded" ? RotateCcw : status === "failed" ? XCircle : null;
  const statusKeyMap: Record<string, string> = { cancelled: "cancelled", refunded: "refunded", failed: "failed" };
  const branchLabel = statusKeyMap[status] ? t(`orderDetail.statuses.${statusKeyMap[status]}`) : null;
  const steps = [placed, processing, completed];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t("orderDetail.stepper.title")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {steps.map((step, i) => {
            const Icon = step.done ? CheckCircle2 : Circle;
            return (
              <div key={i} className={cn("flex items-center gap-3 p-3 rounded-lg border", step.done ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900" : "bg-muted/30 border-border")}>
                <Icon className={cn("h-5 w-5 shrink-0", step.done ? "text-emerald-600" : "text-muted-foreground/40")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{step.done ? fmtDateTime(step.date, i18n.language) : t("orderDetail.stepper.notYet")}</div>
                </div>
              </div>
            );
          })}
        </div>
        {branchIcon && branchLabel && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20">
            {(() => { const I = branchIcon; return <I className="h-5 w-5 text-rose-600 shrink-0" />; })()}
            <div className="text-sm font-medium text-rose-700 dark:text-rose-300">{branchLabel}</div>
            <div className="text-[11px] text-muted-foreground ml-auto">{fmtDateTime(order.date_modified, i18n.language)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? null;
  const storeId = typeof router.query.id === "string" ? router.query.id : "";
  const orderId = typeof router.query.orderId === "string" ? router.query.orderId : "";
  const fallbackReturn = `/sites/${storeId}/orders`;
  const rawReturnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : "";
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") ? rawReturnTo : fallbackReturn;
  const { t, i18n } = useTranslation("site");
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [noteIsCustomer, setNoteIsCustomer] = useState(false);

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

  type WooNote = { id: number; note: string; date_created: string; author: string; customer_note: boolean };
  const { data: wooNotes, isLoading: notesLoading, refetch: refetchNotes } = useQuery<WooNote[]>({
    queryKey: ["order-notes", storeId, orderId],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/orders/${orderId}/notes`);
      if (!res.ok) throw new Error("Failed to load notes");
      return res.json();
    },
    enabled: !!(storeId && orderId && order),
    staleTime: 30_000,
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
  const lineItems = Array.isArray(order?.line_items) ? (order!.line_items as Array<{ name?: string; sku?: string; quantity?: number; price?: number | string; subtotal?: string; total?: string; image?: { src?: string }; meta_data?: Array<{ key?: string; value?: string; display_key?: string; display_value?: string }> }>) : [];
  const computedSubtotal = lineItems.reduce((s, li) => {
    const sub = Number(li.subtotal || 0);
    return s + (sub > 0 ? sub : Number(li.total || 0));
  }, 0);
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
  const allNotes = wooNotes && wooNotes.length > 0
    ? wooNotes.map((n) => ({ note: n.note || "", date_created: n.date_created, author: n.author, customer_note: n.customer_note }))
    : persistedNotes.map((n) => ({ note: n.note || "", date_created: n.date_created || "", author: n.author, customer_note: false }));
  const statusStyle = order ? STATUS_STYLES[order.status || "pending"] || STATUS_STYLES.pending : STATUS_STYLES.pending;

  const STATUS_LABEL_KEYS: Record<string, string> = {
    processing: "processing",
    "on-hold": "onHold",
    completed: "completed",
    cancelled: "cancelled",
    refunded: "refunded",
    failed: "failed",
    pending: "pending",
  };
  const statusLabel = (s: string) => t(`orderDetail.statuses.${STATUS_LABEL_KEYS[s] || "pending"}`);

  const { data: invoiceTemplates = [] } = useQuery({
    queryKey: ["templates", "invoice"],
    queryFn: () => listTemplates("invoice"),
    staleTime: 60_000,
    enabled: !!orderId,
  });
  const defaultInvoiceTemplate = useMemo(
    () => resolveDefaultTemplateForPrint(invoiceTemplates, "invoice", clientId),
    [invoiceTemplates, clientId],
  );

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
    successToast: (_d, newStatus) => t("orderDetail.toast.statusUpdated", { status: statusLabel(newStatus) }),
    onSuccessExtra: (updated) => queryClient.setQueryData(["order", orderId], updated),
  });

  const handleStatusChange = (newStatus: string) => {
    if (!order || newStatus === order.status) return;
    statusMutation.mutate(newStatus);
  };
  useBlockingEffect(statusMutation.isPending, "Updating order status…");

  const addNoteMutation = useSiteMutation<unknown, void>({
    mutationFn: async () => {
      const res = await authorizedFetch(`/api/stores/${storeId}/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim(), customer_note: noteIsCustomer }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to add note");
      }
      return res.json();
    },
    invalidateKeys: [["order-notes", storeId, orderId]],
    siteName: store?.name,
    successToast: () => (noteIsCustomer ? t("orderDetail.toast.noteSent") : t("orderDetail.toast.notePrivate")),
    onSuccessExtra: () => { setNoteText(""); setNoteIsCustomer(false); refetchNotes(); },
  });

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNoteMutation.mutate();
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

  const handleQuickInvoicePrint = async () => {
    if (!defaultInvoiceTemplate) {
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const url = buildOrderTemplatePdfUrl(defaultInvoiceTemplate.id, storeId, orderId, session?.access_token);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AuthGuard>
      <SiteLayout>
        <div className="px-6 py-5 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <Link href={returnTo}>
              <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">
                <Link href={returnTo} className="hover:text-foreground">{t("orderDetail.breadcrumb")}</Link> / {t("orderDetail.title")}
              </div>
              <h1 className="text-xl font-semibold leading-tight">
                {isLoading ? <Skeleton className="h-6 w-40" /> : t("orderDetail.orderNumber", { number: order?.order_number || order?.woo_id || "—" })}
              </h1>
            </div>
            {order && (
              <Badge className={cn("h-7 px-3 text-xs font-medium ring-1 border-0 capitalize gap-1.5", statusStyle.bg, statusStyle.text, statusStyle.ring)}>
                <statusStyle.Icon className="h-3.5 w-3.5" />
                {statusLabel(order.status || "pending")}
              </Badge>
            )}
            {order && <ActivityHistoryDrawer entityType="order" entityId={order.id} />}
          </div>

          {isLoading || !order ? (
            <OrderDetailSkeleton />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
              {/* Main column */}
              <div className="space-y-4 min-w-0">
                <Stepper order={order} datePaid={raw.date_paid} dateCompleted={raw.date_completed} />

                {/* 3-up info cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3"><User className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{t("orderDetail.customer.title")}</h3></div>
                      <dl className="text-sm space-y-1.5">
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.customer.name")}</dt>
                          <dd className="min-w-0 flex-1 text-left break-words">{getCustomerName(order.billing)}</dd>
                        </div>
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.customer.email")}</dt>
                          <dd className="min-w-0 flex-1 text-left break-all sm:break-words">{getCustomerEmail(order.billing) || "—"}</dd>
                        </div>
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.customer.phone")}</dt>
                          <dd className="min-w-0 flex-1 text-left break-words">{billing.phone || "—"}</dd>
                        </div>
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.customer.ip")}</dt>
                          <dd className="min-w-0 flex-1 text-left font-mono text-xs break-all">{raw.customer_ip_address || "—"}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3"><MapPin className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{t("orderDetail.address.title")}</h3></div>
                      <div className="text-xs space-y-2.5">
                        <div>
                          <div className="text-muted-foreground mb-1">{t("orderDetail.address.shipping")}</div>
                          <div className="text-sm leading-relaxed">{formatAddress(shipping).map((l, i) => <div key={i}>{l}</div>)}</div>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <div className="text-muted-foreground mb-1">{t("orderDetail.address.billing")}</div>
                          <div className="text-sm leading-relaxed">{formatAddress(billing).map((l, i) => <div key={i}>{l}</div>)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3"><Package className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{t("orderDetail.details.title")}</h3></div>
                      <dl className="text-sm space-y-1.5">
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.details.placedOn")}</dt>
                          <dd className="min-w-0 flex-1 text-left break-words">{fmtDateTime(order.date_created, i18n.language)}</dd>
                        </div>
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.details.payment")}</dt>
                          <dd className="min-w-0 flex-1 text-left break-words">{order.payment_method_title || order.payment_method || "—"}</dd>
                        </div>
                        {raw.transaction_id && (
                          <div className="flex items-start gap-x-3 gap-y-0.5">
                            <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.details.txnId")}</dt>
                            <dd className="min-w-0 flex-1 text-left font-mono text-xs break-all">{raw.transaction_id}</dd>
                          </div>
                        )}
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.details.paidOn")}</dt>
                          <dd className="min-w-0 flex-1 text-left break-words">{fmtDateTime(raw.date_paid, i18n.language)}</dd>
                        </div>
                        <div className="flex items-start gap-x-3 gap-y-0.5">
                          <dt className="text-muted-foreground shrink-0 w-28">{t("orderDetail.details.updated")}</dt>
                          <dd className="min-w-0 flex-1 text-left break-words">{fmtDateTime(order.date_modified, i18n.language)}</dd>
                        </div>
                        {raw.customer_note && <div className="pt-1 border-t border-border"><dt className="text-muted-foreground text-xs mb-0.5">{t("orderDetail.details.customerNote")}</dt><dd className="text-xs">{raw.customer_note}</dd></div>}
                      </dl>
                    </CardContent>
                  </Card>
                </div>

                {/* Items */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3"><Package className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{t("orderDetail.items.title")} <span className="ml-1 text-xs text-muted-foreground font-normal">({lineItems.length})</span></h3></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                            <th className="text-left py-2 pr-2">{t("orderDetail.items.item")}</th>
                            <th className="text-left py-2 px-2">{t("orderDetail.items.sku")}</th>
                            <th className="text-left py-2 px-2">{t("orderDetail.items.variation")}</th>
                            <th className="text-right py-2 px-2">{t("orderDetail.items.qty")}</th>
                            <th className="text-right py-2 px-2">{t("orderDetail.items.price")}</th>
                            <th className="text-right py-2 pl-2">{t("orderDetail.items.total")}</th>
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
                          {lineItems.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">{t("orderDetail.items.noItems")}</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="mt-4 space-y-1.5 text-sm max-w-sm ml-auto">
                      <div className="flex justify-between text-muted-foreground"><span>{t("orderDetail.totals.subtotal")}</span><span className="font-mono">{computedSubtotal.toFixed(2)} {currency}</span></div>
                      {coupons.map((c, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground"><span className="flex items-center gap-1.5"><Tag className="h-3 w-3" />{t("orderDetail.totals.coupon")} <Badge variant="outline" className="h-5 font-mono text-[10px]">{c.code}</Badge></span><span className="font-mono">-{c.discount ?? "0"} {currency}</span></div>
                      ))}
                      {shippingLines.map((s, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground"><span>{s.method_title || t("orderDetail.totals.shipping")}</span><span className="font-mono">{s.total ?? "0"} {currency}</span></div>
                      ))}
                      {order.total_tax != null && Number(order.total_tax) > 0 && (
                        <div className="flex justify-between text-muted-foreground"><span>{t("orderDetail.totals.tax")}</span><span className="font-mono">{order.total_tax} {currency}</span></div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border font-semibold text-base"><span>{t("orderDetail.totals.total")}</span><span className="font-mono">{order.total ?? "—"} {currency}</span></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">{t("orderDetail.actions.title")}</h3>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { void handleQuickInvoicePrint(); }}
                        className="w-full"
                        disabled={!defaultInvoiceTemplate}
                        title={defaultInvoiceTemplate ? "Print invoice" : "No invoice template"}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Print invoice
                      </Button>
                      <TemplatePrintMenu storeId={storeId} orderId={orderId} type="pickslip" className="w-full" />
                    </div>
                    <div className="space-y-1.5">
                      {linkedCustomer?.id ? (
                        <Link href={`/sites/${storeId}/customers/${linkedCustomer.id}`} className="flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border bg-background hover:bg-muted transition-colors">
                          <User className="h-3.5 w-3.5" /><span>{t("orderDetail.actions.viewCustomer")}</span><span className="ml-auto text-muted-foreground">→</span>
                        </Link>
                      ) : (
                        <button disabled title={custEmailForLookup ? t("orderDetail.actions.noMatchingCustomer") : t("orderDetail.actions.noCustomerInfo")} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border text-muted-foreground opacity-60 cursor-not-allowed">
                          <User className="h-3.5 w-3.5" /><span>{t("orderDetail.actions.viewCustomerShort")}</span><span className="ml-auto">→</span>
                        </button>
                      )}
                      {store?.url && (
                        <a href={`${store.url.replace(/\/$/, "")}/wp-admin/admin.php?page=wc-orders&action=edit&id=${order.woo_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-border bg-background hover:bg-muted transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" /><span>{t("orderDetail.actions.openInWp")}</span><span className="ml-auto text-muted-foreground">→</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">{t("orderDetail.changeStatus")}</h3>
                    <div className="space-y-1.5">
                      {STATUS_OPTIONS.filter((s) => s !== order.status).map((s) => {
                        const style = STATUS_STYLES[s] || STATUS_STYLES.pending;
                        const isSaving = statusMutation.isPending && statusMutation.variables === s;
                        const Icon = style.Icon;
                        return (
                          <button key={s} disabled={statusMutation.isPending} onClick={() => handleStatusChange(s)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs capitalize font-medium transition-all ring-1 hover:ring-2 disabled:opacity-50 disabled:cursor-not-allowed", style.bg, style.text, style.ring)}>
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                            <span>{statusLabel(s)}</span>
                            {isSaving && <Check className="h-3 w-3 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{t("orderDetail.notes.title")} {wooNotes ? <span className="text-xs text-muted-foreground font-normal">({wooNotes.length})</span> : null}</h3></div>
                    <div className="space-y-2 mb-3 max-h-[280px] overflow-y-auto">
                      {notesLoading && <div className="text-xs text-muted-foreground">{t("orderDetail.notes.loading")}</div>}
                      {!notesLoading && allNotes.length === 0 && <div className="text-xs text-muted-foreground italic">{t("orderDetail.notes.empty")}</div>}
                      {allNotes.map((n, i) => (
                        <div key={i} className={cn("rounded-md p-2.5 border", n.customer_note ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900" : "bg-muted/40 border-border")}>
                          <div className="text-xs leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: n.note }} />
                          <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span>{fmtDateTime(n.date_created, i18n.language)}</span>
                            {n.author && <span className="text-muted-foreground/60">· {n.author}</span>}
                            {n.customer_note && <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">{t("orderDetail.notes.sentToCustomer")}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t("orderDetail.notes.placeholder")} className="text-xs resize-none min-h-[80px]" disabled={addNoteMutation.isPending} />
                    <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
                      <Checkbox checked={noteIsCustomer} onCheckedChange={(v) => setNoteIsCustomer(!!v)} disabled={addNoteMutation.isPending} />
                      <span>{t("orderDetail.notes.sendToCustomer")}</span>
                    </label>
                    <Button size="sm" className="w-full mt-2" disabled={!noteText.trim() || addNoteMutation.isPending} onClick={handleAddNote}>
                      {addNoteMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t("orderDetail.notes.saving")}</> : t("orderDetail.notes.addNote")}
                    </Button>
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

function OrderDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 animate-in fade-in duration-200">
      <div className="space-y-4 min-w-0">
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-44" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-2.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
          <div className="ml-auto max-w-sm space-y-1.5 pt-3">
            <div className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-20" /></div>
            <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>
            <div className="flex justify-between pt-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-24" /></div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}