import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Search, Columns3, ArrowUpDown, Download, ShoppingCart, Filter, ChevronLeft, ChevronRight, GripVertical, ArrowLeft, Trash2, CheckCircle2, X, Loader2 } from "lucide-react";
import {
  getCustomerName,
  getCustomerEmail,
  getCustomerPhone,
  getBillingFirstName,
  getBillingLastName,
  getItemCount,
  getLineItemsSummary,
  getOrderSource,
  type OrderRow,
  type OrderSortField,
  type SortDirection,
} from "@/services/orderService";
import { type PaymentMethodRow } from "@/services/paymentMethodService";
import { fetchPreferences, savePreferences } from "@/services/viewPreferencesService";
import { useOrders, useOrderPaymentOptions } from "@/hooks/queries/useOrders";
import { usePaymentMethods } from "@/hooks/queries/usePaymentMethods";
import { OrderRowExpanded } from "./OrderRowExpanded";
import { useBackgroundPagination } from "@/hooks/useBackgroundPagination";
import { queryKeys } from "@/lib/query-client";
import { fetchOrders } from "@/services/orderService";
import { createBulkJob, ORDER_STATUS_OPTIONS } from "@/services/bulkJobService";

type ColumnKey = "id" | "order_number" | "status" | "customer" | "first_name" | "last_name" | "email" | "phone" | "customer_id" | "items" | "line_items_summary" | "total" | "payment" | "payment_method" | "currency" | "date_created" | "date_modified" | "synced_at" | "woo_id" | "subtotal" | "tax" | "shipping" | "discount" | "source" | "created_via";

