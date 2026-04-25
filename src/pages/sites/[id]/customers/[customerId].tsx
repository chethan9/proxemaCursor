import { useRouter } from "next/router";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { SitePageShell, useSiteFromRoute, CustomerDetailSkeleton } from "@/components/site/shared";
import { useCustomer, useCustomerAllOrders } from "@/hooks/queries/useCustomers";
import { getCustomerName, getCustomerInitials, getCustomerBilling, getCustomerShipping, getAOV, updateCustomer, deleteCustomer } from "@/services/customerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit3, Save, X, Loader2, Copy, Mail, Phone, Trash2, User, Package, ChevronDown, ChevronRight, ShoppingBag, CheckCircle2, XCircle, Wallet, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type LineItem = {
  name?: string;
  product_id?: number;
  variation_id?: number;
  quantity?: number;
  subtotal?: string;
  total?: string;
  price?: number | string;
  sku?: string;
  image?: { src?: string } | null;
  meta_data?: Array<{ key?: string; display_key?: string; value?: unknown; display_value?: unknown }>;
};

type CouponLine = { code?: string; discount?: string };
type ShippingLine = { method_title?: string; total?: string };

type OrderRow = {
  id: string;
  woo_id?: number | null;
  order_number?: string | null;
  status: string | null;
  total: string | number | null;
  currency?: string | null;
  date_created?: string | null;
  payment_method_title?: string | null;
  line_items?: LineItem[] | null;
  shipping_total?: string | number | null;
  discount_total?: string | number | null;
  total_tax?: string | number | null;
  shipping?: Record<string, string> | null;
  coupon_lines?: CouponLine[] | null;
  shipping_lines?: ShippingLine[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed", processing: "Processing", "on-hold": "On hold", pending: "Pending", cancelled: "Cancelled", refunded: "Refunded", failed: "Failed",
};

const STATUS_FILTERS = ["all", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"] as const;

function statusClasses(status: string): { pill: string; dot: string } {
  switch (status) {
    case "completed": return { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" };
    case "processing": return { pill: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" };
    case "on-hold": return { pill: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" };
    case "cancelled": case "failed": return { pill: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" };
    case "refunded": return { pill: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" };
    default: return { pill: "bg-slate-50 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  }
}

function fmtDate(d?: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; } }
function fmtDateTime(d?: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } }
function fmtMoney(n: number | string | null | undefined, currency = "KD") { const v = typeof n === "string" ? parseFloat(n) : (n || 0); if (isNaN(v as number)) return `0.00 ${currency}`; return `${(v as number).toFixed(2)} ${currency}`; }

function CustomerDetailsInner() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { id: siteId, store, loading: siteLoading } = useSiteFromRoute();
  const customerId = router.query.customerId as string | undefined;
  const { data: customer, isLoading } = useCustomer(customerId);
  const [tab, setTab] = useState<"details" | "orders">("details");
  const [editing, setEditing] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("edit") === "1";
  });
  const [ordersPage, setOrdersPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", username: "",
    billing: { first_name: "", last_name: "", company: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "", phone: "", email: "" } as Record<string, string>,
    shipping: { first_name: "", last_name: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "" } as Record<string, string>,
  });

  useEffect(() => {
    if (customer) {
      setForm({
        first_name: customer.first_name || "", last_name: customer.last_name || "",
        email: customer.email || "", username: customer.username || "",
        billing: { ...(customer.billing as Record<string, string> || {}) },
        shipping: { ...(customer.shipping as Record<string, string> || {}) },
      });
    }
  }, [customer]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.edit === "1") setEditing(true);
  }, [router.isReady, router.query.edit]);

  const { data: allOrdersData } = useCustomerAllOrders(siteId, customer?.woo_id, ordersPage, 25);
  const orders = (allOrdersData?.data || []) as OrderRow[];
  const ordersTotal = allOrdersData?.count || 0;

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const s of STATUS_FILTERS) if (s !== "all") c[s] = 0;
    orders.forEach((o) => { const s = o.status || "pending"; if (c[s] !== undefined) c[s]++; });
    return c;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => (o.status || "pending") === statusFilter);
  }, [orders, statusFilter]);

  const stats = useMemo(() => {
    if (!customer) return null;
    const completed = orders.filter((o) => o.status === "completed").length;
    const cancelled = orders.filter((o) => o.status === "cancelled" || o.status === "refunded" || o.status === "failed").length;
    const totals = orders.map((o) => Number(o.total || 0)).filter((n) => n > 0);
    const highest = totals.length ? Math.max(...totals) : 0;
    const lowest = totals.length ? Math.min(...totals) : 0;
    const paymentCounts = new Map<string, number>();
    orders.forEach((o) => { const p = o.payment_method_title || ""; if (p) paymentCounts.set(p, (paymentCounts.get(p) || 0) + 1); });
    const preferredPayment = Array.from(paymentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const lastOrder = orders[0];
    return { completed, cancelled, highest, lowest, preferredPayment, lastOrderDate: lastOrder?.date_created };
  }, [customer, orders]);

  const copy = (v?: string | null) => { if (!v) return; navigator.clipboard?.writeText(v); toast({ title: "Copied" }); };

  const save = useSiteMutation<unknown, void>({
    mutationFn: () => updateCustomer(customer!.id, { first_name: form.first_name, last_name: form.last_name, email: form.email, username: form.username, billing: form.billing, shipping: form.shipping }),
    invalidateKeys: customer ? [["customer", customer.id], ["customers", siteId]] : [],
    siteName: store?.name,
    successToast: "Customer updated",
    onSuccessExtra: () => setEditing(false),
  });

  const remove = useSiteMutation<unknown, void>({
    mutationFn: () => deleteCustomer(siteId, customer!.id),
    invalidateKeys: [["customers", siteId]],
    siteName: store?.name,
    successToast: "Customer deleted",
    onSuccessExtra: () => router.push(`/sites/${siteId}/customers`),
  });

  const handleSave = () => { if (!customer) return; save.mutate(); };
  const handleDelete = () => setDeleteOpen(true);
  const confirmDelete = () => {
    if (!customer) return;
    setDeleteOpen(false);
    remove.mutate();
  };

  const saving = save.isPending;
  const deleting = remove.isPending;

  if (siteLoading || isLoading) return <CustomerDetailSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  if (!customer) return <div className="p-6">Customer not found</div>;

  const billing = getCustomerBilling(customer);
  const shipping = getCustomerShipping(customer);
  const aov = getAOV(customer);
  const totalOrders = customer.orders_count || 0;
  const totalSpent = Number(customer.total_spent || 0);
  const completedPct = totalOrders > 0 && stats ? Math.round((stats.completed / totalOrders) * 100) : 0;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {customer ? getCustomerName(customer) : "customer"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the customer from WooCommerce and your panel. This action can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href={`/sites/${siteId}/customers`} className="mt-1 h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-semibold">#{customer.woo_id || customer.id.slice(0, 6)}</h1>
            <div className="text-xs text-primary mt-0.5">Customers / Customer Details</div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <ActivityHistoryDrawer entityType="customer" entityId={customer.id} />
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="text-destructive hover:text-destructive">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />} Delete
              </Button>
              <Button size="sm" onClick={() => setEditing(true)}><Edit3 className="h-3.5 w-3.5 mr-1.5" /> Edit Customer</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}><X className="h-3.5 w-3.5 mr-1.5" /> Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />} Save</Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold">{getCustomerInitials(customer)}</div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</div>
              <div className="font-semibold text-base">{getCustomerName(customer)}</div>
              {customer.username && <div className="text-xs text-muted-foreground">@{customer.username}</div>}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Contact</div>
            {billing.phone && <div className="flex items-center gap-1.5 text-sm"><Phone className="h-3 w-3 text-muted-foreground" /><span>{billing.phone}</span><button onClick={() => copy(billing.phone)} className="ml-1 text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button></div>}
            {customer.email && <div className="flex items-center gap-1.5 text-sm mt-1"><Mail className="h-3 w-3 text-muted-foreground" /><span className="truncate">{customer.email}</span><button onClick={() => copy(customer.email)} className="ml-1 text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button></div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Orders</div>
            <div className="font-semibold text-base">{totalOrders} Orders</div>
            <div className="text-xs text-muted-foreground">Last ordered on {fmtDate(stats?.lastOrderDate)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Spent</div>
            <div className="font-semibold text-base">{fmtMoney(totalSpent)}</div>
            <div className="text-xs text-muted-foreground">Average order value {fmtMoney(aov)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div className="border-b border-border flex">
          <button onClick={() => setTab("details")} className={`px-5 py-2.5 text-sm font-medium border-b-2 ${tab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Basic Details</button>
          <button onClick={() => setTab("orders")} className={`px-5 py-2.5 text-sm font-medium border-b-2 ${tab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Orders ({ordersTotal})</button>
        </div>

        {tab === "details" ? (
          <div className="p-5 space-y-5">
            {editing && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-5 border-b border-border">
                <div><Label className="text-xs">First Name</Label><Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Last Name</Label><Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Username</Label><Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} className="h-8 text-sm" disabled /></div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
              <Field label="Account Status" value={<span className="text-emerald-600 font-medium">Active</span>} />
              <Field label="Customer Type" value={customer.role === "customer" ? "Registered User" : customer.role || "Guest"} />
              <Field label="Customer Since" value={fmtDate(customer.date_created)} />
              <Field label="Last Active" value={fmtDateTime(customer.synced_at)} />
              <Field label="Last Order Date" value={fmtDate(stats?.lastOrderDate)} />
              <Field label="Preferred Payment" value={stats?.preferredPayment || "—"} />
              <Field label="Preferred Delivery" value="Standard Delivery" />
              <Field label="Delivery Issues" value="None" />
              <Field label="Total Orders" value={`${totalOrders} Orders`} />
              <Field label="Completed Orders" value={String(stats?.completed || 0)} />
              <Field label="Cancelled Orders" value={String(stats?.cancelled || 0)} />
              <Field label="Average Order Value" value={fmtMoney(aov)} />
              <Field label="Total Spent" value={fmtMoney(totalSpent)} />
              <Field label="Highest Order" value={fmtMoney(stats?.highest || 0)} />
              <Field label="Lowest Order" value={fmtMoney(stats?.lowest || 0)} />
              <Field label="Paying Customer" value={customer.is_paying_customer ? "Yes" : "No"} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border">
              <AddressBlock title="Billing Address" editing={editing} data={editing ? form.billing : billing} onChange={(k, v) => setForm((p) => ({ ...p, billing: { ...p.billing, [k]: v } }))} withContact />
              <AddressBlock title="Shipping Address" editing={editing} data={editing ? form.shipping : shipping} onChange={(k, v) => setForm((p) => ({ ...p, shipping: { ...p.shipping, [k]: v } }))} />
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <StatTile tone="slate" icon={<ShoppingBag className="h-3.5 w-3.5" />} label="Total orders" value={String(totalOrders)} />
              <StatTile tone="emerald" icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Completed" value={String(stats?.completed || 0)} sub={`${completedPct}% of loaded`} />
              <StatTile tone="rose" icon={<XCircle className="h-3.5 w-3.5" />} label="Cancelled" value={String(stats?.cancelled || 0)} />
              <StatTile tone="blue" icon={<Wallet className="h-3.5 w-3.5" />} label="Total spent" value={fmtMoney(totalSpent)} />
              <StatTile tone="violet" icon={<TrendingUp className="h-3.5 w-3.5" />} label="Avg order" value={fmtMoney(aov)} />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((s) => {
                const label = s === "all" ? "All" : (STATUS_LABELS[s] || s);
                const n = statusCounts[s] ?? 0;
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${active ? "bg-foreground text-background" : "bg-muted/60 text-foreground/70 hover:bg-muted"}`}
                  >
                    <span>{label}</span>
                    <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded text-[10px] font-semibold ${active ? "bg-background/20" : "bg-background/60 text-foreground/70"}`}>{n}</span>
                  </button>
                );
              })}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center"><Package className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-medium text-foreground">No orders yet</div>
                  <div className="text-xs mt-0.5">{statusFilter === "all" ? "This customer hasn't placed any orders." : `No ${STATUS_LABELS[statusFilter] || statusFilter} orders.`}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    siteId={siteId}
                    expanded={expandedOrderId === o.id}
                    onToggle={() => setExpandedOrderId((cur) => (cur === o.id ? null : o.id))}
                  />
                ))}
              </div>
            )}

            {ordersTotal > 25 && (
              <div className="flex justify-between items-center pt-3 text-xs text-muted-foreground border-t border-border">
                <div>Page {ordersPage + 1} of {Math.ceil(ordersTotal / 25)} · Showing {orders.length} of {ordersTotal}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={ordersPage === 0} onClick={() => setOrdersPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={(ordersPage + 1) * 25 >= ordersTotal} onClick={() => setOrdersPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, sub, tone = "slate" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "slate" | "emerald" | "rose" | "blue" | "violet" }) {
  const tones: Record<string, { bg: string; ring: string; badge: string; text: string; bar: string }> = {
    slate:   { bg: "from-slate-50/70",   ring: "ring-slate-200/60",   badge: "bg-slate-100 text-slate-700",     text: "text-slate-900",   bar: "bg-slate-400" },
    emerald: { bg: "from-emerald-50/70", ring: "ring-emerald-200/60", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-700", bar: "bg-emerald-500" },
    rose:    { bg: "from-rose-50/70",    ring: "ring-rose-200/60",    badge: "bg-rose-100 text-rose-700",       text: "text-rose-700",    bar: "bg-rose-500" },
    blue:    { bg: "from-blue-50/70",    ring: "ring-blue-200/60",    badge: "bg-blue-100 text-blue-700",       text: "text-blue-700",    bar: "bg-blue-500" },
    violet:  { bg: "from-violet-50/70",  ring: "ring-violet-200/60",  badge: "bg-violet-100 text-violet-700",   text: "text-violet-700",  bar: "bg-violet-500" },
  };
  const t = tones[tone];
  return (
    <div className={`relative rounded-lg border border-border bg-gradient-to-br ${t.bg} to-white px-3 py-2.5 overflow-hidden`}>
      <div className={`absolute top-0 left-0 h-0.5 w-8 ${t.bar} rounded-r`} />
      <div className="flex items-center justify-between">
        <div className={`h-6 w-6 rounded-md ${t.badge} flex items-center justify-center`}>{icon}</div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      </div>
      <div className={`text-lg font-bold ${t.text} font-mono tracking-tight mt-1.5 leading-none`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function OrderCard({ order, siteId, expanded, onToggle }: { order: OrderRow; siteId: string; expanded: boolean; onToggle: () => void }) {
  const status = order.status || "pending";
  const sc = statusClasses(status);
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  const itemCount = items.reduce((s, li) => s + (Number(li.quantity) || 0), 0);
  const currency = order.currency || "KD";
  const subtotal = items.reduce((s, li) => s + Number(li.subtotal || 0), 0);
  const shipMethod = Array.isArray(order.shipping_lines) && order.shipping_lines[0]?.method_title;
  const shipTo = order.shipping ? [order.shipping.city, order.shipping.country].filter(Boolean).join(", ") : "";
  const coupon = Array.isArray(order.coupon_lines) && order.coupon_lines[0]?.code;

  return (
    <div className={`rounded-lg border border-border bg-white overflow-hidden ${expanded ? "ring-1 ring-primary/20" : "hover:border-primary/30"} transition-colors`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={onToggle}>
        <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium capitalize ring-1 ring-inset ${sc.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
          {STATUS_LABELS[status] || status}
        </span>
        <Link
          href={`/sites/${siteId}/orders/${order.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          #{order.order_number || order.woo_id}
        </Link>
        <div className="text-xs text-muted-foreground">{fmtDate(order.date_created)}</div>
        <div className="hidden md:block text-xs text-muted-foreground truncate max-w-[200px]">{order.payment_method_title || "—"}</div>
        {items.length > 0 && (
          <div className="flex items-center -space-x-1 ml-auto md:ml-0">
            {items.slice(0, 4).map((li, i) => (
              <div key={i} className="relative h-7 w-7 rounded-md bg-muted ring-2 ring-background overflow-hidden flex-shrink-0">
                {li.image?.src ? (
                  <img src={li.image.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Package className="h-3 w-3" /></div>
                )}
              </div>
            ))}
            {items.length > 4 && (
              <div className="h-7 min-w-7 px-1.5 rounded-md bg-muted ring-2 ring-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                +{items.length - 4}
              </div>
            )}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground hidden lg:block whitespace-nowrap">{itemCount} item{itemCount === 1 ? "" : "s"}</div>
        <div className="text-sm font-semibold ml-auto font-mono whitespace-nowrap">{fmtMoney(order.total, currency)}</div>
        <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Toggle">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {(shipTo || shipMethod || coupon) && !expanded && (
        <div className="px-3 pb-2.5 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {shipTo && <span>Ship to: <span className="text-foreground/70">{shipTo}</span></span>}
          {shipMethod && <span>• {shipMethod}</span>}
          {coupon && <span>• Coupon: <span className="font-mono text-foreground/70 uppercase">{coupon}</span></span>}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-4">
          <div className="space-y-1.5">
            {items.map((li, i) => {
              const qty = Number(li.quantity) || 0;
              const price = Number(li.price || 0);
              const lineTotal = Number(li.total || 0);
              const variation = Array.isArray(li.meta_data) ? li.meta_data.filter((m) => m?.display_key && !(m.display_key as string).startsWith("_")).map((m) => `${m.display_key}: ${m.display_value}`).join(" · ") : "";
              return (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-md bg-background">
                  <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                    {li.image?.src ? <img src={li.image.src} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Package className="h-4 w-4" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{li.name || "—"}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {li.sku && <span className="font-mono">SKU: {li.sku}</span>}
                      {variation && <span className="truncate">{variation}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{qty} × {fmtMoney(price, currency)}</div>
                  </div>
                  <div className="text-sm font-mono font-semibold whitespace-nowrap">{fmtMoney(lineTotal, currency)}</div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-border">
            <TotalLine label="Subtotal" value={fmtMoney(subtotal, currency)} />
            <TotalLine label="Discount" value={`−${fmtMoney(order.discount_total, currency)}`} muted={!Number(order.discount_total)} />
            <TotalLine label="Shipping" value={fmtMoney(order.shipping_total, currency)} muted={!Number(order.shipping_total)} />
            <TotalLine label="Tax" value={fmtMoney(order.total_tax, currency)} muted={!Number(order.total_tax)} />
            <TotalLine label="Total" value={fmtMoney(order.total, currency)} strong />
          </div>
          {(shipTo || shipMethod || coupon) && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-2 border-t border-border">
              {shipTo && <span>Ship to: <span className="text-foreground/70">{shipTo}</span></span>}
              {shipMethod && <span>• {shipMethod}</span>}
              {coupon && <span>• Coupon: <span className="font-mono text-foreground/70 uppercase">{coupon}</span></span>}
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/sites/${siteId}/orders/${order.id}`}>Open order details →</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TotalLine({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`${strong ? "text-sm font-bold" : "text-sm"} ${muted ? "text-muted-foreground" : ""} font-mono mt-0.5`}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function AddressBlock({ title, editing, data, onChange, withContact }: { title: string; editing: boolean; data: Record<string, string>; onChange: (k: string, v: string) => void; withContact?: boolean }) {
  const fields: Array<{ k: string; l: string; cols?: number }> = [
    { k: "first_name", l: "First name", cols: 1 }, { k: "last_name", l: "Last name", cols: 1 },
    { k: "address_1", l: "Address 1", cols: 2 }, { k: "address_2", l: "Address 2", cols: 2 },
    { k: "city", l: "City", cols: 1 }, { k: "state", l: "State / Region", cols: 1 },
    { k: "postcode", l: "Postcode", cols: 1 }, { k: "country", l: "Country", cols: 1 },
  ];
  if (withContact) fields.push({ k: "phone", l: "Phone", cols: 1 }, { k: "email", l: "Email", cols: 1 });
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-2">{title}</div>
      {editing ? (
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <div key={f.k} className={f.cols === 2 ? "col-span-2" : ""}>
              <Label className="text-[10px] text-muted-foreground">{f.l}</Label>
              <Input value={data[f.k] || ""} onChange={(e) => onChange(f.k, e.target.value)} className="h-8 text-xs" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm space-y-0.5">
          {(data.first_name || data.last_name) && <div className="font-medium">{[data.first_name, data.last_name].filter(Boolean).join(" ")}</div>}
          {data.address_1 && <div>{data.address_1}</div>}
          {data.address_2 && <div>{data.address_2}</div>}
          {(data.city || data.state || data.postcode) && <div>{[data.city, data.state, data.postcode].filter(Boolean).join(", ")}</div>}
          {data.country && <div className="uppercase">{data.country}</div>}
          {withContact && data.phone && <div className="text-xs text-muted-foreground mt-1">{data.phone}</div>}
          {withContact && data.email && <div className="text-xs text-muted-foreground">{data.email}</div>}
          {!data.address_1 && !data.city && <div className="text-muted-foreground italic">No {title.toLowerCase()} on file.</div>}
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailsPage() {
  return <SitePageShell><CustomerDetailsInner /></SitePageShell>;
}