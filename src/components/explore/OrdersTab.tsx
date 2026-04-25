import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import React from "react";
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
import { Search, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, ShoppingCart, Filter, ChevronLeft, ChevronRight, GripVertical, ArrowLeft, Trash2, CheckCircle2, X, Loader2, FilterX, Hourglass, PauseCircle, AlertCircle, CircleDashed, XCircle, RotateCcw, DollarSign, type LucideIcon } from "lucide-react";
import { DateRangeFilter } from "./DateRangeFilter";
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
import { useAllActiveSyncs } from "@/hooks/queries/useAllActiveSyncs";
import { useScrollExpandedIntoView } from "@/hooks/useScrollExpandedIntoView";
import { useStore } from "@/hooks/queries/useStores";
import { formatStoreDateTime } from "@/lib/format-store-date";
import { SyncPill } from "@/components/ui/sync-pill";
import { EmptyState } from "@/components/EmptyState";
import { NoOrdersIllustration, NoSearchResultsIllustration } from "@/components/illustrations/EmptyIllustrations";
import { exportCsv, type CsvColumn } from "@/lib/exportCsv";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";
import { TableLoadingOverlay } from "@/components/ui/table-loading-overlay";

type ColumnKey = "id" | "order_number" | "status" | "customer" | "first_name" | "last_name" | "email" | "phone" | "customer_id" | "items" | "line_items_summary" | "total" | "payment" | "payment_method" | "currency" | "date_created" | "date_modified" | "synced_at" | "woo_id" | "subtotal" | "tax" | "shipping" | "discount" | "source" | "created_via";

const COLUMNS: { key: ColumnKey; label: string; group: string; sortable?: OrderSortField }[] = [
  { key: "id", label: "Internal ID", group: "Order" },
  { key: "woo_id", label: "Woo ID", group: "Order" },
  { key: "order_number", label: "Order #", group: "Order", sortable: "order_number" },
  { key: "status", label: "Status", group: "Order" },
  { key: "date_created", label: "Date created", group: "Order", sortable: "date_created" },
  { key: "date_modified", label: "Date modified", group: "Order" },
  { key: "synced_at", label: "Last synced", group: "Order", sortable: "synced_at" },
  { key: "source", label: "Source (UTM)", group: "Order" },
  { key: "created_via", label: "Created via", group: "Order" },
  { key: "customer_id", label: "Customer ID", group: "Customer" },
  { key: "customer", label: "Name", group: "Customer" },
  { key: "first_name", label: "First name", group: "Customer" },
  { key: "last_name", label: "Last name", group: "Customer" },
  { key: "email", label: "Email", group: "Customer" },
  { key: "phone", label: "Phone", group: "Customer" },
  { key: "items", label: "Item count", group: "Customer" },
  { key: "line_items_summary", label: "Items (name × qty)", group: "Customer" },
  { key: "currency", label: "Currency", group: "Payment & Amounts" },
  { key: "total", label: "Total", group: "Payment & Amounts", sortable: "total" },
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

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000, 2500, 5000];
const ORDER_STATUSES = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"];