const COLUMNS: { key: ColumnKey; label: string; group: string }[] = [
  { key: "id", label: "Internal ID", group: "Order" },
  { key: "woo_id", label: "Woo ID", group: "Order" },
  { key: "order_number", label: "Order #", group: "Order" },
  { key: "status", label: "Status", group: "Order" },
  { key: "date_created", label: "Date created", group: "Order" },
  { key: "date_modified", label: "Date modified", group: "Order" },
  { key: "synced_at", label: "Last synced", group: "Order" },
  { key: "source", label: "Source (UTM)", group: "Order" },
  { key: "created_via", label: "Created via", group: "Order" },
  { key: "customer_id", label: "Customer ID", group: "Customer" },
  { key: "customer", label: "Customer (full name)", group: "Customer" },
  { key: "first_name", label: "First name", group: "Customer" },
  { key: "last_name", label: "Last name", group: "Customer" },
  { key: "email", label: "Email", group: "Customer" },
  { key: "phone", label: "Phone", group: "Customer" },
  { key: "items", label: "Item count", group: "Customer" },
  { key: "line_items_summary", label: "Items (name × qty)", group: "Customer" },
  { key: "currency", label: "Currency", group: "Payment & Amounts" },
  { key: "total", label: "Total", group: "Payment & Amounts" },
  { key: "subtotal", label: "Subtotal", group: "Payment & Amounts" },
  { key: "tax", label: "Tax", group: "Payment & Amounts" },
  { key: "shipping", label: "Shipping", group: "Payment & Amounts" },
  { key: "discount", label: "Discount", group: "Payment & Amounts" },
  { key: "payment", label: "Payment title", group: "Payment & Amounts" },
  { key: "payment_method", label: "Payment method", group: "Payment & Amounts" },
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

export function OrdersTab({ storeId, storeUrl, storeName, search: searchProp, onSearchChange, embedHeader = false }: { storeId: string; storeUrl?: string | null; storeName?: string; search?: string; onSearchChange?: (v: string) => void; embedHeader?: boolean }) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const v = parseInt(localStorage.getItem("orders-page-size") || "50", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 50;
  });

  const search = searchProp ?? "";
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [totalMin, setTotalMin] = useState("");
  const [totalMax, setTotalMax] = useState("");
  const [dateRange, setDateRange] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [sort, setSort] = useState(SORT_OPTIONS[0]);

  const { data: paymentOptions = [] } = useOrderPaymentOptions(storeId);
  const { data: pmRegistry = {} as Record<string, PaymentMethodRow> } = usePaymentMethods();
  const prefsLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    id: false,
    order_number: true,
    woo_id: false,
    status: true,
    customer: true,
    first_name: false,
    last_name: false,
    email: false,
    phone: true,
    customer_id: false,
    items: true,
    line_items_summary: false,
    total: true,
    subtotal: false,
    tax: false,
    shipping: false,
    discount: false,
    currency: false,
    payment: true,
    payment_method: false,
    date_created: true,
    date_modified: false,
    synced_at: false,
    source: false,
    created_via: false,
  });

  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("orders-col-order");
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
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ type: "update_status"; status: string } | { type: "delete" } | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const MAX_BULK = 500;
  const overLimit = selectedIds.size > MAX_BULK;

  // Clear selection when data/filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [storeId, debouncedSearch, statusFilter, paymentFilter, totalMin, totalMax, page, pageSize]);

  const visibleColList = useMemo(
    () => columnOrder
      .map((k) => COLUMNS.find((c) => c.key === k))
      .filter((c): c is typeof COLUMNS[number] => !!c && visibleCols[c.key]),
    [visibleCols, columnOrder]
  );

  const dateBounds = useMemo(() => {
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
    if (dateRange === "today") return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    if (dateRange === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }; }
    if (dateRange === "7d") { const f = new Date(now); f.setDate(f.getDate() - 7); return { from: f.toISOString(), to: now.toISOString() }; }
    if (dateRange === "30d") { const f = new Date(now); f.setDate(f.getDate() - 30); return { from: f.toISOString(), to: now.toISOString() }; }
    if (dateRange === "90d") { const f = new Date(now); f.setDate(f.getDate() - 90); return { from: f.toISOString(), to: now.toISOString() }; }
    if (dateRange === "custom") {
      return {
        from: customFrom ? startOfDay(customFrom).toISOString() : undefined,
        to: customTo ? endOfDay(customTo).toISOString() : undefined,
      };
    }
    return { from: undefined, to: undefined };
  }, [dateRange, customFrom, customTo]);

  const { data: ordersResult, isLoading: loading, isPlaceholderData } = useOrders({
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
    dateFrom: dateBounds.from,
    dateTo: dateBounds.to,
  });
  const orders = ordersResult?.data ?? [];
  const orderCount = ordersResult?.count ?? 0;
  void isPlaceholderData;

  const submitBulk = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0 || overLimit) return;
    const orderIds = orders
      .filter((o) => selectedIds.has(o.id))
      .map((o) => o.woo_id);
    if (orderIds.length === 0) {
      toast({ title: "Nothing to process", description: "Selected orders not found on this page", variant: "destructive" });
      return;
    }
    setBulkSubmitting(true);
    try {
      const payload = bulkAction.type === "update_status"
        ? { type: "update_order_status" as const, order_ids: orderIds, new_status: bulkAction.status }
        : { type: "delete_orders" as const, order_ids: orderIds };
      const jobType = bulkAction.type === "update_status" ? "update_order_status" : "delete_orders";
      await createBulkJob({
        store_id: storeId,
        job_type: jobType,
        total: orderIds.length,
        payload,
      });
      toast({
        title: "Bulk job queued",
        description: `Processing ${orderIds.length} orders in the background. Check progress in the bulk jobs panel.`,
      });
      setSelectedIds(new Set());
      setBulkAction(null);
    } catch (err) {
      toast({
        title: "Failed to queue bulk job",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBulkSubmitting(false);
    }
  }, [bulkAction, selectedIds, orders, overLimit, storeId, toast]);

  const hasActiveFilters = statusFilter !== "all" || paymentFilter !== "all" || search || totalMin || totalMax || dateRange !== "all";

  useEffect(() => {
    if (!prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferences("orders", { columnOrder, visibleCols, pageSize, statusFilter, paymentFilter, sort }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [columnOrder, visibleCols, pageSize, statusFilter, paymentFilter, sort]);

  const prefetchOpts = useMemo(() => ({
    storeId,
    search: debouncedSearch,
    sortField: sort.field,
    sortDirection: sort.direction,
    statusFilter,
    paymentMethodFilter: paymentFilter,
    totalMin: totalMin ? Number(totalMin) : undefined,
    totalMax: totalMax ? Number(totalMax) : undefined,
    dateFrom: dateBounds.from,
    dateTo: dateBounds.to,
  }), [storeId, debouncedSearch, sort.field, sort.direction, statusFilter, paymentFilter, totalMin, totalMax, dateBounds.from, dateBounds.to]);

  useBackgroundPagination({
    enabled: !!storeId && orderCount > 0,
    totalCount: orderCount,
    pageSize,
    currentPage: page,
    queryKeyFn: (p) => queryKeys.orders(storeId, { ...prefetchOpts, page: p, pageSize } as unknown as Record<string, unknown>),
    queryFn: (p) => fetchOrders({ ...prefetchOpts, page: p, pageSize }),
    maxRecords: 5000,
    resetKey: `${JSON.stringify(prefetchOpts)}|${pageSize}`,
  });

  return (
    <div className="space-y-3">
      {embedHeader && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            {paymentOptions.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={paymentFilter !== "all" ? "secondary" : "outline"}
                    size="sm"
                    className="h-9 text-xs gap-1.5 px-2.5"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span className="max-w-[120px] truncate">{paymentFilter === "all" ? "Payment" : paymentFilter}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-semibold">Filter by payment</span>
                    {paymentFilter !== "all" && (
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => setPaymentFilter("all")}>Clear</Button>
                    )}
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    <button onClick={() => setPaymentFilter("all")} className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${paymentFilter === "all" ? "bg-accent" : ""}`}>All payment methods</button>
                    {paymentOptions.map((p) => (
                      <button key={p} onClick={() => setPaymentFilter(p)} className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate ${paymentFilter === p ? "bg-accent" : ""}`}>{p}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={dateRange !== "all" ? "secondary" : "outline"} size="sm" className="h-9 text-xs gap-1.5 px-2.5">
                  <Filter className="h-3.5 w-3.5" />
                  <span>{dateRange === "all" ? "Date" : dateRange === "today" ? "Today" : dateRange === "yesterday" ? "Yesterday" : dateRange === "7d" ? "Last 7 days" : dateRange === "30d" ? "Last 30 days" : dateRange === "90d" ? "Last 90 days" : "Custom"}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <div className="p-1">
                  {[
                    { v: "all", l: "All time" },
                    { v: "today", l: "Today" },
                    { v: "yesterday", l: "Yesterday" },
                    { v: "7d", l: "Last 7 days" },
                    { v: "30d", l: "Last 30 days" },
                    { v: "90d", l: "Last 90 days" },
                    { v: "custom", l: "Custom range…" },
                  ].map((o) => (
                    <button key={o.v} onClick={() => setDateRange(o.v)} className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${dateRange === o.v ? "bg-accent" : ""}`}>{o.l}</button>
                  ))}
                </div>
                {dateRange === "custom" && (
                  <div className="border-t p-3 flex gap-4">
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground mb-1">From</div>
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground mb-1">To</div>
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} />
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="w-full max-w-[288px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="Search orders by #, customer, or email..." value={search} onChange={(e) => onSearchChange?.(e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`Sort: ${sort.label}`}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((opt, i) => (
                  <DropdownMenuItem key={i} onClick={() => setSort(opt)} className={sort === opt ? "bg-accent" : ""}>{opt.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title="Customize columns">
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="text-xs">Columns</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{Object.values(visibleCols).filter(Boolean).length}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[520px] p-0" sideOffset={6}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="text-sm font-medium">Customize columns</div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    const none: Record<string, boolean> = {};
                    COLUMNS.forEach((c) => { none[c.key] = c.key === "order_number" || c.key === "status" || c.key === "total"; });
                    setVisibleCols(none as Record<ColumnKey, boolean>);
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
                                <Checkbox
                                  checked={visibleCols[c.key]}
                                  onCheckedChange={(v) => setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))}
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
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={orders.length === 0} title="Export CSV">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export</span>
            </Button>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur border-b border-border">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-md border border-border bg-background px-1 h-9">
                <Button variant="ghost" size="sm" className={`h-7 text-xs px-2.5 ${statusFilter === "all" ? "bg-foreground/10 text-foreground font-medium hover:bg-foreground/15" : ""}`} onClick={() => setStatusFilter("all")}>All</Button>
                {ORDER_STATUSES.map((s) => (
                  <Button key={s} variant="ghost" size="sm" className={`h-7 text-xs capitalize px-2.5 ${statusFilter === s ? "bg-foreground/10 text-foreground font-medium hover:bg-foreground/15" : ""}`} onClick={() => setStatusFilter(s)}>{s}</Button>
                ))}
              </div>

              {!embedHeader && paymentOptions.length > 0 && (
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

              {!embedHeader && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={dateRange !== "all" ? "secondary" : "outline"} size="sm" className="h-9 text-xs gap-1.5 px-2.5">
                      <Filter className="h-3.5 w-3.5" />
                      <span>{dateRange === "all" ? "Date" : dateRange === "today" ? "Today" : dateRange === "yesterday" ? "Yesterday" : dateRange === "7d" ? "Last 7 days" : dateRange === "30d" ? "Last 30 days" : dateRange === "90d" ? "Last 90 days" : "Custom"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <div className="p-1">
                      {[
                        { v: "all", l: "All time" },
                        { v: "today", l: "Today" },
                        { v: "yesterday", l: "Yesterday" },
                        { v: "7d", l: "Last 7 days" },
                        { v: "30d", l: "Last 30 days" },
                        { v: "90d", l: "Last 90 days" },
                        { v: "custom", l: "Custom range…" },
                      ].map((o) => (
                        <button key={o.v} onClick={() => setDateRange(o.v)} className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${dateRange === o.v ? "bg-accent" : ""}`}>{o.l}</button>
                      ))}
                    </div>
                    {dateRange === "custom" && (
                      <div className="border-t p-3 flex gap-4">
                        <div>
                          <div className="text-[10px] font-semibold text-muted-foreground mb-1">From</div>
                          <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} />
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-muted-foreground mb-1">To</div>
                          <Calendar mode="single" selected={customTo} onSelect={setCustomTo} />
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs ml-auto"
                  onClick={() => {
                    setStatusFilter("all");
                    setPaymentFilter("all");
                    setTotalMin("");
                    setTotalMax("");
                    setDateRange("all");
                    setCustomFrom(undefined);
                    setCustomTo(undefined);
                  }}
                >
                  Clear filters
                </Button>
              )}

              <div className="flex-1" />

              {!embedHeader && (
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
                        <DropdownMenuItem key={i} onClick={() => setSort(opt)} className={sort === opt ? "bg-accent" : ""}>{opt.label}</DropdownMenuItem>
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
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                          const none: Record<string, boolean> = {};
                          COLUMNS.forEach((c) => { none[c.key] = c.key === "order_number" || c.key === "status" || c.key === "total"; });
                          setVisibleCols(none as Record<ColumnKey, boolean>);
                        }}>
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
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b border-border">{group}</div>
                                <div className="flex flex-col gap-0.5">
                                  {cols.map((c) => {
                                    const isNumeric = ["total", "subtotal", "tax", "shipping", "discount", "items", "woo_id", "customer_id"].includes(c.key);
                                    const alignCls = isNumeric ? "text-right" : "text-left";
                                    return (
                                      <label key={c.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]">
                                        <Checkbox
                                          checked={visibleCols[c.key]}
                                          onCheckedChange={(v) =>
                                            setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))
                                          }
                                        />
                                        <span className="truncate">{c.label}</span>
                                        <GripVertical className={`h-3 w-3 text-muted-foreground/30 ${isNumeric ? "ml-0.5" : ""}`} />
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="font-medium">{orderCount.toLocaleString()}</span>
              </div>

              {orderCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 border-l border-border">
                  <span>Rows:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1">{pageSize}</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <DropdownMenuItem key={n} onClick={() => setPageSize(n)} className={pageSize === n ? "bg-accent" : ""}>{n}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="whitespace-nowrap">
                    {page * pageSize + 1}–{Math.min((page + 1) * pageSize, orderCount)} of {orderCount.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= orderCount}><ChevronRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border ${overLimit ? "bg-destructive/5" : "bg-primary/5"}`}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">{selectedIds.size}</Badge>
                <span className="text-xs font-medium">selected</span>
                {overLimit && (
                  <span className="text-[11px] text-destructive ml-1">(max {MAX_BULK} per job)</span>
                )}
              </div>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark status
                    <ChevronRight className="h-3 w-3 rotate-90 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Change status to…</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setBulkAction({ type: "update_status", status: s })} className="capitalize text-xs">
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" disabled={overLimit} onClick={() => setBulkAction({ type: "delete" })}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-8 pl-3 pr-0">
                    <Checkbox
                      checked={orders.length > 0 && orders.every((o) => selectedIds.has(o.id))}
                      onCheckedChange={(v) => {
                        if (v) setSelectedIds(new Set(orders.map((o) => o.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </TableHead>
                  {visibleColList.map((c) => {
                    const dragProps = {
                      draggable: true,
                      onDragStart: (e: React.DragEvent) => {
                        setDragKey(c.key);
                        e.dataTransfer.effectAllowed = "move";
                      },
                      onDragOver: (e: React.DragEvent) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      },
                      onDrop: (e: React.DragEvent) => {
                        e.preventDefault();
                        if (!dragKey || dragKey === c.key) return;
                        setColumnOrder((prev) => {
                          const next = prev.filter((k) => k !== dragKey);
                          const targetIdx = next.indexOf(c.key);
                          next.splice(targetIdx, 0, dragKey);
                          return next;
                        });
                        setDragKey(null);
                      },
                      onDragEnd: () => setDragKey(null),
                      className: `cursor-move select-none ${dragKey === c.key ? "opacity-50" : ""}`,
                    };
                    const isNumeric = ["total", "subtotal", "tax", "shipping", "discount", "items", "woo_id", "customer_id"].includes(c.key);
                    const alignCls = isNumeric ? "text-right" : "text-left";
                    if (c.key === "total") {
                      const active = !!(totalMin || totalMax);
                      return (
                        <TableHead key={c.key} {...dragProps} className={`${dragProps.className} ${alignCls}`}>
                          <div className="flex items-center justify-end gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground/30" />
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
                            <GripVertical className="h-3 w-3 text-muted-foreground/30 ml-0.5" />
                          </div>
                        </TableHead>
                      );
                    }
                    return (
                      <TableHead key={c.key} {...dragProps}>
                        <span className={`inline-flex items-center gap-1 ${isNumeric ? "justify-end w-full" : ""}`}>
                          {c.label}
                          <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                        </span>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell className="w-8 pl-3 pr-0"><Skeleton className="h-4 w-4" /></TableCell>
                      {visibleColList.map((c) => (
                        <TableCell key={c.key}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColList.length + 1} className="text-center py-16">
                      <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No orders found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((o) => {
                    const isExpanded = expandedRowId === o.id;
                    const isSelected = selectedIds.has(o.id);
                    return (
                      <>
                        <TableRow key={o.id} className={`hover:bg-muted/30 cursor-pointer ${isExpanded ? "bg-muted/30" : ""} ${isSelected ? "bg-primary/5" : ""}`} onClick={() => setExpandedRowId((cur) => (cur === o.id ? null : o.id))}>
                          <TableCell className="w-8 pl-3 pr-0" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(o.id)} />
                          </TableCell>
                          {visibleColList.map((c) => {
                            if (c.key === "id") {
                              return <TableCell key={c.key} className="font-mono text-[10px] text-muted-foreground">{o.id.slice(0, 8)}</TableCell>;
                            }
                            if (c.key === "order_number") {
                              return <TableCell key={c.key} className="font-mono font-medium">#{o.order_number || o.woo_id}</TableCell>;
                            }
                            if (c.key === "woo_id") {
                              return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground text-right">{o.woo_id}</TableCell>;
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
                            if (c.key === "first_name") {
                              return <TableCell key={c.key} className="max-w-[140px] truncate">{getBillingFirstName(o.billing) || "—"}</TableCell>;
                            }
                            if (c.key === "last_name") {
                              return <TableCell key={c.key} className="max-w-[140px] truncate">{getBillingLastName(o.billing) || "—"}</TableCell>;
                            }
                            if (c.key === "email") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[200px] truncate">{getCustomerEmail(o.billing) || "—"}</TableCell>;
                            }
                            if (c.key === "phone") {
                              const phone = getCustomerPhone(o.billing);
                              return <TableCell key={c.key} className="font-mono text-xs">{phone || "—"}</TableCell>;
                            }
                            if (c.key === "customer_id") {
                              return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground text-right">{o.customer_id ?? "—"}</TableCell>;
                            }
                            if (c.key === "items") {
                              return <TableCell key={c.key} className="text-sm text-right">{getItemCount(o.line_items)}</TableCell>;
                            }
                            if (c.key === "line_items_summary") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[280px] truncate" title={getLineItemsSummary(o.line_items)}>{getLineItemsSummary(o.line_items) || "—"}</TableCell>;
                            }
                            if (c.key === "total") {
                              return <TableCell key={c.key} className="font-mono text-sm font-semibold text-right">{o.currency ? `${o.currency} ` : ""}{o.total || "—"}</TableCell>;
                            }
                            if (c.key === "subtotal") {
                              return <TableCell key={c.key} className="font-mono text-sm text-right">{o.subtotal || "—"}</TableCell>;
                            }
                            if (c.key === "tax") {
                              return <TableCell key={c.key} className="font-mono text-sm text-right">{o.total_tax || "—"}</TableCell>;
                            }
                            if (c.key === "shipping") {
                              return <TableCell key={c.key} className="font-mono text-sm text-right">{o.shipping_total || "—"}</TableCell>;
                            }
                            if (c.key === "discount") {
                              return <TableCell key={c.key} className="font-mono text-sm text-right">{o.discount_total || "—"}</TableCell>;
                            }
                            if (c.key === "currency") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.currency || "—"}</TableCell>;
                            }
                            if (c.key === "payment") {
                              const pm = o.payment_method ? pmRegistry[o.payment_method] : null;
                              const display = pm?.label || o.payment_method_title || o.payment_method || "";
                              return (
                                <TableCell key={c.key} className="max-w-[180px]">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {pm?.icon_url && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={pm.icon_url} alt="" className="h-4 w-4 rounded object-contain bg-white flex-shrink-0" />
                                    )}
                                    <span className="text-xs text-muted-foreground truncate">{display || "—"}</span>
                                  </div>
                                </TableCell>
                              );
                            }
                            if (c.key === "payment_method") {
                              const pm = o.payment_method ? pmRegistry[o.payment_method] : null;
                              return (
                                <TableCell key={c.key}>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {pm?.icon_url && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={pm.icon_url} alt="" className="h-4 w-4 rounded object-contain bg-white flex-shrink-0" />
                                    )}
                                    <span className="font-mono text-xs text-muted-foreground">{o.payment_method || "—"}</span>
                                  </div>
                                </TableCell>
                              );
                            }
                            if (c.key === "source") {
                              const src = getOrderSource(o);
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{src || "—"}</TableCell>;
                            }
                            if (c.key === "created_via") {
                              const cv = (o.raw_data as { created_via?: string } | null)?.created_via || "";
                              return <TableCell key={c.key} className="text-xs text-muted-foreground capitalize">{cv || "—"}</TableCell>;
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
                            <TableCell colSpan={visibleColList.length + 1} className="p-0">
                              <OrderRowExpanded
                                order={o}
                                storeUrl={storeUrl}
                                onSaved={() => { /* react-query will refetch */ }}
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

      <Dialog open={!!bulkAction} onOpenChange={(v) => !v && setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction?.type === "delete"
                ? `Delete ${selectedIds.size} orders?`
                : `Update ${selectedIds.size} orders to "${bulkAction?.type === "update_status" ? bulkAction.status : ""}"?`}
            </DialogTitle>
            <DialogDescription>
              This queues a background job that pushes changes to WooCommerce one order at a time.
              Processing {selectedIds.size} orders may take {Math.ceil(selectedIds.size * 1.5 / 60)}–{Math.ceil(selectedIds.size * 3 / 60)} minutes.
              You can close this page; progress is saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)} disabled={bulkSubmitting}>Cancel</Button>
            <Button
              onClick={submitBulk}
              disabled={bulkSubmitting}
              variant={bulkAction?.type === "delete" ? "destructive" : "default"}
            >
              {bulkSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Queueing…</> : "Queue job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}