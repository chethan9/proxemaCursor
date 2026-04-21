import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { SitePageShell } from "@/components/site/shared";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Columns3,
  ArrowUpDown,
  Download,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  FilterX,
  Plus,
  UserPlus,
  Eye,
  Mail,
  Trash2,
  Pencil,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  useCustomers,
  useCustomerLastOrders,
} from "@/hooks/queries/useCustomers";
import {
  getCustomerName,
  getCustomerInitials,
  getCustomerBilling,
  getAOV,
  deleteCustomer,
  type CustomerRow,
  type CustomerSortField,
  type SortDirection,
} from "@/services/customerService";

type ColumnKey =
  | "name"
  | "username"
  | "email"
  | "phone"
  | "orders"
  | "spent"
  | "aov"
  | "city"
  | "country"
  | "registered"
  | "last_active";

const COLUMNS: { key: ColumnKey; label: string; group: string; numeric?: boolean }[] = [
  { key: "name", label: "Name", group: "Customer" },
  { key: "username", label: "Username", group: "Customer" },
  { key: "email", label: "Email", group: "Customer" },
  { key: "phone", label: "Phone", group: "Customer" },
  { key: "orders", label: "Orders", group: "Activity", numeric: true },
  { key: "spent", label: "Spent", group: "Activity", numeric: true },
  { key: "aov", label: "AOV", group: "Activity", numeric: true },
  { key: "city", label: "City", group: "Location" },
  { key: "country", label: "Country", group: "Location" },
  { key: "registered", label: "Registered", group: "Activity" },
  { key: "last_active", label: "Last active", group: "Activity" },
];

