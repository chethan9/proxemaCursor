import { useRouter } from "next/router";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { useCustomer, useCustomerAllOrders } from "@/hooks/queries/useCustomers";
import { getCustomerName, getCustomerInitials, getCustomerBilling, getCustomerShipping, getAOV, updateCustomer, deleteCustomer } from "@/services/customerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit3, Save, X, Loader2, Copy, Mail, Phone, Trash2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}
function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function fmtMoney(n: number | string | null | undefined, currency = "KD") {
  const v = typeof n === "string" ? parseFloat(n) : (n || 0);
  if (isNaN(v)) return `0 ${currency}`;
  return `${v.toFixed(2)} ${currency}`;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  processing: "bg-blue-50 text-blue-700 ring-blue-200",
  "on-hold": "bg-amber-50 text-amber-700 ring-amber-200",
  pending: "bg-slate-50 text-slate-600 ring-slate-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  refunded: "bg-violet-50 text-violet-700 ring-violet-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

function CustomerDetailsInner() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { id: siteId, store, loading: siteLoading } = useSiteFromRoute();
  const customerId = router.query.customerId as string | undefined;
  const { data: customer, isLoading } = useCustomer(customerId);
  const [tab, setTab] = useState<"details" | "orders">("details");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ordersPage, setOrdersPage] = useState(0);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", username: "",
    billing: { first_name: "", last_name: "", company: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "", phone: "", email: "" } as Record<string, string>,
    shipping: { first_name: "", last_name: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "" } as Record<string, string>,
  });

  useEffect(() => {
    if (customer) {
      setForm({
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        email: customer.email || "",
        username: customer.username || "",
        billing: { ...(customer.billing as Record<string, string> || {}) },
        shipping: { ...(customer.shipping as Record<string, string> || {}) },
      });
    }
  }, [customer]);

  const { data: allOrdersData } = useCustomerAllOrders(siteId, customer?.woo_id, ordersPage, 25);
  const orders = allOrdersData?.data || [];
  const ordersTotal = allOrdersData?.count || 0;

  const stats = useMemo(() => {
    if (!customer) return null;
    const completed = orders.filter(o => o.status === "completed").length;
    const cancelled = orders.filter(o => o.status === "cancelled" || o.status === "refunded" || o.status === "failed").length;
    const totals = orders.map(o => Number(o.total || 0)).filter(n => n > 0);
    const highest = totals.length ? Math.max(...totals) : 0;
    const lowest = totals.length ? Math.min(...totals) : 0;
    const paymentCounts = new Map<string, number>();
    orders.forEach(o => { const p = o.payment_method_title || ""; if (p) paymentCounts.set(p, (paymentCounts.get(p) || 0) + 1); });
    const preferredPayment = Array.from(paymentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const lastOrder = orders[0];
    return { completed, cancelled, highest, lowest, preferredPayment, lastOrderDate: lastOrder?.date_created };
  }, [customer, orders]);

  const copy = (v?: string | null) => {
    if (!v) return;
    navigator.clipboard?.writeText(v);
    toast({ title: "Copied" });
  };

  const handleSave = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await updateCustomer(customer.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        username: form.username,
        billing: form.billing,
        shipping: form.shipping,
      });
      toast({ title: "Customer updated" });
      await qc.invalidateQueries({ queryKey: ["customer", customer.id] });
      await qc.invalidateQueries({ queryKey: ["customers", siteId] });
      setEditing(false);
    } catch (e) {
      const err = e as { message?: string };
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    if (!confirm(`Delete ${getCustomerName(customer)}? This will remove them from WooCommerce.`)) return;
    setDeleting(true);
    try {
      await deleteCustomer(siteId, customer.id);
      toast({ title: "Customer deleted" });
      await qc.invalidateQueries({ queryKey: ["customers", siteId] });
      router.push(`/sites/${siteId}/customers`);
    } catch (e) {
      const err = e as { message?: string };
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setDeleting(false);
    }
  };

  if (siteLoading || isLoading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  if (!customer) return <div className="p-6">Customer not found</div>;

  const billing = getCustomerBilling(customer);
  const shipping = getCustomerShipping(customer);
  const aov = getAOV(customer);

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
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

      <div className="rounded-lg border border-border bg-background p-5">
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
            <div className="font-semibold text-base">{customer.orders_count || 0} Orders</div>
            <div className="text-xs text-muted-foreground">Last ordered on {fmtDate(stats?.lastOrderDate)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Spent</div>
            <div className="font-semibold text-base">{fmtMoney(customer.total_spent)}</div>
            <div className="text-xs text-muted-foreground">Average order value {fmtMoney(aov)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <div className="border-b border-border flex">
          <button onClick={() => setTab("details")} className={`px-5 py-2.5 text-sm font-medium border-b-2 ${tab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Basic Details</button>
          <button onClick={() => setTab("orders")} className={`px-5 py-2.5 text-sm font-medium border-b-2 ${tab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Orders ({ordersTotal})</button>
        </div>

        {tab === "details" ? (
          <div className="p-5 space-y-5">
            {editing && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-5 border-b border-border">
                <div><Label className="text-xs">First Name</Label><Input value={form.first_name} onChange={(e) => setForm(p => ({ ...p, first_name: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Last Name</Label><Input value={form.last_name} onChange={(e) => setForm(p => ({ ...p, last_name: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Username</Label><Input value={form.username} onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} className="h-8 text-sm" disabled /></div>
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
              <Field label="Total Orders" value={`${customer.orders_count || 0} Orders`} />
              <Field label="Completed Orders" value={String(stats?.completed || 0)} />
              <Field label="Cancelled Orders" value={String(stats?.cancelled || 0)} />
              <Field label="Average Order Value" value={fmtMoney(aov)} />
              <Field label="Total Spent" value={fmtMoney(customer.total_spent)} />
              <Field label="Highest Order" value={fmtMoney(stats?.highest || 0)} />
              <Field label="Lowest Order" value={fmtMoney(stats?.lowest || 0)} />
              <Field label="Paying Customer" value={customer.is_paying_customer ? "Yes" : "No"} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border">
              <AddressBlock title="Billing Address" editing={editing} data={editing ? form.billing : billing} onChange={(k, v) => setForm(p => ({ ...p, billing: { ...p.billing, [k]: v } }))} withContact />
              <AddressBlock title="Shipping Address" editing={editing} data={editing ? form.shipping : shipping} onChange={(k, v) => setForm(p => ({ ...p, shipping: { ...p.shipping, [k]: v } }))} />
            </div>
          </div>
        ) : (
          <div className="p-5">
            {orders.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground flex flex-col items-center gap-2"><User className="h-8 w-8 opacity-30" /> No orders yet.</div>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => {
                  const status = STATUS_COLORS[o.status || ""] || STATUS_COLORS.pending;
                  return (
                    <Link key={o.id} href={`/sites/${siteId}/orders/${o.id}`} className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-primary/50 transition-colors">
                      <span className={`inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium capitalize ring-1 ring-inset ${status} w-24 justify-center`}>{o.status}</span>
                      <div className="font-mono text-xs text-muted-foreground w-20">#{o.order_number || o.woo_id}</div>
                      <div className="text-xs flex-1">{fmtDate(o.date_created)}</div>
                      <div className="text-xs text-muted-foreground hidden md:block">{o.payment_method_title || "—"}</div>
                      <div className="text-sm font-medium w-24 text-right">{fmtMoney(o.total, o.currency || "KD")}</div>
                    </Link>
                  );
                })}
                {ordersTotal > 25 && (
                  <div className="flex justify-between items-center pt-3 text-xs text-muted-foreground">
                    <div>Page {ordersPage + 1} of {Math.ceil(ordersTotal / 25)}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={ordersPage === 0} onClick={() => setOrdersPage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={(ordersPage + 1) * 25 >= ordersTotal} onClick={() => setOrdersPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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
          {fields.map(f => (
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