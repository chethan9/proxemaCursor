import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Search, Columns3, ArrowUpDown, Download, ShoppingCart, Filter } from "lucide-react";
import {
  fetchOrders,
  getCustomerName,
  getCustomerEmail,
  getItemCount,
  type OrderRow,
  type OrderSortField,
  type SortDirection,
} from "@/services/orderService";
import { OrderRowExpanded } from "./OrderRowExpanded";

type ColumnKey = "order_number" | "status" | "customer" | "email" | "items" | "total" | "payment" | "currency" | "date_created" | "date_modified" | "synced_at" | "woo_id" | "subtotal" | "tax" | "shipping" | "discount";

const COLUMNS: { key: ColumnKey; label: string; group: string }[] = [
  { key: "order_number", label: "Order #", group: "Basic" },
  { key: "woo_id", label: "Woo ID", group: "Basic" },
  { key: "status", label: "Status", group: "Basic" },
  { key: "customer", label: "Customer", group: "Customer" },
  { key: "email", label: "Email", group: "Customer" },
  { key: "items", label: "Items", group: "Basic" },
  { key: "total", label: "Total", group: "Amounts" },
  { key: "subtotal", label: "Subtotal", group: "Amounts" },
  { key: "tax", label: "Tax", group: "Amounts" },
  { key: "shipping", label: "Shipping", group: "Amounts" },
  { key: "discount", label: "Discount", group: "Amounts" },
  { key: "currency", label: "Currency", group: "Amounts" },
  { key: "payment", label: "Payment method", group: "Payment" },
  { key: "date_created", label: "Date created", group: "Dates" },
  { key: "date_modified", label: "Date modified", group: "Dates" },
  { key: "synced_at", label: "Last synced", group: "Dates" },
];

