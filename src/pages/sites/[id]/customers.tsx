import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
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
  Search,
  Columns3,
  ArrowUpDown,
  Download,
  Users,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  FilterX,
  UserPlus,
  Eye,
  Pencil,
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
  type CustomerRow,
  type CustomerSortField,
  type SortDirection,
} from "@/services/customerService";
import { fetchPreferences, savePreferences } from "@/services/viewPreferencesService";
import { useToast } from "@/hooks/use-toast";
import { SyncPill } from "@/components/ui/sync-pill";
import { EmptyState } from "@/components/EmptyState";
import { NoCustomersIllustration } from "@/components/illustrations/EmptyIllustrations";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";
import { TableLoadingOverlay } from "@/components/ui/table-loading-overlay";
import { useLoadingEffect, ProgressSlot } from "@/contexts/LoadingProvider";
import { useExplorerKeyboard } from "@/hooks/useExplorerKeyboard";
import { cn } from "@/lib/utils";
import { useSyncUrl, getQueryString } from "@/hooks/useUrlState";

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

const COLUMNS: { key: ColumnKey; group: string; numeric?: boolean }[] = [
  { key: "name", group: "Customer" },
  { key: "username", group: "Customer" },
  { key: "email", group: "Customer" },
  { key: "phone", group: "Customer" },
  { key: "orders", group: "Activity", numeric: true },
  { key: "spent", group: "Activity", numeric: true },
  { key: "aov", group: "Activity", numeric: true },
  { key: "city", group: "Location" },
  { key: "country", group: "Location" },
  { key: "registered", group: "Activity" },
  { key: "last_active", group: "Activity" },
];

const SORT_OPTIONS: { field: CustomerSortField; direction: SortDirection; key: string }[] = [
  { field: "date_created", direction: "desc", key: "newestRegistered" },
  { field: "date_created", direction: "asc", key: "oldestRegistered" },
  { field: "total_spent", direction: "desc", key: "highestSpent" },
  { field: "total_spent", direction: "asc", key: "lowestSpent" },
  { field: "orders_count", direction: "desc", key: "mostOrders" },
  { field: "orders_count", direction: "asc", key: "fewestOrders" },
  { field: "name", direction: "asc", key: "nameAsc" },
  { field: "name", direction: "desc", key: "nameDesc" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000];

function formatMoney(v: number | string | null | undefined, currency = "KWD") {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n || isNaN(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

function CustomerRowExpanded({ customer, storeId }: { customer: CustomerRow; storeId: string }) {
  const { t } = useTranslation("site");
  const { data: lastOrders = [] } = useCustomerLastOrders(storeId, customer.woo_id, 3);
  const billing = getCustomerBilling(customer);
  const addr = [billing.address_1, billing.city, billing.state, billing.country].filter(Boolean).join(", ");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-6 p-5 border-t border-border">
      <div className="space-y-4 min-w-0">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("customers.expanded.lastOrders")}</div>
          {lastOrders.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">{t("customers.expanded.noOrders")}</div>
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
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("customers.expanded.billingAddress")}</div>
            <div className="text-xs text-foreground/80">{addr}</div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("customers.expanded.actions")}</div>
        <Link
          href={`/sites/${storeId}/customers/${customer.id}`}
          className="flex items-center gap-2 px-3 h-10 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="font-medium">{t("customers.expanded.viewDetails")}</span>
          <span className="ml-auto">→</span>
        </Link>
        <Link
          href={`/sites/${storeId}/customers/${customer.id}?edit=1`}
          className="flex items-center gap-2 px-3 h-10 rounded-md text-sm border border-border bg-background hover:bg-muted transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>{t("customers.expanded.editCustomer")}</span>
          <span className="ml-auto text-muted-foreground">→</span>
        </Link>
      </div>
    </div>
  );
}

