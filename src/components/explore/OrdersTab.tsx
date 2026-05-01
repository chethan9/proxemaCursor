import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from "react";
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
import { Search, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, ShoppingCart, Filter, GripVertical, Trash2, CheckCircle2, ChevronRight, X, Loader2, FilterX, Hourglass, PauseCircle, AlertCircle, CircleDashed, XCircle, RotateCcw, DollarSign, Receipt, ClipboardList, Printer, Tag, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrderDistinctStatuses } from "@/hooks/queries/useOrderDistinctStatuses";
import { orderStatusDisplayLabel } from "@/lib/order-status-ui";
import { listTemplates } from "@/services/templateService";
import { resolveDefaultTemplateForPrint } from "@/lib/template-resolve-default";
import { useAuth } from "@/contexts/AuthProvider";
import { updateOrderStatus } from "@/services/orderService";
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
import { InfiniteScrollSentinel } from "./InfiniteScrollSentinel";
import { queryKeys } from "@/lib/query-client";
import { normalizeNumberInput, normalizeSelectFilter } from "@/lib/normalize-explorer-filters";
import { createBulkJob, ORDER_STATUS_OPTIONS } from "@/services/bulkJobService";
import { useAllActiveSyncs } from "@/hooks/queries/useAllActiveSyncs";
import { useScrollExpandedIntoView } from "@/hooks/useScrollExpandedIntoView";
import { formatStoreDateTime } from "@/lib/format-store-date";
import { SyncPill } from "@/components/ui/sync-pill";
import { EmptyState } from "@/components/EmptyState";
import { NoOrdersIllustration, NoSearchResultsIllustration } from "@/components/illustrations/EmptyIllustrations";
import { exportCsv, type CsvColumn } from "@/lib/exportCsv";
import { logClientAuditEvent } from "@/lib/audit/client-log";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";
import { TableLoadingOverlay } from "@/components/ui/table-loading-overlay";
import { ProgressSlot } from "@/contexts/LoadingProvider";
import { useExplorerKeyboard } from "@/hooks/useExplorerKeyboard";
import { useStoreSyncStatus } from "@/hooks/queries/useStoreSyncStatus";
import { cn } from "@/lib/utils";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";
import { useSyncUrl, getQueryString } from "@/hooks/useUrlState";
import { PrintInvoicesDialog } from "./PrintInvoicesDialog";

function pendingLabel(action: string | null | undefined, translate: (key: string, opt?: Record<string, string>) => string) {
  if (!action) return "";
  if (action === "delete") return translate("orders.pending.delete");
  if (action === "status_change") return translate("orders.pending.statusChange");
  return translate("orders.pending.scheduledGeneric", { action });
}

type ColumnKey = "id" | "order_number" | "status" | "customer" | "first_name" | "last_name" | "email" | "phone" | "customer_id" | "items" | "line_items_summary" | "total" | "payment" | "payment_method" | "currency" | "date_created" | "date_modified" | "synced_at" | "woo_id" | "subtotal" | "tax" | "shipping" | "discount" | "source" | "created_via" | "actions";

type OrderSortState = { field: OrderSortField; direction: SortDirection };

const COLUMN_META: { key: ColumnKey; labelKey: string; groupKey: string; sortable?: OrderSortField }[] = [
  { key: "id", labelKey: "orders.columns.internalId", groupKey: "orders.columnGroups.order" },
  { key: "woo_id", labelKey: "orders.columns.wooId", groupKey: "orders.columnGroups.order" },
  { key: "order_number", labelKey: "orders.columns.orderNumber", groupKey: "orders.columnGroups.order", sortable: "order_number" },
  { key: "status", labelKey: "orders.columns.status", groupKey: "orders.columnGroups.order", sortable: "status" },
  { key: "date_created", labelKey: "orders.columns.dateCreated", groupKey: "orders.columnGroups.order", sortable: "date_created" },
  { key: "date_modified", labelKey: "orders.columns.dateModified", groupKey: "orders.columnGroups.order" },
  { key: "synced_at", labelKey: "orders.columns.syncedAt", groupKey: "orders.columnGroups.order", sortable: "synced_at" },
  { key: "source", labelKey: "orders.columns.sourceUtm", groupKey: "orders.columnGroups.order" },
  { key: "created_via", labelKey: "orders.columns.createdVia", groupKey: "orders.columnGroups.order" },
  { key: "customer_id", labelKey: "orders.columns.customerId", groupKey: "orders.columnGroups.customer" },
  { key: "customer", labelKey: "orders.columns.customerName", groupKey: "orders.columnGroups.customer" },
  { key: "first_name", labelKey: "orders.columns.firstName", groupKey: "orders.columnGroups.customer" },
  { key: "last_name", labelKey: "orders.columns.lastName", groupKey: "orders.columnGroups.customer" },
  { key: "email", labelKey: "orders.columns.email", groupKey: "orders.columnGroups.customer" },
  { key: "phone", labelKey: "orders.columns.phone", groupKey: "orders.columnGroups.customer" },
  { key: "items", labelKey: "orders.columns.itemCount", groupKey: "orders.columnGroups.customer" },
  { key: "line_items_summary", labelKey: "orders.columns.lineItemsSummary", groupKey: "orders.columnGroups.customer" },
  { key: "currency", labelKey: "orders.columns.currency", groupKey: "orders.columnGroups.paymentAmounts" },
  { key: "total", labelKey: "orders.columns.total", groupKey: "orders.columnGroups.paymentAmounts", sortable: "total" },
  { key: "subtotal", labelKey: "orders.columns.subtotal", groupKey: "orders.columnGroups.paymentAmounts" },
  { key: "tax", labelKey: "orders.columns.tax", groupKey: "orders.columnGroups.paymentAmounts" },
  { key: "shipping", labelKey: "orders.columns.shipping", groupKey: "orders.columnGroups.paymentAmounts" },
  { key: "discount", labelKey: "orders.columns.discount", groupKey: "orders.columnGroups.paymentAmounts" },
  { key: "payment", labelKey: "orders.columns.paymentTitle", groupKey: "orders.columnGroups.paymentAmounts" },
  { key: "payment_method", labelKey: "orders.columns.paymentMethod", groupKey: "orders.columnGroups.paymentAmounts" },
  { key: "actions", labelKey: "orders.columns.actions", groupKey: "orders.columnGroups.actions" },
];