const SORT_OPTIONS: { field: OrderSortField; direction: SortDirection; label: string }[] = [
  { field: "date_created", direction: "desc", label: "Newest first" },
  { field: "date_created", direction: "asc", label: "Oldest first" },
  { field: "total", direction: "desc", label: "Total high to low" },
  { field: "total", direction: "asc", label: "Total low to high" },
  { field: "order_number", direction: "asc", label: "Order # ascending" },
  { field: "order_number", direction: "desc", label: "Order # descending" },
  { field: "synced_at", direction: "desc", label: "Recently synced" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500];
const ORDER_STATUSES = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"];

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  "on-hold": "bg-warning/10 text-warning border-warning/20",
  pending: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-secondary text-secondary-foreground border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

export function OrdersTab({ storeId, storeUrl }: { storeId: string; storeUrl?: string | null }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const v = parseInt(localStorage.getItem("orders-page-size") || "50", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 50;
  });
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [totalMin, setTotalMin] = useState("");
  const [totalMax, setTotalMax] = useState("");
  const [sort, setSort] = useState(SORT_OPTIONS[0]);

  const [paymentOptions, setPaymentOptions] = useState<string[]>([]);

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    order_number: true,
    woo_id: false,
    status: true,
    customer: true,
    email: false,
    items: true,
    total: true,
    subtotal: false,
    tax: false,
    shipping: false,
    discount: false,
    currency: false,
    payment: true,
    date_created: true,
    date_modified: false,
    synced_at: false,
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders-page-size", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, sort, storeId, pageSize, paymentFilter, totalMin, totalMax]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, count } = await fetchOrders({
        storeId,
        page,
        pageSize,
        search: debouncedSearch,
        sortField: sort.field,
        sortDirection: sort.direction,
        statusFilter,
        paymentMethodFilter: paymentFilter,
        totalMin: totalMin ? parseFloat(totalMin) : undefined,
        totalMax: totalMax ? parseFloat(totalMax) : undefined,
      });
      setOrderCount(count);
      setOrders(data);
    } catch (e) {
      console.error("Load orders failed:", e);
    } finally {
      setLoading(false);
    }
  }, [storeId, page, pageSize, debouncedSearch, sort, statusFilter, paymentFilter, totalMin, totalMax]);

  useEffect(() => {
    if (storeId) load();
  }, [storeId, load]);

  useEffect(() => {
    if (!storeId) return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("orders")
        .select("payment_method")
        .eq("store_id", storeId)
        .limit(500)
        .then(({ data }) => {
          const set = new Set<string>();
          (data || []).forEach((r: { payment_method: string | null }) => {
            if (r.payment_method) set.add(r.payment_method);
          });
          setPaymentOptions(Array.from(set).sort());
        });
    });
  }, [storeId]);

  const visibleColList = useMemo(
    () => COLUMNS.filter((c) => visibleCols[c.key]),
    [visibleCols]
  );

  const exportCsv = useCallback(() => {
    if (orders.length === 0) return;
    const header = visibleColList.map((c) => c.label).join(",");
    const rows = orders.map((o) => visibleColList.map((c) => {
      let v: string | number = "";
      switch (c.key) {
        case "order_number": v = o.order_number || ""; break;
        case "woo_id": v = o.woo_id; break;
        case "status": v = o.status || ""; break;
        case "customer": v = getCustomerName(o.billing); break;
        case "email": v = getCustomerEmail(o.billing); break;
        case "items": v = getItemCount(o.line_items); break;
        case "total": v = String(o.total ?? ""); break;
        case "subtotal": v = String(o.subtotal ?? ""); break;
        case "tax": v = String(o.total_tax ?? ""); break;
        case "shipping": v = String(o.shipping_total ?? ""); break;
        case "discount": v = String(o.discount_total ?? ""); break;
        case "currency": v = o.currency || ""; break;
        case "payment": v = o.payment_method_title || o.payment_method || ""; break;
        case "date_created": v = o.date_created || ""; break;
        case "date_modified": v = o.date_modified || ""; break;
        case "synced_at": v = o.synced_at || ""; break;
      }
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(",")).join("\n");
    const csv = `${header}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${storeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [orders, visibleColList, storeId]);

  const hasActiveFilters = statusFilter !== "all" || paymentFilter !== "all" || search || totalMin || totalMax;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur border-b border-border">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-md border border-border bg-background px-1 h-9">
                <Button
                  variant={statusFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                {ORDER_STATUSES.map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs capitalize px-2.5"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>

              {paymentOptions.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={paymentFilter !== "all" ? "secondary" : "outline"}
                      size="sm"
                      className="h-9 text-xs gap-1.5 px-2.5"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span className="max-w-[120px] truncate">
                        {paymentFilter === "all" ? "Payment" : paymentFilter}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-0">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <span className="text-xs font-semibold">Filter by payment</span>
                      {paymentFilter !== "all" && (
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => setPaymentFilter("all")}>
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="max-h-[280px] overflow-y-auto p-1">
                      <button
                        onClick={() => setPaymentFilter("all")}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${paymentFilter === "all" ? "bg-accent" : ""}`}
                      >
                        All payment methods
                      </button>
                      {paymentOptions.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPaymentFilter(p)}
                          className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate ${paymentFilter === p ? "bg-accent" : ""}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setPaymentFilter("all");
                    setTotalMin("");
                    setTotalMax("");
                  }}
                >
                  Clear
                </Button>
              )}

              <div className="flex-1 flex justify-center min-w-[200px]">
                <div className="relative w-full max-w-[360px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search order #, customer, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0" title={`Sort: ${sort.label}`}>
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SORT_OPTIONS.map((opt, i) => (
                      <DropdownMenuItem
                        key={i}
                        onClick={() => setSort(opt)}
                        className={sort === opt ? "bg-accent" : ""}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1" title="Customize columns">
                      <Columns3 className="h-3.5 w-3.5" />
                      <span className="text-xs text-muted-foreground">{Object.values(visibleCols).filter(Boolean).length}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[520px] p-0" sideOffset={6}>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                      <div className="text-sm font-medium">Customize columns</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const none: Record<string, boolean> = {};
                          COLUMNS.forEach((c) => { none[c.key] = c.key === "order_number" || c.key === "status" || c.key === "total"; });
                          setVisibleCols(none as Record<ColumnKey, boolean>);
                        }}
                      >
                        Reset
                      </Button>
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
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b border-border">
                                {group}
                              </div>
                              <div className="flex flex-col gap-0.5">
                                {cols.map((c) => (
                                  <label
                                    key={c.key}
                                    className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]"
                                  >
                                    <Checkbox
                                      checked={visibleCols[c.key]}
                                      onCheckedChange={(v) =>
                                        setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))
                                      }
                                    />
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

                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={exportCsv} disabled={orders.length === 0} title="Export CSV">
                  <Download className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span className="font-medium">{orderCount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {orderCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Per page:</span>
                  <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <Button
                        key={n}
                        variant={pageSize === n ? "secondary" : "ghost"}
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setPageSize(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {page * pageSize + 1}–{Math.min((page + 1) * pageSize, orderCount)} of {orderCount.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(0)} disabled={page === 0}>First</Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
                    <span className="px-2 font-medium">Page {page + 1} / {Math.max(1, Math.ceil(orderCount / pageSize))}</span>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= orderCount}>Next</Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(Math.max(0, Math.ceil(orderCount / pageSize) - 1))} disabled={(page + 1) * pageSize >= orderCount}>Last</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {visibleColList.map((c) => {
                    if (c.key === "total") {
                      const active = !!(totalMin || totalMax);
                      return (
                        <TableHead key={c.key}>
                          <div className="flex items-center gap-1">
                            <span>{c.label}</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className={`h-5 w-5 p-0 ${active ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}>
                                  <Filter className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-60 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold">Filter by total</span>
                                  {active && (
                                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 font-normal" onClick={() => { setTotalMin(""); setTotalMax(""); }}>
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input type="number" value={totalMin} onChange={(e) => setTotalMin(e.target.value)} placeholder="Min" className="h-8 text-xs" />
                                  <span className="text-muted-foreground text-xs">to</span>
                                  <Input type="number" value={totalMax} onChange={(e) => setTotalMax(e.target.value)} placeholder="Max" className="h-8 text-xs" />
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableHead>
                      );
                    }
                    return <TableHead key={c.key}>{c.label}</TableHead>;
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {visibleColList.map((c) => (
                        <TableCell key={c.key}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColList.length} className="text-center py-16">
                      <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No orders found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((o) => {
                    const isExpanded = expandedRowId === o.id;
                    return (
                      <>
                        <TableRow key={o.id} className={`hover:bg-muted/30 cursor-pointer ${isExpanded ? "bg-muted/30" : ""}`} onClick={() => setExpandedRowId((cur) => (cur === o.id ? null : o.id))}>
                          {visibleColList.map((c) => {
                            if (c.key === "order_number") {
                              return <TableCell key={c.key} className="font-mono font-medium">#{o.order_number || o.woo_id}</TableCell>;
                            }
                            if (c.key === "woo_id") {
                              return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground">{o.woo_id}</TableCell>;
                            }
                            if (c.key === "status") {
                              const cls = STATUS_COLORS[o.status || ""] || "bg-muted text-muted-foreground border-border";
                              return (
                                <TableCell key={c.key}>
                                  <Badge variant="outline" className={`capitalize text-[10px] ${cls}`}>
                                    {o.status || "—"}
                                  </Badge>
                                </TableCell>
                              );
                            }
                            if (c.key === "customer") {
                              return <TableCell key={c.key} className="max-w-[200px] truncate">{getCustomerName(o.billing)}</TableCell>;
                            }
                            if (c.key === "email") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[200px] truncate">{getCustomerEmail(o.billing) || "—"}</TableCell>;
                            }
                            if (c.key === "items") {
                              return <TableCell key={c.key} className="text-sm">{getItemCount(o.line_items)}</TableCell>;
                            }
                            if (c.key === "total") {
                              return <TableCell key={c.key} className="font-mono text-sm font-semibold">{o.currency ? `${o.currency} ` : ""}{o.total || "—"}</TableCell>;
                            }
                            if (c.key === "subtotal") {
                              return <TableCell key={c.key} className="font-mono text-sm">{o.subtotal || "—"}</TableCell>;
                            }
                            if (c.key === "tax") {
                              return <TableCell key={c.key} className="font-mono text-sm">{o.total_tax || "—"}</TableCell>;
                            }
                            if (c.key === "shipping") {
                              return <TableCell key={c.key} className="font-mono text-sm">{o.shipping_total || "—"}</TableCell>;
                            }
                            if (c.key === "discount") {
                              return <TableCell key={c.key} className="font-mono text-sm">{o.discount_total || "—"}</TableCell>;
                            }
                            if (c.key === "currency") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.currency || "—"}</TableCell>;
                            }
                            if (c.key === "payment") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[160px] truncate">{o.payment_method_title || o.payment_method || "—"}</TableCell>;
                            }
                            if (c.key === "date_created") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.date_created ? new Date(o.date_created).toLocaleString() : "—"}</TableCell>;
                            }
                            if (c.key === "date_modified") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.date_modified ? new Date(o.date_modified).toLocaleString() : "—"}</TableCell>;
                            }
                            if (c.key === "synced_at") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.synced_at ? new Date(o.synced_at).toLocaleString() : "—"}</TableCell>;
                            }
                            return <TableCell key={c.key}>—</TableCell>;
                          })}
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${o.id}-exp`} className="hover:bg-transparent">
                            <TableCell colSpan={visibleColList.length} className="p-0">
                              <OrderRowExpanded
                                order={o}
                                storeUrl={storeUrl}
                                onSaved={(updated) => setOrders((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                              />
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
        </CardContent>
      </Card>
    </div>
  );
}