function CustomersInner() {
  const { t } = useTranslation("site");
  const router = useRouter();
  const storeId = typeof router.query.id === "string" ? router.query.id : "";
  const { toast } = useToast();
  const { locked } = useSyncLocked(storeId);

  const [search, setSearch] = useState(() => getQueryString(router.query, "q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => getQueryString(router.query, "q") ?? "");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const v = parseInt(localStorage.getItem("customers-page-size") || "50", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 50;
  });
  const [sort, setSort] = useState(SORT_OPTIONS[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prefsLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSyncUrl({ q: debouncedSearch }, { q: "" });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("customers-page-size", String(pageSize));
  }, [pageSize]);

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    const defaults: Record<ColumnKey, boolean> = {
      name: true, username: true, email: true, phone: true, orders: true,
      spent: true, aov: true, city: true, country: true, registered: false, last_active: false,
    };
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("customers-visible-cols");
        if (saved) return { ...defaults, ...JSON.parse(saved) };
      } catch { /* ignore */ }
    }
    return defaults;
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("customers-visible-cols", JSON.stringify(visibleCols));
  }, [visibleCols]);

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

  useEffect(() => {
    if (prefsLoaded.current) return;
    fetchPreferences("customers").then((remote) => {
      if (remote) {
        if (Array.isArray(remote.columnOrder)) setColumnOrder(remote.columnOrder as ColumnKey[]);
        if (remote.visibleCols && typeof remote.visibleCols === "object") setVisibleCols((cur) => ({ ...cur, ...(remote.visibleCols as Record<ColumnKey, boolean>) }));
        if (typeof remote.pageSize === "number") setPageSize(remote.pageSize);
        if (remote.sort && typeof remote.sort === "object") setSort(remote.sort as typeof SORT_OPTIONS[number]);
      }
      prefsLoaded.current = true;
    }).catch(() => { prefsLoaded.current = true; });
  }, []);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferences("customers", { columnOrder, visibleCols, pageSize, sort }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [columnOrder, visibleCols, pageSize, sort]);

  const visibleColList = useMemo(
    () => columnOrder
      .map((k) => COLUMNS.find((c) => c.key === k))
      .filter((c): c is typeof COLUMNS[number] => !!c && visibleCols[c.key]),
    [visibleCols, columnOrder]
  );

  const { data: result, isLoading, isFetching } = useCustomers({
    storeId,
    page,
    pageSize,
    search: debouncedSearch,
    sortField: sort.field,
    sortDirection: sort.direction,
  });
  const customers = result?.data ?? [];
  const count = result?.count ?? 0;
  const showRefetchOverlay = isFetching && !isLoading && customers.length > 0;
  useLoadingEffect(isFetching);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExplorerKeyboard({
    searchRef: searchInputRef,
    onPrev: () => { if (page > 0 && !isFetching) setPage((p) => Math.max(0, p - 1)); },
    onNext: () => { if ((page + 1) * pageSize < count && !isFetching) setPage((p) => p + 1); },
  });

  const hasActiveFilters = !!search;

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
    toast({ title: t("customers.toolbar.exported"), description: t("customers.toolbar.exportedCount", { count: customers.length }) });
  }, [customers, storeId, toast, t]);

  return (
    <div className="space-y-3">
      <SyncLockBanner storeId={storeId} />
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur relative">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`${t("customers.toolbar.sort")}: ${t(`customers.sortOptions.${sort.key}`)}`}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("customers.toolbar.sort")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{t("customers.toolbar.sortBy")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((opt, i) => (
                  <DropdownMenuItem key={i} onClick={() => setSort(opt)} className={sort === opt ? "bg-accent" : ""}>{t(`customers.sortOptions.${opt.key}`)}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5" onClick={() => { setSearch(""); }}>
                <FilterX className="h-3.5 w-3.5" />
                {t("customers.toolbar.clear")}
              </Button>
            )}
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="w-full max-w-[320px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input ref={searchInputRef} placeholder={t("customers.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-12 h-9" />
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={locked} title={locked ? t("customers.toolbar.lockedHint") : t("customers.toolbar.customizeColumns")}>
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("customers.toolbar.columns")}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{Object.values(visibleCols).filter(Boolean).length}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[420px] p-0" sideOffset={6}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="text-sm font-medium">{t("customers.toolbar.customizeColumns")}</div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    const def: Record<string, boolean> = {};
                    COLUMNS.forEach((c) => { def[c.key] = c.key !== "registered" && c.key !== "last_active"; });
                    setVisibleCols(def as Record<ColumnKey, boolean>);
                    setColumnOrder(COLUMNS.map((c) => c.key));
                  }}>{t("customers.toolbar.reset")}</Button>
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
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1.5 border-b border-border">{t(`customers.columnGroups.${group}`)}</div>
                          <div className="flex flex-col gap-0.5">
                            {cols.map((c) => (
                              <label key={c.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted cursor-pointer text-[13px]">
                                <Checkbox checked={visibleCols[c.key]} onCheckedChange={(v) => setVisibleCols((prev) => ({ ...prev, [c.key]: !!v }))} />
                                <span className="truncate">{t(`customers.columns.${c.key}`)}</span>
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
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={customers.length === 0 || locked} onClick={handleExport} title={locked ? t("customers.toolbar.lockedHint") : t("customers.toolbar.exportCsv")}>
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">{t("customers.toolbar.export")}</span>
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background h-9 px-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium">{count.toLocaleString()}</span>
              </div>
              {count > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{t("customers.toolbar.rows")}:</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1">{pageSize}</Button>
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
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || isFetching}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= count || isFetching}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button size="sm" className="h-9 px-3 gap-1.5" asChild disabled={locked}>
              <Link href={`/sites/${storeId}/customers/new`} aria-disabled={locked} tabIndex={locked ? -1 : undefined} onClick={(e) => { if (locked) e.preventDefault(); }} className={locked ? "pointer-events-none opacity-50" : ""}>
                <UserPlus className="h-3.5 w-3.5" />
                <span className="text-xs">{t("customers.newCustomer")}</span>
              </Link>
            </Button>
          </div>
        </div>
        <ProgressSlot />
      </div>

      <Card className="relative">
        <CardContent className="p-0">
          <div className={cn("overflow-x-auto transition-opacity duration-150", isFetching && !isLoading && customers.length > 0 && "opacity-70")}>
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
                          {t(`customers.columns.${c.key}`)}
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
                    <TableCell colSpan={visibleColList.length} className="py-8">
                      <EmptyState
                        illustration={<NoCustomersIllustration className="w-full h-full" />}
                        title={t("customers.empty.title")}
                        description={t("customers.empty.description")}
                      />
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
                          className={`bg-card hover:bg-muted/50 cursor-pointer ${isExpanded ? "bg-muted/50 border-b-0 hover:bg-muted/50" : ""}`}
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
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="font-medium truncate">{name}</div>
                                        <SyncPill entityType="customer" entityId={c.id} />
                                      </div>
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
                          <TableRow className="bg-muted/50 hover:bg-muted/50" data-expanded-row={c.id}>
                            <TableCell colSpan={visibleColList.length} className="p-0">
                              <div onClick={(e) => e.stopPropagation()}>
                                <CustomerRowExpanded
                                  customer={c}
                                  storeId={storeId}
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
        <TableLoadingOverlay show={showRefetchOverlay} />
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

export async function getServerSideProps({ locale }: { locale?: string }) {
  const { serverSideTranslations } = await import("next-i18next/serverSideTranslations");
  return { props: { ...(await serverSideTranslations(locale || "en", ["common", "site"])) } };
}