const SORT_OPTIONS: { field: CustomerSortField; direction: SortDirection; label: string }[] = [
  { field: "date_created", direction: "desc", label: "Newest registered" },
  { field: "date_created", direction: "asc", label: "Oldest registered" },
  { field: "total_spent", direction: "desc", label: "Highest spent" },
  { field: "total_spent", direction: "asc", label: "Lowest spent" },
  { field: "orders_count", direction: "desc", label: "Most orders" },
  { field: "orders_count", direction: "asc", label: "Fewest orders" },
  { field: "name", direction: "asc", label: "Name A→Z" },
  { field: "name", direction: "desc", label: "Name Z→A" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500];

function formatMoney(v: number | string | null | undefined, currency = "KWD") {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n || isNaN(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

function CustomerRowExpanded({ customer, storeId, onDeleted }: { customer: CustomerRow; storeId: string; onDeleted: () => void }) {
  const router = useRouter();
  const { data: lastOrders = [] } = useCustomerLastOrders(storeId, customer.woo_id, 3);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const billing = getCustomerBilling(customer);
  const addr = [billing.address_1, billing.city, billing.state, billing.country].filter(Boolean).join(", ");

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteCustomer(storeId, customer.id);
      toast({ title: "Customer deleted" });
      onDeleted();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }, [storeId, customer.id, toast, onDeleted]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 p-5 border-t border-border">
      <div className="space-y-4 min-w-0">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Last orders</div>
          {lastOrders.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">No orders yet.</div>
          ) : (
            <div className="space-y-1.5">
              {lastOrders.map((o) => {
                const status = o.status || "pending";
                const statusClass = status === "completed"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                  : status === "processing"
                  ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900"
                  : status === "cancelled" || status === "failed"
                  ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900"
                  : "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:ring-slate-700";
                const dotClass = status === "completed" ? "bg-emerald-500" : status === "processing" ? "bg-blue-500" : status === "cancelled" || status === "failed" ? "bg-rose-500" : "bg-slate-400";
                return (
                  <Link
                    key={o.id}
                    href={`/sites/${storeId}/orders/${o.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium capitalize ring-1 ring-inset ${statusClass}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                      {status}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">#{o.order_number || o.woo_id}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{o.date_created ? new Date(o.date_created).toLocaleDateString() : "—"}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">{o.payment_method_title || "—"}</span>
                    <span className="font-mono text-xs font-semibold">{formatMoney(o.total, o.currency || "KWD")}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        {addr && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Billing address</div>
            <div className="text-xs text-foreground/80">{addr}</div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Actions</div>
        <Button
          size="sm"
          className="w-full h-8 text-xs gap-1.5 justify-start"
          onClick={() => router.push(`/sites/${storeId}/customers/${customer.id}?edit=1`)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit customer
          <ExternalLink className="h-3 w-3 ml-auto opacity-70" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-1.5 justify-start"
          onClick={() => router.push(`/sites/${storeId}/customers/${customer.id}`)}
        >
          <Eye className="h-3.5 w-3.5" />
          View details
          <ExternalLink className="h-3 w-3 ml-auto opacity-70" />
        </Button>
        {customer.email && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs gap-1.5 justify-start"
            asChild
          >
            <a href={`mailto:${customer.email}`}>
              <Mail className="h-3.5 w-3.5" />
              Send email
              <ExternalLink className="h-3 w-3 ml-auto opacity-70" />
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-1.5 justify-start text-destructive hover:text-destructive hover:bg-destructive/5"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the customer from WooCommerce and this database. Existing orders are preserved but will become guest orders on Woo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomersInner() {
  const router = useRouter();
  const storeId = typeof router.query.id === "string" ? router.query.id : "";
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const v = parseInt(localStorage.getItem("customers-page-size") || "50", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 50;
  });
  const [sort, setSort] = useState(SORT_OPTIONS[0]);
  const [roleFilter, setRoleFilter] = useState<"all" | "customer" | "subscriber" | "guest">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("customers-page-size", String(pageSize));
  }, [pageSize]);

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    name: true,
    username: true,
    email: true,
    phone: true,
    orders: true,
    spent: true,
    aov: true,
    city: true,
    country: true,
    registered: true,
    last_active: false,
  });

  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("customers-col-order");
        if (saved) {
          const parsed = JSON.parse(saved) as ColumnKey[];
          const allKeys = COLUMNS.map((c) => c.key);
          const valid = parsed.filter((k) => allKeys.includes(k));
          const missing = allKeys.filter((k) => !valid.includes(k));
          return [...valid, ...missing];
        }
      } catch { /* ignore */ }
    }
    return COLUMNS.map((c) => c.key);
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("customers-col-order", JSON.stringify(columnOrder));
  }, [columnOrder]);
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);

  const visibleColList = useMemo(
    () => columnOrder
      .map((k) => COLUMNS.find((c) => c.key === k))
      .filter((c): c is typeof COLUMNS[number] => !!c && visibleCols[c.key]),
    [visibleCols, columnOrder]
  );

  const { data: result, isLoading } = useCustomers({
    storeId,
    page,
    pageSize,
    search: debouncedSearch,
    sortField: sort.field,
    sortDirection: sort.direction,
    roleFilter,
  });
  const customers = result?.data ?? [];
  const count = result?.count ?? 0;

  const hasActiveFilters = roleFilter !== "all" || !!search;

  const handleExport = useCallback(() => {
    if (customers.length === 0) return;
    const headers = ["id", "woo_id", "name", "username", "email", "phone", "orders_count", "total_spent", "city", "country", "date_created"];
    const rows = customers.map((c) => {
      const b = getCustomerBilling(c);
      return [
        c.id,
        c.woo_id ?? "",
        getCustomerName(c).replace(/"/g, '""'),
        c.username || "",
        c.email || "",
        b.phone || "",
        c.orders_count ?? 0,
        c.total_spent ?? 0,
        b.city || "",
        b.country || "",
        c.date_created || "",
      ].map((v) => `"${String(v)}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-${storeId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${customers.length} customers` });
  }, [customers, storeId, toast]);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={roleFilter !== "all" ? "secondary" : "outline"}
                  size="sm"
                  className="h-9 text-xs gap-1.5 px-2.5"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="capitalize">{roleFilter === "all" ? "Role" : roleFilter}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-52 p-1">
                {(["all", "customer", "subscriber", "guest"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted capitalize ${roleFilter === r ? "bg-accent" : ""}`}
                  >
                    {r === "all" ? "All roles" : r}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`Sort: ${sort.label}`}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((opt, i) => (
                  <DropdownMenuItem key={i} onClick={() => setSort(opt)} className={sort === opt ? "bg-accent" : ""}>{opt.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5" onClick={() => { setRoleFilter("all"); setSearch(""); }}>
                <FilterX className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="w-full max-w-[320px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="Search name, email, username, phone, city…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title="Customize columns">
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="text-xs">Columns</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{Object.values(visibleCols).filter(Boolean).length}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[420px] p-0" sideOffset={6}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="text-sm font-medium">Customize columns</div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    const def: Record<string, boolean> = {};
                    COLUMNS.forEach((c) => { def[c.key] = c.key !== "last_active"; });
                    setVisibleCols(def as Record<ColumnKey, boolean>);
                  }}>Reset</Button>
                </div>
                <div className="max-h-[380px] overflow-y-auto p-4">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                    {(() => {
                      const grouped: Record<string, typeof COLUMNS> = {};
                      COLUMNS.forEach((c) => {
                        if (!grouped[c.group]) grouped[c.group] = [];
                        grouped[c.group].push(c);
                      });
                      return Object.entries(grouped).map(([group, cols]) => (
                        <div key={group}>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b border-border">{group}</div>
                          <div className="flex flex-col gap-0.5">
                            {cols.map((c) => (
                              <label key={c.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]">
                                <Checkbox checked={visibleCols[c.key]} onCheckedChange={(v) => setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))} />
                                <span className="truncate">{c.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={customers.length === 0} onClick={handleExport} title="Export CSV">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export</span>
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
              <Users className="h-3.5 w-3.5" />
              <span className="font-medium">{count.toLocaleString()}</span>
            </div>
            {count > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 border-l border-border">
                <span>Rows:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1">{pageSize}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <DropdownMenuItem key={n} onClick={() => { setPageSize(n); setPage(0); }} className={pageSize === n ? "bg-accent" : ""}>{n}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="whitespace-nowrap">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count.toLocaleString()}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= count}><ChevronRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
            <Button size="sm" className="h-9 px-3 gap-1.5" asChild>
              <Link href={`/sites/${storeId}/customers/new`}>
                <UserPlus className="h-3.5 w-3.5" />
                <span className="text-xs">New customer</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {visibleColList.map((c) => {
                    const dragProps = {
                      draggable: true,
                      onDragStart: (e: React.DragEvent) => { setDragKey(c.key); e.dataTransfer.effectAllowed = "move"; },
                      onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
                      onDrop: (e: React.DragEvent) => {
                        e.preventDefault();
                        if (!dragKey || dragKey === c.key) return;
                        setColumnOrder((prev) => {
                          const next = prev.filter((k) => k !== dragKey);
                          const idx = next.indexOf(c.key);
                          next.splice(idx, 0, dragKey);
                          return next;
                        });
                        setDragKey(null);
                      },
                      onDragEnd: () => setDragKey(null),
                      className: `cursor-move select-none ${dragKey === c.key ? "opacity-50" : ""}`,
                    };
                    const alignCls = c.numeric ? "text-right" : "text-left";
                    return (
                      <TableHead key={c.key} {...dragProps} className={`${dragProps.className} ${alignCls}`}>
                        <span className={`inline-flex items-center gap-1 ${c.numeric ? "justify-end w-full" : ""}`}>
                          {c.label}
                          <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                        </span>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {visibleColList.map((c) => (
                        <TableCell key={c.key}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColList.length} className="text-center py-16">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No customers found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => {
                    const isExpanded = expandedId === c.id;
                    const b = getCustomerBilling(c);
                    const total = Number(c.total_spent ?? 0);
                    const ordersCt = Number(c.orders_count ?? 0);
                    const name = getCustomerName(c);
                    const initials = getCustomerInitials(c);
                    return (
                      <Fragment key={c.id}>
                        <TableRow
                          className={`hover:bg-muted/30 cursor-pointer ${isExpanded ? "bg-muted/30 border-b-0" : ""}`}
                          onClick={() => setExpandedId((cur) => cur === c.id ? null : c.id)}
                        >
                          {visibleColList.map((col) => {
                            if (col.key === "name") {
                              return (
                                <TableCell key={col.key} className="max-w-[260px]">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-foreground/70">
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-medium truncate">{name}</div>
                                      {c.username && <div className="text-[11px] text-muted-foreground truncate">@{c.username}</div>}
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            }
                            if (col.key === "username") return <TableCell key={col.key} className="text-xs text-muted-foreground">{c.username ? `@${c.username}` : "—"}</TableCell>;
                            if (col.key === "email") return <TableCell key={col.key} className="text-xs text-muted-foreground max-w-[220px] truncate">{c.email || b.email || "—"}</TableCell>;
                            if (col.key === "phone") return <TableCell key={col.key} className="font-mono text-xs">{b.phone || "—"}</TableCell>;
                            if (col.key === "orders") return <TableCell key={col.key} className="text-right font-mono text-sm">{ordersCt}</TableCell>;
                            if (col.key === "spent") return <TableCell key={col.key} className="text-right font-mono text-sm font-semibold">{formatMoney(total)}</TableCell>;
                            if (col.key === "aov") return <TableCell key={col.key} className="text-right font-mono text-xs text-muted-foreground">{formatMoney(getAOV(c))}</TableCell>;
                            if (col.key === "city") return <TableCell key={col.key} className="text-xs text-muted-foreground max-w-[140px] truncate">{b.city || "—"}</TableCell>;
                            if (col.key === "country") return <TableCell key={col.key} className="text-xs font-mono text-muted-foreground">{b.country || "—"}</TableCell>;
                            if (col.key === "registered") return <TableCell key={col.key} className="text-xs text-muted-foreground whitespace-nowrap">{c.date_created ? new Date(c.date_created).toLocaleDateString() : "—"}</TableCell>;
                            if (col.key === "last_active") return <TableCell key={col.key} className="text-xs text-muted-foreground whitespace-nowrap">{c.synced_at ? new Date(c.synced_at).toLocaleDateString() : "—"}</TableCell>;
                            return <TableCell key={col.key}>—</TableCell>;
                          })}
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30" data-expanded-row={c.id}>
                            <TableCell colSpan={visibleColList.length} className="p-0">
                              <div onClick={(e) => e.stopPropagation()}>
                                <CustomerRowExpanded
                                  customer={c}
                                  storeId={storeId}
                                  onDeleted={() => setExpandedId(null)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <AuthGuard>
      <SitePageShell>
        <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
          <CustomersInner />
        </div>
      </SitePageShell>
    </AuthGuard>
  );
}