const STATUS_COLORS: Record<string, { wrap: string; dot: string; Icon: LucideIcon }> = {
  completed: { wrap: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900", dot: "bg-emerald-500", Icon: CheckCircle2 },
  processing: { wrap: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900", dot: "bg-blue-500", Icon: CircleDashed },
  "on-hold": { wrap: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900", dot: "bg-amber-500", Icon: PauseCircle },
  pending: { wrap: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:ring-slate-700", dot: "bg-slate-400", Icon: Hourglass },
  cancelled: { wrap: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900", dot: "bg-rose-500", Icon: XCircle },
  refunded: { wrap: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900", dot: "bg-violet-500", Icon: RotateCcw },
  failed: { wrap: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900", dot: "bg-red-500", Icon: AlertCircle },
};

export function OrdersTab({ storeId, storeUrl, storeName, search: searchProp, onSearchChange, embedHeader = false }: { storeId: string; storeUrl?: string | null; storeName?: string; search?: string; onSearchChange?: (v: string) => void; embedHeader?: boolean }) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  useScrollExpandedIntoView(expandedRowId);
  const { data: store } = useStore(storeId);
  const storeTz = store?.timezone ?? null;
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
  const { data: activeSyncs = [] } = useAllActiveSyncs();
  const activeSync = activeSyncs.find((s) => s.store_id === storeId);
  const { locked } = useSyncLocked(storeId);
  const prefsLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    const defaults: Record<ColumnKey, boolean> = {
      id: false, order_number: true, woo_id: false, status: true, customer: true,
      first_name: false, last_name: false, email: false, phone: true, customer_id: false,
      items: true, line_items_summary: false, total: true, subtotal: false, tax: false,
      shipping: false, discount: false, currency: false, payment: true, payment_method: false,
      date_created: true, date_modified: false, synced_at: false, source: false, created_via: false,
    };
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("orders-visible-cols");
        if (saved) return { ...defaults, ...JSON.parse(saved) };
      } catch { /* ignore */ }
    }
    return defaults;
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

  const { data: ordersResult, isLoading: loading, isFetching, isPlaceholderData } = useOrders({
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
  const showRefetchOverlay = isFetching && !loading && orders.length > 0;

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

  const handleExportCsv = useCallback(() => {
    if (orders.length === 0) return;
    const colMap: Record<ColumnKey, (o: OrderRow) => unknown> = {
      id: (o) => o.id,
      woo_id: (o) => o.woo_id,
      order_number: (o) => o.order_number || o.woo_id,
      status: (o) => o.status || "",
      date_created: (o) => (o.date_created ? formatStoreDateTime(o.date_created, storeTz) : ""),
      date_modified: (o) => (o.date_modified ? formatStoreDateTime(o.date_modified, storeTz) : ""),
      synced_at: (o) => (o.synced_at ? formatStoreDateTime(o.synced_at, storeTz) : ""),
      source: (o) => getOrderSource(o) || "",
      created_via: (o) => (o.raw_data as { created_via?: string } | null)?.created_via || "",
      customer_id: (o) => o.customer_id ?? "",
      customer: (o) => getCustomerName(o.billing),
      first_name: (o) => getBillingFirstName(o.billing) || "",
      last_name: (o) => getBillingLastName(o.billing) || "",
      email: (o) => getCustomerEmail(o.billing) || "",
      phone: (o) => getCustomerPhone(o.billing) || "",
      items: (o) => getItemCount(o.line_items),
      line_items_summary: (o) => getLineItemsSummary(o.line_items),
      currency: (o) => o.currency || "",
      total: (o) => o.total || "",
      subtotal: (o) => o.subtotal || "",
      tax: (o) => o.total_tax || "",
      shipping: (o) => o.shipping_total || "",
      discount: (o) => o.discount_total || "",
      payment: (o) => {
        const pm = o.payment_method ? pmRegistry[o.payment_method] : null;
        return pm?.label || o.payment_method_title || o.payment_method || "";
      },
      payment_method: (o) => o.payment_method || "",
    };
    const selected = selectedIds.size > 0 ? orders.filter((o) => selectedIds.has(o.id)) : orders;
    const columns: CsvColumn<OrderRow>[] = visibleColList.map((c) => ({
      key: c.key,
      label: c.label,
      accessor: colMap[c.key],
    }));
    const suffix = selected.length !== orders.length ? `-${selected.length}-selected` : `-page-${page + 1}`;
    const filename = `orders-${storeName?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || storeId.slice(0, 8)}${suffix}`;
    exportCsv(selected, columns, filename);
    toast({ title: "Export ready", description: `Exported ${selected.length} orders to CSV` });
  }, [orders, selectedIds, visibleColList, pmRegistry, storeTz, storeName, storeId, page, toast]);

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

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders-col-order", JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders-visible-cols", JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders-page-size", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    if (prefsLoaded.current) return;
    fetchPreferences("orders").then((remote) => {
      if (remote) {
        if (Array.isArray(remote.columnOrder)) setColumnOrder(remote.columnOrder as ColumnKey[]);
        if (remote.visibleCols && typeof remote.visibleCols === "object") setVisibleCols((cur) => ({ ...cur, ...(remote.visibleCols as Record<ColumnKey, boolean>) }));
        if (typeof remote.pageSize === "number") setPageSize(remote.pageSize);
        if (typeof remote.statusFilter === "string") setStatusFilter(remote.statusFilter);
        if (typeof remote.paymentFilter === "string") setPaymentFilter(remote.paymentFilter);
        if (remote.sort && typeof remote.sort === "object") setSort(remote.sort as typeof SORT_OPTIONS[number]);
      }
      prefsLoaded.current = true;
    }).catch(() => { prefsLoaded.current = true; });
  }, []);

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

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-3">
      <SyncLockBanner storeId={storeId} />
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
                    disabled={locked}
                    title={locked ? "Available after initial sync completes" : undefined}
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
            <DateRangeFilter
              range={dateRange as "all" | "today" | "yesterday" | "7d" | "30d" | "90d" | "custom"}
              from={customFrom}
              to={customTo}
              onChange={(r, f, t) => {
                setDateRange(r);
                setCustomFrom(f);
                setCustomTo(t);
              }}
              disabled={locked}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={totalMin || totalMax ? "secondary" : "outline"}
                  size="sm"
                  className="h-9 text-xs gap-1.5 px-2.5"
                  disabled={locked}
                  title={locked ? "Available after initial sync completes" : undefined}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>
                    {totalMin || totalMax
                      ? `${totalMin || "0"} – ${totalMax || "∞"}`
                      : "Total"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">Filter by total</span>
                  {(totalMin || totalMax) && (
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => { setTotalMin(""); setTotalMax(""); }}>Clear</Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Min</label>
                    <Input type="number" value={totalMin} onChange={(e) => setTotalMin(e.target.value)} placeholder="0" className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Max</label>
                    <Input type="number" value={totalMax} onChange={(e) => setTotalMax(e.target.value)} placeholder="∞" className="h-8 text-xs" />
                  </div>
                </div>
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
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`Sort: ${sort.label}`} disabled={locked}>
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
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title="Customize columns" disabled={locked}>
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
                            {cols.map((c) => {
                              if (!c.sortable) {
                                return (
                                  <label key={c.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]">
                                    <Checkbox
                                      checked={visibleCols[c.key]}
                                      onCheckedChange={(v) => setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))}
                                    />
                                    <span className="truncate">{c.label}</span>
                                  </label>
                                );
                              }
                              const isNumeric = ["total", "subtotal", "tax", "shipping", "discount", "items", "woo_id", "customer_id"].includes(c.key);
                              const alignCls = isNumeric ? "text-right" : "text-left";
                              const isActive = sort.field === c.sortable;
                              const SortIcon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                              return (
                                <label key={c.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]">
                                  <Checkbox
                                    checked={visibleCols[c.key]}
                                    onCheckedChange={(v) =>
                                      setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextDir: SortDirection = isActive && sort.direction === "desc" ? "asc" : "desc";
                                      setSort({ field: c.sortable!, direction: nextDir, label: `${c.label} ${nextDir === "desc" ? "↓" : "↑"}` });
                                    }}
                                    className={`inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                                  >
                                    {c.label}
                                    <SortIcon className="h-3 w-3" />
                                  </button>
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
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={orders.length === 0 || locked} title={locked ? "Available after initial sync completes" : "Export CSV"} onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export</span>
            </Button>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur">
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
                    disabled={locked}
                    title={locked ? "Available after initial sync completes" : undefined}
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
              <DateRangeFilter
                range={dateRange as "all" | "today" | "yesterday" | "7d" | "30d" | "90d" | "custom"}
                from={customFrom}
                to={customTo}
                onChange={(r, f, t) => {
                  setDateRange(r);
                  setCustomFrom(f);
                  setCustomTo(t);
                }}
                disabled={locked}
              />
            )}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs ml-auto gap-1.5"
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
                <FilterX className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <div className="flex-1" />

            {!embedHeader && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0" title={`Sort: ${sort.label}`} disabled={locked}>
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
                    <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1" title="Customize columns" disabled={locked}>
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
                                  if (!c.sortable) {
                                    return (
                                      <label key={c.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]">
                                        <Checkbox
                                          checked={visibleCols[c.key]}
                                          onCheckedChange={(v) =>
                                            setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))
                                          }
                                        />
                                        <span className="truncate">{c.label}</span>
                                      </label>
                                    );
                                  }
                                  const isNumeric = ["total", "subtotal", "tax", "shipping", "discount", "items", "woo_id", "customer_id"].includes(c.key);
                                  const alignCls = isNumeric ? "text-right" : "text-left";
                                  const isActive = sort.field === c.sortable;
                                  const SortIcon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                                  return (
                                    <label key={c.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]">
                                      <Checkbox
                                        checked={visibleCols[c.key]}
                                        onCheckedChange={(v) =>
                                          setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))
                                        }
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextDir: SortDirection = isActive && sort.direction === "desc" ? "asc" : "desc";
                                          setSort({ field: c.sortable!, direction: nextDir, label: `${c.label} ${nextDir === "desc" ? "↓" : "↑"}` });
                                        }}
                                        className={`inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                                      >
                                        {c.label}
                                        <SortIcon className="h-3 w-3" />
                                      </button>
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

            <div className="flex items-center gap-2 rounded-md border border-border bg-background h-9 px-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="font-medium">{orderCount.toLocaleString()}</span>
              </div>
              {orderCount > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Rows:</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1">{pageSize}</Button>
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
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= orderCount}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      <Card className="relative">
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
                    <DropdownMenuItem key={s} onClick={() => setTimeout(() => setBulkAction({ type: "update_status", status: s }), 0)} className="capitalize text-xs">
                      {s}
                    </DropdownMenuItem>
                  ))}
                  <Button size="sm" variant="destructive" className="h-8 text-xs gap-1.5" onClick={() => setTimeout(() => setBulkAction({ type: "delete" }), 0)} disabled={overLimit}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={() => setSelectedIds(new Set())}>
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="destructive" className="h-8 text-xs gap-1.5" onClick={() => setTimeout(() => setBulkAction({ type: "delete" }), 0)} disabled={overLimit}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          )}
          {loading && orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading orders…
            </div>
          ) : orders.length === 0 ? (
            hasActiveFilters ? (
              <EmptyState
                illustration={<NoSearchResultsIllustration className="w-full h-full" />}
                title="No orders match your filters"
                description="Try clearing your filters or adjusting them to see more results."
              />
            ) : activeSync ? (
              <div className="p-8 text-center">
                <Loader2 className="h-10 w-10 mx-auto text-primary/60 mb-2 animate-spin" />
                <p className="text-sm font-medium">Syncing your orders…</p>
                <p className="text-xs text-muted-foreground mt-1">{activeSync.progress}% complete — new orders will appear automatically</p>
              </div>
            ) : (
              <EmptyState
                illustration={<NoOrdersIllustration className="w-full h-full" />}
                title="No orders yet"
                description="When customers place orders on your store, they'll appear here for you to manage."
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 pl-3 pr-0">
                      <Checkbox
                        checked={!locked && orders.length > 0 && orders.every((o) => selectedIds.has(o.id))}
                        disabled={locked}
                        onCheckedChange={(v) => {
                          if (locked) return;
                          if (v) setSelectedIds(new Set(orders.map((o) => o.id)));
                          else setSelectedIds(new Set());
                        }}
                      />
                    </TableHead>
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
                            const targetIdx = next.indexOf(c.key);
                            next.splice(targetIdx, 0, dragKey);
                            return next;
                          });
                          setDragKey(null);
                        },
                        onDragEnd: () => setDragKey(null),
                      };
                      const isSortable = !!c.sortable;
                      const isActive = isSortable && sort.field === c.sortable;
                      const SortIcon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                      return (
                        <TableHead key={c.key} className={`cursor-move select-none ${dragKey === c.key ? "opacity-50" : ""}`} {...dragProps}>
                          <span className="inline-flex items-center gap-1">
                            {isSortable ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextDir: SortDirection = isActive && sort.direction === "desc" ? "asc" : "desc";
                                  setSort({ field: c.sortable!, direction: nextDir, label: `${c.label} ${nextDir === "desc" ? "↓" : "↑"}` });
                                }}
                                className={`inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                              >
                                {c.label}
                                <SortIcon className="h-3 w-3" />
                              </button>
                            ) : (
                              <span className="text-xs font-medium">{c.label}</span>
                            )}
                            <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                          </span>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const isExpanded = expandedRowId === o.id;
                    const isSelected = selectedIds.has(o.id);
                    return (
                      <React.Fragment key={o.id}>
                        <TableRow className={`hover:bg-muted/30 cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_52px] ${isExpanded ? "bg-muted/30" : ""} ${isSelected ? "bg-primary/5" : ""}`} onClick={() => setExpandedRowId((cur) => (cur === o.id ? null : o.id))}>
                          <TableCell className="w-8 pl-3 pr-0" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSelected} disabled={locked} onCheckedChange={() => { if (!locked) toggleSelect(o.id); }} />
                          </TableCell>
                          {visibleColList.map((c) => {
                            if (c.key === "id") {
                              return <TableCell key={c.key} className="font-mono text-[10px] text-muted-foreground">{o.id.slice(0, 8)}</TableCell>;
                            }
                            if (c.key === "order_number") {
                              return (
                                <TableCell key={c.key} className="font-mono font-medium">
                                  <span className="inline-flex items-center gap-2">
                                    #{o.order_number || o.woo_id}
                                    <SyncPill entityType="order" entityId={o.id} />
                                  </span>
                                </TableCell>
                              );
                            }
                            if (c.key === "woo_id") {
                              return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground text-right">{o.woo_id}</TableCell>;
                            }
                            if (c.key === "status") {
                              const s = STATUS_COLORS[o.status || ""] || STATUS_COLORS.pending;
                              const SIcon = s.Icon;
                              return (
                                <TableCell key={c.key}>
                                  <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium capitalize ring-1 ring-inset ${s.wrap}`}>
                                    <SIcon className="h-3 w-3" />
                                    {o.status || "—"}
                                  </span>
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
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.date_created ? formatStoreDateTime(o.date_created, storeTz) : "—"}</TableCell>;
                            }
                            if (c.key === "date_modified") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.date_modified ? formatStoreDateTime(o.date_modified, storeTz) : "—"}</TableCell>;
                            }
                            if (c.key === "synced_at") {
                              return <TableCell key={c.key} className="text-xs text-muted-foreground">{o.synced_at ? formatStoreDateTime(o.synced_at, storeTz) : "—"}</TableCell>;
                            }
                            return <TableCell key={c.key}>—</TableCell>;
                          })}
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30" data-expanded-row={o.id}>
                            <TableCell colSpan={visibleColList.length + 1} className="p-0">
                              <div onClick={(e) => e.stopPropagation()}>
                                <OrderRowExpanded
                                  order={o}
                                  storeUrl={storeUrl}
                                  onSaved={() => { /* react-query will refetch */ }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <TableLoadingOverlay show={showRefetchOverlay} />
      </Card>

      <Dialog open={!!bulkAction} onOpenChange={(v) => {
        if (!v) {
          setBulkAction(null);
          setTimeout(() => { if (typeof document !== "undefined") document.body.style.pointerEvents = ""; }, 0);
        }
      }}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
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