const VALID_SORT_FIELDS: OrderSortField[] = ["date_created", "total", "order_number", "synced_at", "created_at", "status"];

function normalizeSortFromRemote(raw: unknown): OrderSortState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { field?: string; direction?: string };
  if (!o.field || !o.direction) return null;
  if (!VALID_SORT_FIELDS.includes(o.field as OrderSortField)) return null;
  if (o.direction !== "asc" && o.direction !== "desc") return null;
  return { field: o.field as OrderSortField, direction: o.direction };
}

const DEFAULT_SORT: OrderSortState = { field: "date_created", direction: "desc" };

const SORT_PRESETS: OrderSortState[] = [
  { field: "date_created", direction: "desc" },
  { field: "date_created", direction: "asc" },
  { field: "total", direction: "desc" },
  { field: "total", direction: "asc" },
  { field: "order_number", direction: "asc" },
  { field: "order_number", direction: "desc" },
  { field: "synced_at", direction: "desc" },
  { field: "status", direction: "asc" },
  { field: "status", direction: "desc" },
];

function sortOptionLabelKey(s: OrderSortState): string {
  const map: Record<string, string> = {
    "date_created:desc": "orders.sortOptions.newestFirst",
    "date_created:asc": "orders.sortOptions.oldestFirst",
    "total:desc": "orders.sortOptions.totalHigh",
    "total:asc": "orders.sortOptions.totalLow",
    "order_number:asc": "orders.sortOptions.orderNumAsc",
    "order_number:desc": "orders.sortOptions.orderNumDesc",
    "synced_at:desc": "orders.sortOptions.recentlySynced",
    "status:asc": "orders.sortOptions.statusAsc",
    "status:desc": "orders.sortOptions.statusDesc",
  };
  return map[`${s.field}:${s.direction}`] ?? "orders.sortOptions.newestFirst";
}

function sortsEqual(a: OrderSortState, b: OrderSortState): boolean {
  return a.field === b.field && a.direction === b.direction;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000, 2500, 5000];
const ORDER_STATUSES = ["processing", "on-hold", "completed", "cancelled", "refunded", "failed"];

