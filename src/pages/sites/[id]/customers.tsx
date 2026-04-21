import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { useCustomers, useCustomerLastOrders } from "@/hooks/queries/useCustomers";
import { getCustomerName, getCustomerInitials, getCustomerBilling, getAOV, type CustomerRow, type CustomerSortField, type SortDirection, deleteCustomer } from "@/services/customerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronDown, ChevronUp, ArrowUpDown, Loader2, Mail, Edit3, Eye, Trash2, Filter as FilterIcon, X } from "lucide-react";
import { useRouter } from "next/router";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 50;
const SORT_FIELDS: { key: CustomerSortField; label: string }[] = [
  { key: "first_name", label: "Name" },
  { key: "date_created", label: "Date registered" },
  { key: "synced_at", label: "Last active" },
  { key: "orders_count", label: "Orders" },
  { key: "total_spent", label: "Total spend" },
  { key: "email", label: "Email" },
];

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}

function fmtMoney(amount: number | string | null | undefined, currency = "KD"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount || 0);
  if (isNaN(n)) return `0 ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

const STATUS_COLORS: Record<string, { wrap: string; dot: string }> = {
  completed: { wrap: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900", dot: "bg-emerald-500" },
  processing: { wrap: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900", dot: "bg-blue-500" },
  "on-hold": { wrap: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900", dot: "bg-amber-500" },
  pending: { wrap: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:ring-slate-700", dot: "bg-slate-400" },
  cancelled: { wrap: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900", dot: "bg-rose-500" },
  refunded: { wrap: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900", dot: "bg-violet-500" },
  failed: { wrap: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900", dot: "bg-red-500" },
};

function CustomerExpanded({ storeId, siteId, customer }: { storeId: string; siteId: string; customer: CustomerRow }) {
  const { data: orders = [], isLoading } = useCustomerLastOrders(storeId, customer.woo_id, true, 3);
  const billing = getCustomerBilling(customer);
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete customer ${getCustomerName(customer)}? This will also delete them on WooCommerce.`)) return;
    setDeleting(true);
    try {
      await deleteCustomer(customer.id);
      toast({ title: "Customer deleted" });
      await qc.invalidateQueries({ queryKey: ["customers", storeId] });
    } catch (e) {
      const err = e as { message?: string };
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-muted/30 border-t border-border">
      <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Last Orders</div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No orders yet.</div>
          ) : (
            <div className="space-y-1.5">
              {orders.map((o) => {
                const s = STATUS_COLORS[o.status || ""] || STATUS_COLORS.pending;
                const items = Array.isArray(o.line_items) ? (o.line_items as Array<{ name?: string; image?: { src?: string }; quantity?: number }>) : [];
                return (
                  <Link key={o.id} href={`/sites/${siteId}/orders/${o.id}`} className="flex items-center gap-3 p-2.5 rounded-md bg-background border border-border hover:border-primary/50 transition-colors">
                    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] font-medium capitalize ring-1 ring-inset shrink-0 ${s.wrap}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {o.status || "—"}
                    </span>
                    <div className="text-xs font-mono text-muted-foreground w-20 shrink-0">#{o.order_number || o.woo_id}</div>
                    <div className="text-xs text-muted-foreground flex-1 truncate">
                      <div className="text-foreground">{fmtDate(o.date_created)}</div>
                      <div className="truncate">{o.payment_method_title || "—"}</div>
                    </div>
                    <div className="flex -space-x-1.5 shrink-0">
                      {items.slice(0, 3).map((it, idx) => (
                        <div key={idx} className="h-7 w-7 rounded-md border border-border bg-muted overflow-hidden relative">
                          {it.image?.src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.image.src} alt="" className="h-full w-full object-cover" />
                          ) : null}
                          {(it.quantity || 0) > 1 && (
                            <div className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-1 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">{it.quantity}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-semibold w-20 text-right shrink-0">{fmtMoney(o.total, o.currency || "KD")}</div>
                  </Link>
                );
              })}
            </div>
          )}
          {billing.address_1 && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">Billing: </span>
              {billing.address_1}{billing.address_2 ? `, ${billing.address_2}` : ""}{billing.city ? `, ${billing.city}` : ""}{billing.state ? `, ${billing.state}` : ""}{billing.postcode ? ` ${billing.postcode}` : ""}{billing.country ? `, ${billing.country}` : ""}
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actions</div>
          <div className="space-y-1">
            <button onClick={() => router.push(`/sites/${siteId}/customers/${customer.id}`)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <Edit3 className="h-3 w-3" /> <span className="font-medium">Edit customer</span> <span className="ml-auto">→</span>
            </button>
            <button onClick={() => router.push(`/sites/${siteId}/customers/${customer.id}`)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] border border-border bg-background hover:bg-muted transition-colors">
              <Eye className="h-3 w-3" /> <span>View details</span> <span className="ml-auto text-muted-foreground">→</span>
            </button>
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] border border-border bg-background hover:bg-muted transition-colors">
                <Mail className="h-3 w-3" /> <span>Send email</span> <span className="ml-auto text-muted-foreground">→</span>
              </a>
            )}
            <button onClick={handleDelete} disabled={deleting} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] border border-border bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50">
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              <span>Delete</span>
              <span className="ml-auto text-muted-foreground">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomersInner() {
  const { id: siteId, store, loading } = useSiteFromRoute();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<CustomerSortField>("date_created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [country, setCountry] = useState<string>("all");
  const [city, setCity] = useState("");
  const [minOrders, setMinOrders] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const router = useRouter();

  const opts = useMemo(() => ({
    storeId: siteId,
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    sortField,
    sortDirection,
    country: country !== "all" ? country : undefined,
    city: city.trim() || undefined,
    minOrders: minOrders ? Number(minOrders) : undefined,
  }), [siteId, page, search, sortField, sortDirection, country, city, minOrders]);

  const { data, isLoading, isFetching } = useCustomers(opts);
  const customers = data?.data || [];
  const total = data?.count || 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  const toggleSort = useCallback((f: CustomerSortField) => {
    if (sortField === f) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(f);
      setSortDirection(f === "first_name" || f === "email" ? "asc" : "desc");
    }
  }, [sortField]);

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const clearFilters = () => { setCountry("all"); setCity(""); setMinOrders(""); };
  const hasFilters = country !== "all" || city || minOrders;

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total.toLocaleString()} total · synced from WooCommerce</p>
        </div>
        <Button onClick={() => router.push(`/sites/${siteId}/customers/new`)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> New customer
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search name, email, username, phone, city…" className="pl-8 h-9" />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as CustomerSortField)}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORT_FIELDS.map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setSortDirection((d) => d === "asc" ? "desc" : "asc")} className="h-9">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> {sortDirection === "asc" ? "Asc" : "Desc"}
        </Button>
        <Button variant={filtersOpen || hasFilters ? "default" : "outline"} size="sm" onClick={() => setFiltersOpen((v) => !v)} className="h-9">
          <FilterIcon className="h-3.5 w-3.5 mr-1" /> Filter {hasFilters ? <span className="ml-1 px-1.5 rounded-full bg-background/30 text-[10px]">{[country !== "all", city, minOrders].filter(Boolean).length}</span> : null}
        </Button>
      </div>

      {filtersOpen && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-md border border-border bg-muted/30">
          <Input value={city} onChange={(e) => { setCity(e.target.value); setPage(0); }} placeholder="City" className="h-8 w-[180px] text-xs" />
          <Input value={country === "all" ? "" : country} onChange={(e) => { setCountry(e.target.value || "all"); setPage(0); }} placeholder="Country code (e.g. KW)" className="h-8 w-[180px] text-xs uppercase" />
          <Input value={minOrders} onChange={(e) => { setMinOrders(e.target.value.replace(/[^0-9]/g, "")); setPage(0); }} placeholder="Min orders" className="h-8 w-[140px] text-xs" />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs"><X className="h-3 w-3 mr-1" /> Clear</Button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10"></TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("first_name")}>
                <div className="flex items-center gap-1">Name {sortField === "first_name" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("orders_count")}>
                <div className="flex items-center gap-1">Orders {sortField === "orders_count" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div>
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("total_spent")}>
                <div className="flex items-center gap-1 justify-end">Spent {sortField === "total_spent" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div>
              </TableHead>
              <TableHead className="text-right">AOV</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("date_created")}>
                <div className="flex items-center gap-1">Registered {sortField === "date_created" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && customers.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading customers…</TableCell></TableRow>
            ) : customers.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground">No customers found.</TableCell></TableRow>
            ) : (
              customers.map((c) => {
                const isExpanded = expandedId === c.id;
                const billing = getCustomerBilling(c);
                const aov = getAOV(c);
                return (
                  <>
                    <TableRow key={c.id} onClick={() => setExpandedId(isExpanded ? null : c.id)} className="cursor-pointer hover:bg-muted/30">
                      <TableCell>
                        <div className={`h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold ${isExpanded ? "ring-2 ring-primary/30" : ""}`}>
                          {getCustomerInitials(c)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{getCustomerName(c)}</div>
                        {c.username && <div className="text-[11px] text-muted-foreground">@{c.username}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{c.email || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{billing.phone || "—"}</TableCell>
                      <TableCell className="text-sm">{c.orders_count || 0}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmtMoney(c.total_spent)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{aov > 0 ? fmtMoney(aov) : "—"}</TableCell>
                      <TableCell className="text-xs">{billing.city || "—"}</TableCell>
                      <TableCell className="text-xs uppercase">{billing.country || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(c.date_created)}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${c.id}-exp`} className="hover:bg-transparent">
                        <TableCell colSpan={10} className="p-0">
                          <CustomerExpanded storeId={siteId} siteId={siteId} customer={c} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Page {page + 1} · showing {customers.length} of {total.toLocaleString()} {isFetching && <Loader2 className="h-3 w-3 inline animate-spin ml-2" />}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

export default function SiteCustomersPage() {
  return (
    <SitePageShell>
      <CustomersInner />
    </SitePageShell>
  );
}