const STATUS_COLORS: Record<string, { wrap: string; dot: string; Icon: LucideIcon }> = {
  completed: { wrap: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900", dot: "bg-emerald-500", Icon: CheckCircle2 },
  processing: { wrap: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900", dot: "bg-blue-500", Icon: CircleDashed },
  "on-hold": { wrap: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900", dot: "bg-amber-500", Icon: PauseCircle },
  pending: { wrap: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:ring-slate-700", dot: "bg-slate-400", Icon: Hourglass },
  cancelled: { wrap: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900", dot: "bg-rose-500", Icon: XCircle },
  refunded: { wrap: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900", dot: "bg-violet-500", Icon: RotateCcw },
  failed: { wrap: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900", dot: "bg-red-500", Icon: AlertCircle },
};

/** Woo/plugin-specific statuses: neutral pill + icon */
const CUSTOM_STATUS_VISUAL = { wrap: "bg-muted/80 text-foreground ring-border dark:bg-muted/40", dot: "bg-muted-foreground/60", Icon: Tag } as const;

function resolveStatusVisual(slug: string | null | undefined) {
  if (!slug) return STATUS_COLORS.pending;
  return STATUS_COLORS[slug] ?? CUSTOM_STATUS_VISUAL;
}


export function OrdersTab({ storeId, storeUrl, storeName, storeTimezone = null, search: searchProp, onSearchChange, embedHeader = false }: { storeId: string; storeUrl?: string | null; storeName?: string; storeTimezone?: string | null; search?: string; onSearchChange?: (v: string) => void; embedHeader?: boolean }) {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? null;
  const { t, i18n } = useTranslation("site");
  const columnsDef = useMemo(
    () => COLUMN_META.map((c) => ({ ...c, label: t(c.labelKey), group: t(c.groupKey) })),
    [t, i18n.language],
  );
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  useScrollExpandedIntoView(expandedRowId);
  const router = useRouter();
  const storeTz: string | null = storeTimezone;
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 100;
    const v = parseInt(localStorage.getItem("orders-page-size") || "100", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 100;
  });

  const search = searchProp ?? "";
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => getQueryString(router.query, "status") ?? "all");
  const [paymentFilter, setPaymentFilter] = useState<string>(() => getQueryString(router.query, "pay") ?? "all");
  const [totalMin, setTotalMin] = useState(() => getQueryString(router.query, "tmin") ?? "");
  const [totalMax, setTotalMax] = useState(() => getQueryString(router.query, "tmax") ?? "");
  const [dateRange, setDateRange] = useState<string>(() => getQueryString(router.query, "range") ?? "all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [sort, setSort] = useState<OrderSortState>(() => DEFAULT_SORT);

  const sortSummaryLabel = useMemo(() => t(sortOptionLabelKey(sort)), [sort, t, i18n.language]);

  const { data: syncStatus } = useStoreSyncStatus(storeId);
  const liveOrdersMode = syncStatus ? !syncStatus.initialSyncDone : false;

  useEffect(() => {
    if (liveOrdersMode && sort.field === "status") {
      setSort(DEFAULT_SORT);
    }
  }, [liveOrdersMode, sort.field]);

  const { data: distinctStatuses = [] } = useOrderDistinctStatuses(storeId);
  const customTabStatuses = useMemo(
    () => distinctStatuses.filter((s) => !ORDER_STATUSES.includes(s)),
    [distinctStatuses],
  );
  const bulkStatusChoices = useMemo(() => {
    const seen = new Set<string>(ORDER_STATUS_OPTIONS as unknown as string[]);
    const out: string[] = [...ORDER_STATUS_OPTIONS];
    for (const s of distinctStatuses) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [distinctStatuses]);

  const { data: paymentOptions = [] } = useOrderPaymentOptions(storeId);
  const { data: pmRegistry = {} as Record<string, PaymentMethodRow> } = usePaymentMethods();
  const paymentMethodDisplay = useCallback(
    (methodId: string) => pmRegistry[methodId]?.label?.trim() || methodId,
    [pmRegistry],
  );
  const { data: activeSyncs = [] } = useAllActiveSyncs();
  const activeSync = activeSyncs.find((s) => s.store_id === storeId);
  const { locked } = useSyncLocked(storeId);
  const prefsLoaded = useRef(false);
  const prefsLoading = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    const defaults: Record<ColumnKey, boolean> = {
      id: false, order_number: true, woo_id: false, status: true, customer: true,
      first_name: false, last_name: false, email: false, phone: true, customer_id: false,
      items: true, line_items_summary: false, total: true, subtotal: false, tax: false,
      shipping: false, discount: false, currency: false, payment: true, payment_method: false,
      date_created: true, date_modified: false, synced_at: false, source: false, created_via: false,
      actions: true,
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
          const allKeys = COLUMN_META.map((c) => c.key);
          const valid = parsed.filter((k) => allKeys.includes(k));
          const missing = allKeys.filter((k) => !valid.includes(k));
          return [...valid, ...missing];
        }
      } catch { /* ignore */ }
    }
    return COLUMN_META.map((c) => c.key);
  });
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ type: "update_status"; status: string } | { type: "delete" } | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: invoiceTemplates = [] } = useQuery({
    queryKey: ["templates", "invoice"],
    queryFn: () => listTemplates("invoice"),
    staleTime: 60_000,
  });
  const { data: pickslipTemplates = [] } = useQuery({
    queryKey: ["templates", "pickslip"],
    queryFn: () => listTemplates("pickslip"),
    staleTime: 60_000,
  });

  const defaultInvoice = useMemo(
    () => resolveDefaultTemplateForPrint(invoiceTemplates, "invoice", clientId),
    [invoiceTemplates, clientId],
  );
  const defaultPickslip = useMemo(
    () => resolveDefaultTemplateForPrint(pickslipTemplates, "pickslip", clientId),
    [pickslipTemplates, clientId],
  );

  const handleMarkComplete = useCallback(async (orderId: string) => {
    setCompletingId(orderId);
    try {
      await updateOrderStatus(orderId, "completed");
      toast({ title: t("orders.toast.markedComplete") });
      await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
    } catch (err) {
      toast({ title: t("orders.toast.updateFailed"), description: err instanceof Error ? err.message : t("orders.toast.unknownError"), variant: "destructive" });
    } finally {
      setCompletingId(null);
    }
  }, [queryClient, storeId, toast, t]);

  const handlePrintTemplate = useCallback((templateId: string | undefined, orderId: string, type: "invoice" | "pickslip") => {
    if (!templateId) {
      toast({
        title: `No ${type} template`,
        description: "Create one in Templates to enable quick print.",
        variant: "destructive",
      });
      return;
    }
    const url = `/api/templates/${templateId}/render?format=pdf&store_id=${storeId}&order_id=${orderId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [storeId, toast]);

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
  const isPending = (o: OrderRow) => !!(o as OrderRow & { pending_action?: string | null }).pending_action;
  const showLockedToast = useCallback((o: OrderRow) => {
    const action = (o as OrderRow & { pending_action?: string | null }).pending_action;
    toast({ title: pendingLabel(action, t), description: t("orders.pending.lockedTooltip") });
  }, [toast, t]);

  // Clear selection when data/filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [storeId, debouncedSearch, statusFilter, paymentFilter, totalMin, totalMax, pageSize]);

  const visibleColList = useMemo(
    () => columnOrder
      .map((k) => columnsDef.find((c) => c.key === k))
      .filter((c): c is (typeof columnsDef)[number] => !!c && visibleCols[c.key]),
    [visibleCols, columnOrder, columnsDef],
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

  const normalizedStatusFilter = normalizeSelectFilter(statusFilter) ?? "all";
  const normalizedPaymentFilter = normalizeSelectFilter(paymentFilter) ?? "all";
  const normalizedTotalMin = normalizeNumberInput(totalMin);
  const normalizedTotalMax = normalizeNumberInput(totalMax);

  const {
    data: orders,
    count: orderCount,
    isLoading: loading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useOrders({
    storeId,
    pageSize,
    search: debouncedSearch,
    sortField: sort.field,
    sortDirection: sort.direction,
    statusFilter: normalizedStatusFilter,
    paymentMethodFilter: normalizedPaymentFilter,
    totalMin: normalizedTotalMin,
    totalMax: normalizedTotalMax,
    dateFrom: dateBounds.from,
    dateTo: dateBounds.to,
    enabled: router.isReady,
  });
  const showInitialLoading = !router.isReady || loading;
  const showRefetchOverlay = isFetching && !loading && !isFetchingNextPage && orders.length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExplorerKeyboard({ searchRef: searchInputRef });
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const submitBulk = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0 || overLimit) return;
    const orderIds = orders
      .filter((o) => selectedIds.has(o.id) && !isPending(o))
      .map((o) => o.woo_id);
    const skipped = selectedIds.size - orderIds.length;
    if (orderIds.length === 0) {
      toast({ title: t("orders.bulk.noEligible"), description: t("orders.bulk.noEligibleDesc"), variant: "destructive" });
      setBulkSubmitting(false);
      return;
    }
    if (skipped > 0) {
      toast({ title: t("orders.bulk.skipped", { count: skipped }), description: t("orders.bulk.skippedDesc") });
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
      if (bulkAction.type === "delete") {
        const deleteSet = new Set(orderIds);
        queryClient.setQueriesData({ queryKey: queryKeys.orders(storeId) }, (prev: unknown) => {
          if (!prev || typeof prev !== "object") return prev;
          const inf = prev as { pages?: { data: OrderRow[]; count: number }[]; pageParams?: unknown[] };
          if (Array.isArray(inf.pages)) {
            let removedTotal = 0;
            const newPages = inf.pages.map((pg) => {
              const filtered = pg.data.filter((o) => !deleteSet.has(o.woo_id ?? -1));
              removedTotal += pg.data.length - filtered.length;
              return { ...pg, data: filtered };
            });
            const firstCount = newPages[0]?.count ?? 0;
            const newCount = Math.max(0, firstCount - removedTotal);
            return {
              ...inf,
              pages: newPages.map((pg) => ({ ...pg, count: newCount })),
            };
          }
          const cur = prev as { data?: OrderRow[]; count?: number };
          if (Array.isArray(cur.data)) {
            const filtered = cur.data.filter((o) => !deleteSet.has(o.woo_id ?? -1));
            const removed = cur.data.length - filtered.length;
            return { ...cur, data: filtered, count: Math.max(0, (cur.count ?? 0) - removed) };
          }
          return prev;
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders(storeId) });
      toast({
        title: t("orders.bulk.queued"),
        description: t("orders.bulk.queuedDesc", { count: orderIds.length }),
      });
      setSelectedIds(new Set());
      setBulkAction(null);
    } catch (err) {
      toast({
        title: t("orders.toast.updateFailed"),
        description: err instanceof Error ? err.message : t("orders.toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setBulkSubmitting(false);
    }
  }, [bulkAction, selectedIds, orders, overLimit, storeId, toast, isPending, showLockedToast, t, queryClient]);

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
      actions: () => "",
    };
    const selected = selectedIds.size > 0 ? orders.filter((o) => selectedIds.has(o.id)) : orders;
    const columns: CsvColumn<OrderRow>[] = visibleColList.map((c) => ({
      key: c.key,
      label: c.label,
      accessor: colMap[c.key],
    }));
    const suffix = selected.length !== orders.length ? `-${selected.length}-selected` : `-${selected.length}-rows`;
    const filename = `orders-${storeName?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || storeId.slice(0, 8)}${suffix}`;
    exportCsv(selected, columns, filename);
    void logClientAuditEvent({
      action: "sites.order.export_csv",
      entityType: "store",
      entityId: storeId,
      storeId,
      metadata: { row_count: selected.length, filename },
    });
    toast({ title: t("orders.exportCsv.ready"), description: t("orders.exportCsv.description", { count: selected.length }) });
  }, [orders, selectedIds, visibleColList, pmRegistry, storeTz, storeName, storeId, toast, t]);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferences("orders", { columnOrder, visibleCols, pageSize, statusFilter, paymentFilter, sort }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [columnOrder, visibleCols, pageSize, statusFilter, paymentFilter, sort]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders-col-order", JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders-visible-cols", JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders-page-size", String(pageSize));
  }, [pageSize]);

  useLayoutEffect(() => {
    if (!router.isReady) return;
    const urlStatus = getQueryString(router.query, "status");
    const urlPay = getQueryString(router.query, "pay");
    const urlTmin = getQueryString(router.query, "tmin");
    const urlTmax = getQueryString(router.query, "tmax");
    const urlRange = getQueryString(router.query, "range");
    if (urlStatus !== undefined) setStatusFilter(urlStatus);
    if (urlPay !== undefined) setPaymentFilter(urlPay);
    if (urlTmin !== undefined) setTotalMin(urlTmin);
    if (urlTmax !== undefined) setTotalMax(urlTmax);
    if (urlRange !== undefined) setDateRange(urlRange);
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    if (prefsLoaded.current || prefsLoading.current) return;
    prefsLoading.current = true;
    const urlStatus = getQueryString(router.query, "status");
    const urlPay = getQueryString(router.query, "pay");
    fetchPreferences("orders").then((remote) => {
      if (remote) {
        if (Array.isArray(remote.columnOrder)) {
          const allKeys = COLUMN_META.map((c) => c.key);
          const valid = (remote.columnOrder as ColumnKey[]).filter((k) => allKeys.includes(k));
          const missing = allKeys.filter((k) => !valid.includes(k));
          setColumnOrder([...valid, ...missing]);
        }
        if (remote.visibleCols && typeof remote.visibleCols === "object") setVisibleCols((cur) => ({ ...cur, ...(remote.visibleCols as Record<ColumnKey, boolean>) }));
        if (typeof remote.pageSize === "number") setPageSize(remote.pageSize);
        if (urlStatus === undefined && typeof remote.statusFilter === "string") setStatusFilter(remote.statusFilter);
        if (urlPay === undefined && typeof remote.paymentFilter === "string") setPaymentFilter(remote.paymentFilter);
        if (remote.sort && typeof remote.sort === "object") {
          const ns = normalizeSortFromRemote(remote.sort);
          if (ns) setSort(ns);
        }
      }
      prefsLoaded.current = true;
    }).catch(() => {
      prefsLoaded.current = true;
    });
    // Single merge from server prefs when router becomes ready; URL filters already synced in layout effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentional (avoid refetching prefs on every query change)
  }, [router.isReady]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  useSyncUrl(
    { status: statusFilter, pay: paymentFilter, tmin: totalMin, tmax: totalMax, range: dateRange, q: debouncedSearch },
    { status: "all", pay: "all", tmin: "", tmax: "", range: "all", q: "" },
  );

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
                    title={locked ? t("orders.toolbar.lockedHint") : undefined}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span className="max-w-[120px] truncate">{paymentFilter === "all" ? t("orders.filters.payment") : paymentMethodDisplay(paymentFilter)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-semibold">{t("orders.filters.filterByPayment")}</span>
                    {paymentFilter !== "all" && (
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => setPaymentFilter("all")}>{t("orders.filters.clear")}</Button>
                    )}
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    <button onClick={() => setPaymentFilter("all")} className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${paymentFilter === "all" ? "bg-accent" : ""}`}>{t("orders.filters.allPaymentMethods")}</button>
                    {paymentOptions.map((p) => (
                      <button key={p} onClick={() => setPaymentFilter(p)} className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate ${paymentFilter === p ? "bg-accent" : ""}`}>{paymentMethodDisplay(p)}</button>
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
                  title={locked ? t("orders.toolbar.lockedHint") : undefined}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>
                    {totalMin || totalMax
                      ? `${totalMin || "0"} – ${totalMax || "∞"}`
                      : t("orders.filters.total")}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">{t("orders.filters.filterByTotal")}</span>
                  {(totalMin || totalMax) && (
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => { setTotalMin(""); setTotalMax(""); }}>{t("orders.filters.clear")}</Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">{t("orders.filters.min")}</label>
                    <Input type="number" value={totalMin} onChange={(e) => setTotalMin(e.target.value)} placeholder="0" className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">{t("orders.filters.max")}</label>
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
                <Input ref={searchInputRef} placeholder={t("orders.search")} value={search} onChange={(e) => onSearchChange?.(e.target.value)} className="pl-9 pr-12 h-9" />
                {!search && (
                  <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">⌘K</kbd>
                )}
                {isFetching && search && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`${t("orders.toolbar.sort")}: ${sortSummaryLabel}`} disabled={locked}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("orders.toolbar.sort")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("orders.toolbar.sortBy")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_PRESETS.map((preset, i) => {
                  const presetDisabled = liveOrdersMode && preset.field === "status";
                  return (
                    <DropdownMenuItem
                      key={i}
                      disabled={presetDisabled}
                      title={presetDisabled ? t("orders.toolbar.statusSortOptionDisabledLive") : undefined}
                      onClick={() => {
                        if (!presetDisabled) setSort(preset);
                      }}
                      className={sortsEqual(sort, preset) ? "bg-accent" : ""}
                    >
                      {t(sortOptionLabelKey(preset))}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={t("orders.toolbar.customizeColumns")} disabled={locked}>
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("orders.toolbar.columns")}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{Object.values(visibleCols).filter(Boolean).length}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[520px] p-0" sideOffset={6}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="text-sm font-medium">{t("orders.toolbar.customizeColumns")}</div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    const none: Record<string, boolean> = {};
                    COLUMN_META.forEach((c) => { none[c.key] = c.key === "order_number" || c.key === "status" || c.key === "total"; });
                    setVisibleCols(none as Record<ColumnKey, boolean>);
                  }}>{t("orders.toolbar.reset")}</Button>
                </div>
                <div className="max-h-[380px] overflow-y-auto p-4">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                    {(() => {
                      const grouped: Record<string, (typeof columnsDef)[number][]> = {};
                      columnsDef.forEach((c) => {
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
                              const isActive = sort.field === c.sortable;
                              const SortIcon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                              const sortDisabled = liveOrdersMode && c.sortable === "status";
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
                                    disabled={sortDisabled}
                                    title={sortDisabled ? t("orders.toolbar.statusSortDisabledLive") : undefined}
                                    onClick={() => {
                                      if (sortDisabled) return;
                                      const nextDir: SortDirection = isActive && sort.direction === "desc" ? "asc" : "desc";
                                      setSort({ field: c.sortable!, direction: nextDir });
                                    }}
                                    className={`inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"} disabled:opacity-40 disabled:pointer-events-none`}
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
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={orders.length === 0 || locked} title={locked ? t("orders.toolbar.lockedHint") : t("orders.toolbar.export")} onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">{t("orders.toolbar.export")}</span>
            </Button>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur relative">
        <Card>
          <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-background px-1 h-9">
              <Button variant="ghost" size="sm" className={`h-7 text-xs px-2.5 ${statusFilter === "all" ? "bg-foreground/10 text-foreground font-medium hover:bg-foreground/15" : ""}`} onClick={() => setStatusFilter("all")}>{t("orders.filters.all")}</Button>
              {ORDER_STATUSES.map((s) => (
                <Button key={s} variant="ghost" size="sm" className={`h-7 text-xs px-2.5 max-w-[140px] ${statusFilter === s ? "bg-foreground/10 text-foreground font-medium hover:bg-foreground/15" : ""}`} onClick={() => setStatusFilter(s)} title={orderStatusDisplayLabel(t, s)}>
                  <span className="truncate">{orderStatusDisplayLabel(t, s)}</span>
                </Button>
              ))}
              {customTabStatuses.map((s) => (
                <Button
                  key={`custom-${s}`}
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs px-2.5 max-w-[140px] ${statusFilter === s ? "bg-foreground/10 text-foreground font-medium hover:bg-foreground/15" : ""}`}
                  onClick={() => setStatusFilter(s)}
                  title={s}
                >
                  <span className="truncate">{orderStatusDisplayLabel(t, s)}</span>
                </Button>
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
                    title={locked ? t("orders.toolbar.lockedHint") : undefined}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span className="max-w-[120px] truncate">
                      {paymentFilter === "all" ? t("orders.filters.payment") : paymentMethodDisplay(paymentFilter)}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-semibold">{t("orders.filters.filterByPayment")}</span>
                    {paymentFilter !== "all" && (
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => setPaymentFilter("all")}>
                        {t("orders.filters.clear")}
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    <button
                      onClick={() => setPaymentFilter("all")}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${paymentFilter === "all" ? "bg-accent" : ""}`}
                    >
                      {t("orders.filters.allPaymentMethods")}
                    </button>
                    {paymentOptions.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPaymentFilter(p)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate ${paymentFilter === p ? "bg-accent" : ""}`}
                      >
                        {paymentMethodDisplay(p)}
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
                {t("orders.filters.clearAll")}
              </Button>
            )}

            <div className="flex-1" />

            {!embedHeader && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0" title={`${t("orders.toolbar.sortBy")}: ${sortSummaryLabel}`} disabled={locked}>
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{t("orders.toolbar.sortBy")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SORT_PRESETS.map((preset, i) => {
                      const presetDisabled = liveOrdersMode && preset.field === "status";
                      return (
                        <DropdownMenuItem
                          key={i}
                          disabled={presetDisabled}
                          title={presetDisabled ? t("orders.toolbar.statusSortOptionDisabledLive") : undefined}
                          onClick={() => {
                            if (!presetDisabled) setSort(preset);
                          }}
                          className={sortsEqual(sort, preset) ? "bg-accent" : ""}
                        >
                          {t(sortOptionLabelKey(preset))}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1" title={t("orders.toolbar.customizeColumns")} disabled={locked}>
                      <Columns3 className="h-3.5 w-3.5" />
                      <span className="text-xs text-muted-foreground">{Object.values(visibleCols).filter(Boolean).length}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[520px] p-0" sideOffset={6}>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                      <div className="text-sm font-medium">{t("orders.toolbar.customizeColumns")}</div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                        const none: Record<string, boolean> = {};
                        COLUMN_META.forEach((c) => { none[c.key] = c.key === "order_number" || c.key === "status" || c.key === "total"; });
                        setVisibleCols(none as Record<ColumnKey, boolean>);
                      }}>
                        {t("orders.toolbar.reset")}
                      </Button>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto p-4">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                        {(() => {
                          const grouped: Record<string, (typeof columnsDef)[number][]> = {};
                          columnsDef.forEach((c) => {
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
                                  const isActive = sort.field === c.sortable;
                                  const SortIcon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                                  const sortDisabled = liveOrdersMode && c.sortable === "status";
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
                                        disabled={sortDisabled}
                                        title={sortDisabled ? t("orders.toolbar.statusSortDisabledLive") : undefined}
                                        onClick={() => {
                                          if (sortDisabled) return;
                                          const nextDir: SortDirection = isActive && sort.direction === "desc" ? "asc" : "desc";
                                          setSort({ field: c.sortable!, direction: nextDir });
                                        }}
                                        className={`inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"} disabled:opacity-40 disabled:pointer-events-none`}
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
                <span className="font-medium">{formatNumber(orderCount, i18n.language)}</span>
              </div>
              {orderCount > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{t("orders.toolbar.batch")}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1" title={t("orders.toolbar.rowsPerScroll")}>{pageSize}</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <DropdownMenuItem key={n} onClick={() => setPageSize(n)} className={pageSize === n ? "bg-accent" : ""}>{n}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="whitespace-nowrap">
                      {formatNumber(orders.length, i18n.language)} of {formatNumber(orderCount, i18n.language)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          </CardContent>
        </Card>
        <ProgressSlot />
      </div>

      <Card className="relative">
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border ${overLimit ? "bg-destructive/5" : "bg-primary/5"}`}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">{selectedIds.size}</Badge>
                <span className="text-xs font-medium">{t("orders.bulk.selected")}</span>
                {overLimit && (
                  <span className="text-[11px] text-destructive ml-1">{t("orders.bulk.maxLimit", { max: MAX_BULK })}</span>
                )}
              </div>
              <div className="flex-1" />
              <Button size="sm" variant="default" className="h-8 text-xs gap-1.5" onClick={() => setPrintDialogOpen(true)} disabled={overLimit}>
                <Printer className="h-3.5 w-3.5" />
                {t("orders.bulk.printInvoices")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("orders.bulk.markStatus")}
                    <ChevronRight className="h-3 w-3 rotate-90 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("orders.bulk.changeStatusTo")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {bulkStatusChoices.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setTimeout(() => setBulkAction({ type: "update_status", status: s }), 0)} className="text-xs max-w-[280px]">
                      <span className="truncate" title={s}>{orderStatusDisplayLabel(t, s)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="destructive" className="h-8 text-xs gap-1.5" onClick={() => setTimeout(() => setBulkAction({ type: "delete" }), 0)} disabled={overLimit}>
                <Trash2 className="h-3.5 w-3.5" />
                {t("orders.bulk.delete")}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5" />
                {t("orders.bulk.clear")}
              </Button>
            </div>
          )}
          {showInitialLoading && orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              {t("orders.empty.loading")}
            </div>
          ) : orders.length === 0 ? (
            hasActiveFilters ? (
              <EmptyState
                illustration={<NoSearchResultsIllustration className="w-full h-full" />}
                title={t("orders.empty.noMatch")}
                description={t("orders.empty.noMatchDescription")}
              />
            ) : activeSync ? (
              <div className="p-8 text-center">
                <Loader2 className="h-10 w-10 mx-auto text-primary/60 mb-2 animate-spin" />
                <p className="text-sm font-medium">{t("orders.empty.syncing")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("orders.empty.syncProgress", { percent: activeSync.progress })}</p>
              </div>
            ) : (
              <EmptyState
                illustration={<NoOrdersIllustration className="w-full h-full" />}
                title={t("orders.empty.title")}
                description={t("orders.empty.description")}
              />
            )
          ) : (
            <div className={cn("overflow-x-auto transition-opacity duration-150", isFetching && !loading && orders.length > 0 && "opacity-70")}>
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
                      const headerSortDisabled = liveOrdersMode && c.sortable === "status";
                      return (
                        <TableHead key={c.key} className={`cursor-move select-none ${dragKey === c.key ? "opacity-50" : ""}`} {...dragProps}>
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-medium truncate">{c.label}</span>
                            {isSortable ? (
                              <button
                                type="button"
                                disabled={headerSortDisabled}
                                title={headerSortDisabled ? t("orders.toolbar.statusSortDisabledLive") : undefined}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (headerSortDisabled) return;
                                  const nextDir: SortDirection = isActive && sort.direction === "desc" ? "asc" : "desc";
                                  setSort({ field: c.sortable!, direction: nextDir });
                                }}
                                className={`inline-flex items-center justify-center h-3.5 w-3.5 shrink-0 rounded border border-border bg-background hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                              >
                                <SortIcon className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/30" />
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
                    const pending = isPending(o);
                    return (
                      <React.Fragment key={o.id}>
                        <TableRow className={`hover:bg-muted/30 cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_52px] ${isExpanded ? "bg-muted/30" : ""} ${isSelected ? "bg-primary/5" : ""} ${pending ? "opacity-60" : ""}`} onClick={() => { if (pending) { showLockedToast(o); return; } setExpandedRowId((cur) => (cur === o.id ? null : o.id)); }}>
                          <TableCell className="w-8 pl-3 pr-0" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSelected} disabled={locked || pending} onCheckedChange={() => { if (locked || pending) return; toggleSelect(o.id); }} />
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
                              const s = resolveStatusVisual(o.status);
                              const SIcon = s.Icon;
                              const label = o.status ? orderStatusDisplayLabel(t, o.status) : "—";
                              return (
                                <TableCell key={c.key}>
                                  <span className={`inline-flex items-center gap-1.5 min-h-6 max-w-[11rem] px-2 rounded-full text-[11px] font-medium ring-1 ring-inset ${s.wrap}`}>
                                    <SIcon className="h-3 w-3 shrink-0" />
                                    <span className="truncate min-w-0" title={o.status || undefined}>{label}</span>
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
                            if (c.key === "actions") {
                              const status = o.status || "";
                              const isFinalState = status === "completed" || status === "cancelled" || status === "refunded";
                              const isCompleting = completingId === o.id;
                              return (
                                <TableCell key={c.key} className="hidden md:table-cell sticky right-0 bg-background/95 backdrop-blur z-10" onClick={(e) => e.stopPropagation()}>
                                  <TooltipProvider delayDuration={150}>
                                    <div className="inline-flex items-center gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            disabled={isFinalState || isCompleting}
                                            onClick={() => handleMarkComplete(o.id)}
                                            className={cn(
                                              "inline-flex items-center justify-center h-7 w-7 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                                              isFinalState
                                                ? "border-border bg-background text-muted-foreground"
                                                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40",
                                            )}
                                          >
                                            {isCompleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>{isFinalState ? `Already ${status}` : "Mark complete"}</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            disabled={!defaultInvoice}
                                            onClick={() => handlePrintTemplate(defaultInvoice?.id, o.id, "invoice")}
                                            className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-background hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                          >
                                            <Receipt className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>{defaultInvoice ? "Print invoice" : "No invoice template"}</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            disabled={!defaultPickslip}
                                            onClick={() => handlePrintTemplate(defaultPickslip?.id, o.id, "pickslip")}
                                            className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-background hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                          >
                                            <ClipboardList className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>{defaultPickslip ? "Print pick slip" : "No pick slip template"}</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                </TableCell>
                              );
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
                                  returnTo={router.asPath || `/sites/${storeId}/orders`}
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
              <InfiniteScrollSentinel
                hasMore={hasNextPage}
                isLoading={isFetchingNextPage}
                onLoadMore={handleLoadMore}
                loaded={orders.length}
                total={orderCount}
              />
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
                ? t("orders.bulk.dialog.deleteTitle", { count: selectedIds.size })
                : t("orders.bulk.dialog.updateTitle", { count: selectedIds.size, status: bulkAction?.type === "update_status" ? bulkAction.status : "" })}
            </DialogTitle>
            <DialogDescription>
              {t("orders.bulk.dialog.description", { count: selectedIds.size, minMinutes: Math.ceil(selectedIds.size * 1.5 / 60), maxMinutes: Math.ceil(selectedIds.size * 3 / 60) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)} disabled={bulkSubmitting}>{t("orders.bulk.dialog.cancel")}</Button>
            <Button
              onClick={submitBulk}
              disabled={bulkSubmitting}
              variant={bulkAction?.type === "delete" ? "destructive" : "default"}
            >
              {bulkSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("orders.bulk.dialog.queueing")}</> : t("orders.bulk.dialog.queueJob")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PrintInvoicesDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        storeId={storeId}
        orderIds={Array.from(selectedIds)}
        onQueued={() => setSelectedIds(new Set())}
      />
    </div>
  );
}