import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
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
import Link from "next/link";
import { Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, Package, Layers, ImageIcon, LayoutGrid, List, Grid3x3, ChevronDown, GripVertical, Search, Pencil, Plus, FilterX, Cloud } from "lucide-react";
import {
  getProductThumbnail,
  getCategoryNames,
  type ProductRow,
  type ProductSortField,
  type SortDirection,
} from "@/services/productService";
import { fetchPreferences, savePreferences } from "@/services/viewPreferencesService";
import { ProductQuickEdit } from "@/components/explore/ProductQuickEdit";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts, useProductBrandOptions, useProductCategoryOptions, useProductTagOptions } from "@/hooks/queries/useProducts";
import { useAllActiveSyncs } from "@/hooks/queries/useAllActiveSyncs";
import { InfiniteScrollSentinel } from "@/components/explore/InfiniteScrollSentinel";
import { queryKeys } from "@/lib/query-client";
import { normalizeNumberInput, normalizeSelectFilter } from "@/lib/normalize-explorer-filters";
import { useQueryClient } from "@tanstack/react-query";
import { createBulkJob } from "@/services/bulkJobService";
import { Tags, Building2, Tag as TagIcon, Trash2, X, CheckCircle2, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/router";
import { SyncPill } from "@/components/ui/sync-pill";
import { EmptyState } from "@/components/EmptyState";
import { NoProductsIllustration } from "@/components/illustrations/EmptyIllustrations";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";
import { ProgressSlot } from "@/contexts/LoadingProvider";
import { useExplorerKeyboard } from "@/hooks/useExplorerKeyboard";
import { cn } from "@/lib/utils";
import { logClientAuditEvent } from "@/lib/audit/client-log";
import { useSyncUrl, getQueryString } from "@/hooks/useUrlState";
import { ProductTypeDialog } from "@/components/product-edit/ProductTypeDialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";
import {
  PRODUCT_CATALOG_COLUMNS as COLUMNS,
  type CatalogColumnKey as ColumnKey,
} from "@/lib/product-catalog-columns";
import {
  catalogCellClass,
  catalogCellDisplay,
  catalogCellTextClass,
  productsColumnDensityClass,
  stripHtmlForTablePreview,
} from "@/lib/product-catalog-cell-display";
import { supabase } from "@/integrations/supabase/client";
import { isCloudflareDeliveryUrl } from "@/lib/product-image-urls";
import { useCfDebugBadge } from "@/hooks/useCfDebugBadge";

const PRODUCTS_TABLE_LAYOUT_VERSION = 1;

function migrateProductsTableLayoutPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("products-layout-version");
    const stored = raw ? Number.parseInt(raw, 10) : 0;
    if (Number.isFinite(stored) && stored >= PRODUCTS_TABLE_LAYOUT_VERSION) return;
    localStorage.removeItem("explore-col-order");
    localStorage.removeItem("explore-visible-cols");
    localStorage.setItem("products-layout-version", String(PRODUCTS_TABLE_LAYOUT_VERSION));
  } catch {
    /* ignore */
  }
}

const PENDING_LABELS: Record<string, string> = {
  delete: "Scheduled for deletion",
  status_change: "Scheduled for status change",
  price_update: "Scheduled for price update",
  stock_update: "Scheduled for stock update",
  category_update: "Scheduled for category update",
  tag_update: "Scheduled for tag update",
  brand_update: "Scheduled for brand update",
};
function pendingLabel(action?: string | null) {
  if (!action) return "";
  return PENDING_LABELS[action] || `Scheduled: ${action}`;
}

const SORT_OPTIONS: { field: ProductSortField; direction: SortDirection; label: string }[] = [
  { field: "woo_date_created", direction: "desc", label: "Newest first" },
  { field: "woo_date_created", direction: "asc", label: "Oldest first" },
  { field: "name", direction: "asc", label: "Name A-Z" },
  { field: "name", direction: "desc", label: "Name Z-A" },
  { field: "price", direction: "desc", label: "Price high to low" },
  { field: "price", direction: "asc", label: "Price low to high" },
  { field: "stock_quantity", direction: "desc", label: "Stock high to low" },
  { field: "stock_quantity", direction: "asc", label: "Stock low to high" },
  { field: "synced_at", direction: "desc", label: "Recently synced" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000];

interface ProductsTabProps {
  storeId: string;
  storeUrl?: string;
  search: string;
  storeName?: string;
  onSearchChange?: (v: string) => void;
  embedHeader?: boolean;
}

function countSelectedProductTypes(products: ProductRow[], selectedIds: Set<string>) {
  if (selectedIds.size === 0) return { simple: 0, variable: 0 };
  let simple = 0;
  let variable = 0;
  for (const p of products) {
    if (!selectedIds.has(p.id)) continue;
    if (p.type === "variable") variable += 1;
    else simple += 1;
  }
  return { simple, variable };
}

function ProductCatalogStringCell({ columnKey, raw }: { columnKey: ColumnKey; raw: string }) {
  const { text, title } = catalogCellDisplay(columnKey, raw);
  return (
    <TableCell className={catalogCellClass(columnKey)}>
      <span className={catalogCellTextClass(columnKey)} title={title}>
        {text}
      </span>
    </TableCell>
  );
}

export function ProductsTab({ storeId, storeUrl, search, storeName, onSearchChange, embedHeader = false }: ProductsTabProps) {
  const cfDebugBadge = useCfDebugBadge();
  const { t, i18n } = useTranslation("site");
  const queryClient = useQueryClient();
  const { locked } = useSyncLocked(storeId);
  const router = useRouter();
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 100;
    const v = parseInt(localStorage.getItem("explore-page-size") || "100", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 100;
  });
  const [viewMode, setViewMode] = useState<"table" | "grid" | "compact">(() => {
    if (typeof window === "undefined") return "table";
    return (localStorage.getItem("explore-view-mode") as "table" | "grid" | "compact") || "table";
  });
  const [quickEditProduct, setQuickEditProduct] = useState<ProductRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<null | "status" | "category" | "tag" | "brand" | "delete">(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [newProductStatus, setNewProductStatus] = useState<"publish" | "draft" | "pending" | "private">("publish");
  const [categoryMode, setCategoryMode] = useState<"add" | "remove" | "replace">("add");
  const [bulkCategoryIds, setBulkCategoryIds] = useState<Set<number>>(new Set());
  const [tagMode, setTagMode] = useState<"add" | "remove" | "replace">("add");
  const [bulkTagIds, setBulkTagIds] = useState<Set<number>>(new Set());
  const [brandMode, setBrandMode] = useState<"add" | "remove" | "replace">("add");
  const [bulkBrandIds, setBulkBrandIds] = useState<Set<number>>(new Set());
  const MAX_BULK = 500;
  const overLimit = selectedIds.size > MAX_BULK;
  const isPending = (p: ProductRow) => !!p.pending_action;
  const { toast } = useToast();
  const showLockedToast = useCallback((p: ProductRow) => {
    toast({ title: pendingLabel(p.pending_action), description: t("products.row.pendingLockTooltip") });
  }, [toast, t]);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-view-mode", viewMode);
  }, [viewMode]);

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    const defaults: Record<ColumnKey, boolean> = {
      image: true, id: false, name: true, status: true, sku: true, price: true,
      regular_price: false, sale_price: false, stock: true, stock_status: false,
      manage_stock: false, category: true, brands: false, type: false, slug: false, wooId: false,
      parent_id: false, permalink: false, tax_status: false, tax_class: false,
      shipping_required: false, images_count: false, short_desc: false, description: false,
      attributes: false, sales: false, date_created: false, date_modified: false,
      created: false, updated: false,
    };
    if (typeof window !== "undefined") {
      migrateProductsTableLayoutPrefs();
      try {
        const saved = localStorage.getItem("explore-visible-cols");
        if (saved) return { ...defaults, ...JSON.parse(saved) };
      } catch { /* ignore */ }
    }
    return defaults;
  });
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    if (typeof window !== "undefined") {
      migrateProductsTableLayoutPrefs();
      try {
        const saved = localStorage.getItem("explore-col-order");
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

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => getQueryString(router.query, "status") ?? "all");
  const [excludeOutOfStock, setExcludeOutOfStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>(() => getQueryString(router.query, "cat") ?? "all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>(() => getQueryString(router.query, "stock") ?? "all");
  const [priceMin, setPriceMin] = useState(() => getQueryString(router.query, "pmin") ?? "");
  const [priceMax, setPriceMax] = useState(() => getQueryString(router.query, "pmax") ?? "");
  const [filterSimple, setFilterSimple] = useState(true);
  const [filterVariable, setFilterVariable] = useState(true);
  const [sort, setSort] = useState(SORT_OPTIONS[0]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-col-order", JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-visible-cols", JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-page-size", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const productTypeFilter = useMemo((): "simple" | "variable" | undefined => {
    if (filterSimple && filterVariable) return undefined;
    if (filterSimple && !filterVariable) return "simple";
    if (!filterSimple && filterVariable) return "variable";
    return undefined;
  }, [filterSimple, filterVariable]);

  const productTypeSegment = useMemo((): "simple" | "all" | "variable" => {
    if (filterSimple && filterVariable) return "all";
    if (filterSimple && !filterVariable) return "simple";
    return "variable";
  }, [filterSimple, filterVariable]);

  useSyncUrl(
    {
      status: statusFilter,
      cat: categoryFilter,
      stock: stockStatusFilter,
      pmin: priceMin,
      pmax: priceMax,
      q: debouncedSearch,
      ptype: productTypeFilter ?? "",
    },
    { status: "all", cat: "all", stock: "all", pmin: "", pmax: "", q: "", ptype: "" },
  );

  const buildReturnTo = useCallback(() => {
    if (typeof window === "undefined") return `/sites/${storeId}/products`;
    return router.asPath || `/sites/${storeId}/products`;
  }, [router, storeId]);

  const normalizedCategoryFilter = normalizeSelectFilter(categoryFilter);
  const normalizedStatusFilter = normalizeSelectFilter(statusFilter) ?? "all";
  const normalizedStockFilter = normalizeSelectFilter(stockStatusFilter) ?? "all";
  const normalizedPriceMin = normalizeNumberInput(priceMin);
  const normalizedPriceMax = normalizeNumberInput(priceMax);

  const {
    data: products,
    count: productCount,
    isLoading: loading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useProducts({
    storeId,
    pageSize,
    search: debouncedSearch,
    sortField: sort.field,
    sortDirection: sort.direction,
    statusFilter: normalizedStatusFilter,
    excludeOutOfStock,
    categoryFilter: normalizedCategoryFilter,
    stockStatusFilter: normalizedStockFilter,
    priceMin: normalizedPriceMin,
    priceMax: normalizedPriceMax,
    productTypeFilter,
    enabled: true,
  });
  const selectionTypeCounts = countSelectedProductTypes(products, selectedIds);
  const showInitialLoading = loading;
  const showRefetchOverlay = isFetching && !showInitialLoading && !isFetchingNextPage && products.length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExplorerKeyboard({ searchRef: searchInputRef });
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const submitBulk = useCallback(async () => {
    if (!bulkDialog || selectedIds.size === 0 || overLimit) return;
    const eligibleProducts = products.filter((p) => selectedIds.has(p.id) && !isPending(p));
    const skippedCount = selectedIds.size - eligibleProducts.length;
    const wooIds = eligibleProducts.map((p) => p.woo_id).filter((id): id is number => id != null);
    if (wooIds.length === 0) {
      toast({ title: t("products.bulk.noEligible"), description: t("products.bulk.noEligibleDesc"), variant: "destructive" });
      return;
    }
    if (skippedCount > 0) {
      toast({ title: t("products.bulk.skipped", { count: skippedCount }), description: t("products.bulk.skippedDesc") });
    }
    setBulkSubmitting(true);
    try {
      if (bulkDialog === "status") {
        await createBulkJob({ store_id: storeId, job_type: "update_product_status", total: wooIds.length, payload: { type: "update_product_status", product_ids: wooIds, new_status: newProductStatus } });
      } else if (bulkDialog === "category") {
        if (bulkCategoryIds.size === 0) { setBulkSubmitting(false); return; }
        await createBulkJob({ store_id: storeId, job_type: "assign_product_categories", total: wooIds.length, payload: { type: "assign_product_categories", product_ids: wooIds, mode: categoryMode, category_ids: Array.from(bulkCategoryIds) } });
      } else if (bulkDialog === "tag") {
        if (bulkTagIds.size === 0) { setBulkSubmitting(false); return; }
        await createBulkJob({ store_id: storeId, job_type: "assign_product_tags", total: wooIds.length, payload: { type: "assign_product_tags", product_ids: wooIds, mode: tagMode, tag_ids: Array.from(bulkTagIds) } });
      } else if (bulkDialog === "brand") {
        if (bulkBrandIds.size === 0) { setBulkSubmitting(false); return; }
        await createBulkJob({ store_id: storeId, job_type: "assign_product_brands", total: wooIds.length, payload: { type: "assign_product_brands", product_ids: wooIds, mode: brandMode, brand_ids: Array.from(bulkBrandIds) } });
      } else if (bulkDialog === "delete") {
        await createBulkJob({ store_id: storeId, job_type: "delete_products", total: wooIds.length, payload: { type: "delete_products", product_ids: wooIds, force: false } });
        const deleteSet = new Set(wooIds);
        queryClient.setQueriesData({ queryKey: queryKeys.products(storeId) }, (prev: unknown) => {
          if (!prev || typeof prev !== "object") return prev;
          const inf = prev as { pages?: { data: ProductRow[]; count: number }[]; pageParams?: unknown[] };
          if (Array.isArray(inf.pages)) {
            let removedTotal = 0;
            const newPages = inf.pages.map((pg) => {
              const filtered = pg.data.filter((p) => !deleteSet.has(p.woo_id ?? -1));
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
          const cur = prev as { data?: ProductRow[]; count?: number };
          if (Array.isArray(cur.data)) {
            const filtered = cur.data.filter((p) => !deleteSet.has(p.woo_id ?? -1));
            const removed = cur.data.length - filtered.length;
            return { ...cur, data: filtered, count: Math.max(0, (cur.count ?? 0) - removed) };
          }
          return prev;
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.products(storeId) });
      setSelectedIds(new Set());
      setBulkDialog(null);
      setBulkCategoryIds(new Set());
      setBulkTagIds(new Set());
      setBulkBrandIds(new Set());
    } catch (err) {
      console.error("[bulk]", err);
    } finally {
      setBulkSubmitting(false);
    }
  }, [
    bulkDialog,
    selectedIds,
    overLimit,
    products,
    storeId,
    newProductStatus,
    categoryMode,
    bulkCategoryIds,
    tagMode,
    bulkTagIds,
    brandMode,
    bulkBrandIds,
    queryClient,
    t,
    toast,
  ]);

  useEffect(() => { setSelectedIds(new Set()); }, [storeId, pageSize]);

  const setProducts = (_updater: (prev: ProductRow[]) => ProductRow[]) => {
    // Inline mutations should invalidate query; placeholder no-op.
  };
  void setProducts;

  const visibleColList = useMemo(
    () => columnOrder
      .map((k) => COLUMNS.find((c) => c.key === k))
      .filter((c): c is typeof COLUMNS[number] => !!c && visibleCols[c.key]),
    [visibleCols, columnOrder]
  );

  const runExport = useCallback(async (format: "csv" | "xlsx" | "pdf") => {
    if (locked || exportingRef.current || productCount <= 0) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast({ title: t("products.export.signIn"), variant: "destructive" });
        return;
      }
      const cols = visibleColList.filter((c) => c.key !== "image").map((c) => c.key).join(",");
      const qs = new URLSearchParams();
      qs.set("format", format);
      if (cols) qs.set("cols", cols);
      if (debouncedSearch) qs.set("search", debouncedSearch);
      if (normalizedStatusFilter !== "all") qs.set("status", normalizedStatusFilter);
      if (excludeOutOfStock) qs.set("exclude_out_of_stock", "1");
      if (normalizedCategoryFilter) qs.set("cat", normalizedCategoryFilter);
      if (normalizedStockFilter !== "all") qs.set("stock", normalizedStockFilter);
      if (normalizedPriceMin != null) qs.set("pmin", String(normalizedPriceMin));
      if (normalizedPriceMax != null) qs.set("pmax", String(normalizedPriceMax));
      if (productTypeFilter === "simple" || productTypeFilter === "variable") qs.set("ptype", productTypeFilter);
      qs.set("sort_field", sort.field);
      qs.set("sort_direction", sort.direction);

      const res = await fetch(`/api/stores/${storeId}/products/export?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string; maxRows?: number };
        if (err.code === "pdf_row_limit") {
          toast({
            title: t("products.export.failed"),
            description: t("products.export.pdfTooManyRows", { max: err.maxRows ?? 2500 }),
            variant: "destructive",
          });
          return;
        }
        throw new Error(err.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const rowCount = res.headers.get("X-Export-Row-Count");
      const truncated = res.headers.get("X-Export-Truncated") === "1";
      const rowLimitHdr = res.headers.get("X-Export-Row-Limit");
      const rowLimit = rowLimitHdr ? Number(rowLimitHdr) : 50_000;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "csv" ? "csv" : format === "xlsx" ? "xlsx" : "pdf";
      a.download = `products-export.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      void logClientAuditEvent({
        action: "sites.product.export",
        entityType: "store",
        entityId: storeId,
        storeId,
        metadata: {
          format,
          row_count: rowCount ? Number(rowCount) : undefined,
        },
      });
      toast({
        title: t("products.export.ready"),
        description: truncated
          ? t("products.export.truncatedDesc", { count: rowCount || "—", max: rowLimit })
          : t("products.export.readyDesc", { count: rowCount || "—" }),
      });
    } catch (e) {
      toast({
        title: t("products.export.failed"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [
    locked,
    productCount,
    visibleColList,
    debouncedSearch,
    normalizedStatusFilter,
    excludeOutOfStock,
    normalizedCategoryFilter,
    normalizedStockFilter,
    normalizedPriceMin,
    normalizedPriceMax,
    sort.field,
    sort.direction,
    storeId,
    toast,
    t,
    productTypeFilter,
  ]);

  const { data: categoryOptions = [] } = useProductCategoryOptions(storeId);
  const { data: tagOptions = [] } = useProductTagOptions(storeId);
  const { data: brandOptions = [] } = useProductBrandOptions(storeId);
  const { data: activeSyncs = [] } = useAllActiveSyncs();
  const activeSync = activeSyncs.find((s) => s.store_id === storeId);
  const prefsLoaded = useRef(false);
  const prefsLoading = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!router.isReady) return;
    const urlStatus = getQueryString(router.query, "status");
    const urlCat = getQueryString(router.query, "cat");
    const urlStock = getQueryString(router.query, "stock");
    const urlPmin = getQueryString(router.query, "pmin");
    const urlPmax = getQueryString(router.query, "pmax");
    const urlPtype = getQueryString(router.query, "ptype");
    if (urlStatus !== undefined) setStatusFilter(urlStatus);
    if (urlCat !== undefined) setCategoryFilter(urlCat);
    if (urlStock !== undefined) setStockStatusFilter(urlStock);
    if (urlPmin !== undefined) setPriceMin(urlPmin);
    if (urlPmax !== undefined) setPriceMax(urlPmax);
    if (urlPtype === "simple") {
      setFilterSimple(true);
      setFilterVariable(false);
    } else if (urlPtype === "variable") {
      setFilterSimple(false);
      setFilterVariable(true);
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    if (prefsLoaded.current || prefsLoading.current) return;
    prefsLoading.current = true;
    const urlStatus = getQueryString(router.query, "status");
    const urlCat = getQueryString(router.query, "cat");
    const urlStock = getQueryString(router.query, "stock");
    const urlPmin = getQueryString(router.query, "pmin");
    const urlPmax = getQueryString(router.query, "pmax");
    const urlPtype = getQueryString(router.query, "ptype");
    fetchPreferences("products").then((remote) => {
      if (remote) {
        const remoteLayoutV = Number((remote as { productsTableLayoutVersion?: unknown }).productsTableLayoutVersion ?? 0);
        const layoutOk = Number.isFinite(remoteLayoutV) && remoteLayoutV >= PRODUCTS_TABLE_LAYOUT_VERSION;
        if (Array.isArray(remote.columnOrder) && layoutOk) {
          const allKeys = COLUMNS.map((c) => c.key);
          const valid = (remote.columnOrder as ColumnKey[]).filter((k) => allKeys.includes(k));
          const missing = allKeys.filter((k) => !valid.includes(k));
          setColumnOrder([...valid, ...missing]);
        }
        if (remote.visibleCols && typeof remote.visibleCols === "object" && layoutOk) {
          setVisibleCols((cur) => ({ ...cur, ...(remote.visibleCols as Record<ColumnKey, boolean>) }));
        }
        if (typeof remote.pageSize === "number") setPageSize(remote.pageSize);
        if (typeof remote.viewMode === "string") setViewMode(remote.viewMode as "table" | "grid" | "compact");
        if (urlStatus === undefined && typeof remote.statusFilter === "string") setStatusFilter(remote.statusFilter);
        if (typeof remote.excludeOutOfStock === "boolean") setExcludeOutOfStock(remote.excludeOutOfStock);
        if (urlCat === undefined && typeof remote.categoryFilter === "string") setCategoryFilter(remote.categoryFilter);
        if (urlStock === undefined && typeof remote.stockStatusFilter === "string") setStockStatusFilter(remote.stockStatusFilter);
        if (urlPtype === undefined) {
          const rp = remote.ptype;
          if (rp === "simple" || rp === "variable") {
            if (rp === "simple") {
              setFilterSimple(true);
              setFilterVariable(false);
            } else {
              setFilterSimple(false);
              setFilterVariable(true);
            }
          }
        }
        if (remote.sort && typeof remote.sort === "object") setSort(remote.sort as typeof SORT_OPTIONS[number]);
      }
      prefsLoaded.current = true;
    }).catch(() => {
      prefsLoaded.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single prefs merge when router becomes ready
  }, [router.isReady]);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferences("products", {
        columnOrder,
        visibleCols,
        pageSize,
        viewMode,
        statusFilter,
        excludeOutOfStock,
        categoryFilter,
        stockStatusFilter,
        sort,
        ptype: productTypeFilter ?? "",
        productsTableLayoutVersion: PRODUCTS_TABLE_LAYOUT_VERSION,
      }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [columnOrder, visibleCols, pageSize, viewMode, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, sort, productTypeFilter]);

  return (
    <div className="space-y-2">
      <SyncLockBanner storeId={storeId} />
      {embedHeader && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={locked}>
              <SelectTrigger className="h-9 w-[180px] text-xs gap-1.5 px-2.5 border-border bg-card shadow-polaris-xs hover:bg-muted">
                <SelectValue placeholder={t("products.filters.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("products.filters.allCategories")}</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-card shadow-polaris-xs px-1 h-9">
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${viewMode === "table" ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background" : ""}`} onClick={() => setViewMode("table")} title={t("products.view.table")}><List className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${viewMode === "grid" ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background" : ""}`} onClick={() => setViewMode("grid")} title={t("products.view.grid")}><LayoutGrid className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${viewMode === "compact" ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background" : ""}`} onClick={() => setViewMode("compact")} title={t("products.view.compact")}><Grid3x3 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-[360px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input ref={searchInputRef} placeholder={t("products.search")} value={search} onChange={(e) => onSearchChange?.(e.target.value)} className="pl-9 pr-12 h-9" />
                {!search && (
                  <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">⌘K</kbd>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`${t("products.toolbar.sort")}: ${sort.label}`}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("products.toolbar.sort")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("products.toolbar.sortBy")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((opt, i) => (
                  <DropdownMenuItem key={i} onClick={() => setSort(opt)} className={sort === opt ? "bg-foreground/10" : ""}>{opt.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={locked} title={locked ? t("products.toolbar.lockedHint") : t("products.toolbar.customizeColumns")}>
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("products.toolbar.columns")}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{Object.values(visibleCols).filter(Boolean).length}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[560px] p-0" sideOffset={6}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="text-sm font-medium">{t("products.toolbar.customizeColumns")}</div>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-4">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                    {(() => {
                      const groupMap: Record<string, string> = {
                        Basic: "Product", Pricing: "Pricing & Inventory", Inventory: "Pricing & Inventory",
                        "Tax & Shipping": "Pricing & Inventory", Taxonomy: "Content & Dates", Content: "Content & Dates", Dates: "Content & Dates",
                      };
                      const grouped: Record<string, typeof COLUMNS> = {};
                      COLUMNS.forEach((c) => {
                        const g = groupMap[c.group] || c.group;
                        if (!grouped[g]) grouped[g] = [];
                        grouped[g].push(c);
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 gap-1.5"
                  disabled={productCount === 0 || locked || exporting}
                  title={locked ? t("products.toolbar.lockedHint") : t("products.toolbar.export")}
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  <span className="text-xs">{t("products.toolbar.export")}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void runExport("xlsx")}>{t("products.export.excel")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void runExport("csv")}>{t("products.export.csv")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void runExport("pdf")}>{t("products.export.pdf")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href={{ pathname: `/sites/${storeId}/products/new`, query: { returnTo: buildReturnTo() } }} aria-disabled={locked} tabIndex={locked ? -1 : undefined} onClick={(e) => { if (locked) e.preventDefault(); }} className={locked ? "pointer-events-none opacity-50" : ""}>
              <Button size="sm" className="h-9 gap-1.5" onClick={(e) => { if (!locked) { e.preventDefault(); setTypeDialogOpen(true); } }}>
                <Plus className="h-4 w-4" />
                {t("products.addProduct")}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 -mx-6 px-6 pt-2 pb-1 bg-background/85 backdrop-blur border-b border-border [[data-theme-preset=modern]_&]:border-b-0 [[data-theme-preset=modern]_&]:pb-0 relative">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-md border border-border bg-background px-1 h-9">
                {[
                  { value: "all", label: "All stock" },
                  { value: "instock", label: "In stock" },
                  { value: "outofstock", label: "Out of stock" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs px-2.5 ${stockStatusFilter === opt.value ? "bg-foreground/10 text-foreground font-medium hover:bg-foreground/15" : ""}`}
                    onClick={() => { setStockStatusFilter(opt.value); setExcludeOutOfStock(false); }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={locked}>
                <SelectTrigger className="h-9 w-[140px] text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="publish">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
              <div
                className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 h-9 gap-0.5"
                role="tablist"
                aria-label={t("products.filters.productType")}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={productTypeSegment === "simple"}
                  title={t("products.filters.typeSimple")}
                  disabled={locked}
                  onClick={() => {
                    setFilterSimple(true);
                    setFilterVariable(false);
                  }}
                  className={cn(
                    "h-8 shrink-0 rounded-md px-2 sm:px-2.5 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1",
                    productTypeSegment === "simple"
                      ? "bg-orange-500 text-white shadow-sm hover:bg-orange-500"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{t("products.filters.typeSimpleShort")}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={productTypeSegment === "all"}
                  title={t("products.filters.typeAllHint")}
                  disabled={locked}
                  onClick={() => {
                    setFilterSimple(true);
                    setFilterVariable(true);
                  }}
                  className={cn(
                    "h-8 shrink-0 rounded-md px-2.5 sm:px-3 text-xs font-medium transition-colors tabular-nums",
                    productTypeSegment === "all"
                      ? "bg-orange-500 text-white shadow-sm hover:bg-orange-500"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  {t("products.filters.typeAll")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={productTypeSegment === "variable"}
                  title={t("products.filters.typeVariable")}
                  disabled={locked}
                  onClick={() => {
                    setFilterSimple(false);
                    setFilterVariable(true);
                  }}
                  className={cn(
                    "h-8 shrink-0 rounded-md px-2 sm:px-2.5 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1",
                    productTypeSegment === "variable"
                      ? "bg-orange-500 text-white shadow-sm hover:bg-orange-500"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{t("products.filters.typeVariableShort")}</span>
                </button>
              </div>
              {!embedHeader && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={locked}>
                  <SelectTrigger className="h-9 w-[180px] text-xs">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(excludeOutOfStock || statusFilter !== "all" || categoryFilter !== "all" || stockStatusFilter !== "all" || priceMin || priceMax || !(filterSimple && filterVariable)) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5" onClick={() => {
                  setStatusFilter("all"); setExcludeOutOfStock(false); setCategoryFilter("all");
                  setStockStatusFilter("all"); setPriceMin(""); setPriceMax("");
                  setFilterSimple(true); setFilterVariable(true);
                }}>
                  <FilterX className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-2 ml-auto">
                {!embedHeader && (
                  <>
                    <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 h-9">
                      <Button variant="ghost" size="sm" className={`h-7 px-2 ${viewMode === "table" ? "bg-foreground/10 hover:bg-foreground/15" : ""}`} onClick={() => setViewMode("table")} title="Table view"><List className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className={`h-7 px-2 ${viewMode === "grid" ? "bg-foreground/10 hover:bg-foreground/15" : ""}`} onClick={() => setViewMode("grid")} title="Grid view"><LayoutGrid className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className={`h-7 px-2 ${viewMode === "compact" ? "bg-foreground/10 hover:bg-foreground/15" : ""}`} onClick={() => setViewMode("compact")} title="Compact grid"><Grid3x3 className="h-3.5 w-3.5" /></Button>
                    </div>
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
                          <DropdownMenuItem key={i} onClick={() => setSort(opt)} className={sort === opt ? "bg-foreground/10" : ""}>{opt.label}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={locked} title={locked ? "Available after initial sync completes" : "Customize columns"}>
                          <Columns3 className="h-3.5 w-3.5" />
                          <span className="text-xs">Columns</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{Object.values(visibleCols).filter(Boolean).length}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[560px] p-0" sideOffset={6}>
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                          <div className="text-sm font-medium">Customize columns</div>
                        </div>
                        <div className="max-h-[420px] overflow-y-auto p-4">
                          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                            {(() => {
                              const groupMap: Record<string, string> = {
                                Basic: "Product", Pricing: "Pricing & Inventory", Inventory: "Pricing & Inventory",
                                "Tax & Shipping": "Pricing & Inventory", Taxonomy: "Content & Dates", Content: "Content & Dates", Dates: "Content & Dates",
                              };
                              const grouped: Record<string, typeof COLUMNS> = {};
                              COLUMNS.forEach((c) => {
                                const g = groupMap[c.group] || c.group;
                                if (!grouped[g]) grouped[g] = [];
                                grouped[g].push(c);
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-2.5 gap-1.5"
                          disabled={productCount === 0 || locked || exporting}
                          title={locked ? t("products.toolbar.lockedHint") : t("products.toolbar.export")}
                        >
                          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          <span className="text-xs">{t("products.toolbar.export")}</span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void runExport("xlsx")}>{t("products.export.excel")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void runExport("csv")}>{t("products.export.csv")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void runExport("pdf")}>{t("products.export.pdf")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
                  <Package className="h-3.5 w-3.5" />
                  <span className="font-medium">{formatNumber(productCount, i18n.language)}</span>
                </div>
                {(productCount > 0 || loading) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 border-l border-border">
                    <span>Batch:</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1" title="Rows fetched per scroll">{pageSize}<ChevronDown className="h-3 w-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <DropdownMenuItem key={n} onClick={() => setPageSize(n)} className={pageSize === n ? "bg-accent" : ""}>{n}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="whitespace-nowrap">
                      {loading && productCount === 0 ? "Loading…" : `${formatNumber(products.length, i18n.language)} of ${formatNumber(productCount, i18n.language)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <ProgressSlot />
          </CardContent>
        </Card>
      </div>

      <Card className="relative">
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border ${overLimit ? "bg-destructive/5" : "bg-primary/5"}`}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">{selectedIds.size}</Badge>
                <span className="text-xs font-medium">{t("products.bulk.selected")}</span>
                {overLimit && <span className="text-[11px] text-destructive ml-1">{t("products.bulk.maxLimit", { max: MAX_BULK })}</span>}
                {locked && <span className="text-[11px] text-warning ml-1">{t("products.bulk.lockedDuringSync")}</span>}
                <div className="flex items-center gap-3 border-l border-border pl-3 ml-1 text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-[11px]" title={t("products.filters.typeSimple")}>
                    <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="font-mono tabular-nums text-foreground">{selectionTypeCounts.simple}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px]" title={t("products.filters.typeVariable")}>
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="font-mono tabular-nums text-foreground">{selectionTypeCounts.variable}</span>
                  </span>
                </div>
              </div>
              <div className="flex-1" />
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("status")}><CheckCircle2 className="h-3.5 w-3.5" />{t("products.bulk.status")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("category")}><TagIcon className="h-3.5 w-3.5" />{t("products.bulk.categories")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("tag")}><Tags className="h-3.5 w-3.5" />{t("products.bulk.tags")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("brand")}><Building2 className="h-3.5 w-3.5" />{t("products.bulk.brands")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={overLimit || locked} onClick={() => setBulkDialog("delete")}><Trash2 className="h-3.5 w-3.5" />{t("products.bulk.delete")}</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setSelectedIds(new Set())}><X className="h-3.5 w-3.5" />{t("products.bulk.clear")}</Button>
            </div>
          )}
          {viewMode !== "table" ? (
            <div className={cn("p-4 transition-opacity duration-150", showRefetchOverlay && "opacity-70")}>
              {(() => {
                const isCompact = viewMode === "compact";
                const gridCls = isCompact
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3"
                  : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";
                if (showInitialLoading) {
                  return (
                    <div className={gridCls}>
                      {Array.from({ length: isCompact ? 14 : 8 }).map((_, i) => (
                        <div key={`skg-${i}`} className="border border-border rounded-lg overflow-hidden bg-card hover:border-primary/50 hover:shadow-md transition cursor-pointer">
                          <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                            <Skeleton className="aspect-square w-full rounded-none" />
                            {!isCompact && (
                              <div className="p-3 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                if (products.length === 0) {
                  return (
                    <div className="py-8">
                      {activeSync ? (
                        <div className="py-16 text-center">
                          <Loader2 className="h-10 w-10 mx-auto text-primary/60 mb-2 animate-spin" />
                          <p className="text-sm font-medium">{t("products.empty.syncing")}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t("products.empty.syncProgress", { percent: activeSync.progress })}</p>
                        </div>
                      ) : (
                        <EmptyState
                          illustration={<NoProductsIllustration className="w-full h-full" />}
                          title={t("products.empty.title")}
                          description={t("products.empty.description")}
                        />
                      )}
                    </div>
                  );
                }
                return (
                  <div className={gridCls}>
                    {products.map((p) => {
                      const thumb = getProductThumbnail(p.images, p.image_mirror_urls);
                      const cats = getCategoryNames(p.categories);
                      const brandList = Array.isArray(p.brands) ? (p.brands as { name?: string }[]).map((b) => b.name).filter(Boolean) : [];
                      const stockLow = p.stock_quantity != null && p.stock_quantity > 0 && p.stock_quantity < 5;
                      const stockOut = p.stock_quantity === 0 || p.stock_status === "outofstock";
                      const priceHtml = (p.raw_data?.price_html as string) || "";
                      const currencyMatch = priceHtml.match(/<span class="woocommerce-Price-currencySymbol"[^>]*>([^<]+)<\/span>/);
                      const currency = currencyMatch ? currencyMatch[1].replace(/&[^;]+;/g, "").trim() : "";
                      const fmtPrice = (v: string | number | null | undefined) => v !== null && v !== undefined && v !== "" ? `${currency ? currency + " " : ""}${v}` : "—";
                      const minP = (p as ProductRow & { min_price?: number | null }).min_price;
                      const maxP = (p as ProductRow & { max_price?: number | null }).max_price;
                      const isVariable = p.type === "variable";
                      const hasRange = isVariable && minP != null && maxP != null && minP !== maxP;
                      const hasSingleVariablePrice = isVariable && minP != null && maxP != null && minP === maxP;
                      const rangeText = hasRange ? `${currency ? currency + " " : ""}${Number(minP).toFixed(2)}–${Number(maxP).toFixed(2)}` : null;
                      const variableSingleText = hasSingleVariablePrice ? `${currency ? currency + " " : ""}${Number(minP).toFixed(2)}` : null;
                      const dotColor: Record<string, string> = {
                        publish: "bg-success",
                        draft: "bg-muted-foreground/50",
                        pending: "bg-warning",
                        private: "bg-muted-foreground/50",
                      };
                      const dot = dotColor[p.status || ""] || "bg-muted-foreground/50";
                      const statusLabel = p.status === "publish" ? "Active" : (p.status || "—");
                      const pending = isPending(p);
                      const showCardChrome = selectedIds.has(p.id) || selectedIds.size > 0;
                      if (isCompact) {
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              if (pending) { showLockedToast(p); return; }
                              if (selectedIds.size > 0) toggleSelect(p.id);
                              else if (!locked) setQuickEditProduct(p);
                            }}
                            className={`group relative border rounded-xl overflow-hidden hover:shadow-lg transition-all bg-card flex flex-col ${pending ? "opacity-60 cursor-not-allowed" : (locked && selectedIds.size === 0 ? "cursor-default" : "cursor-pointer")} ${selectedIds.has(p.id) ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                            title={pending ? pendingLabel(p.pending_action) : (locked ? "Editing is disabled during initial sync" : undefined)}
                          >
                            {pending && (
                              <div className="absolute top-1.5 right-1.5 z-20 inline-flex items-center gap-1 rounded-full bg-warning/95 px-1.5 py-0.5 text-[9px] font-semibold text-warning-foreground shadow-sm uppercase tracking-wide">
                                <Lock className="h-2.5 w-2.5" />Pending
                              </div>
                            )}
                            <div
                              onClick={(e) => { e.stopPropagation(); if (!locked && !pending) toggleSelect(p.id); }}
                              className={cn(
                                "absolute top-1.5 left-1.5 z-10 h-5 w-5 rounded bg-background/95 backdrop-blur shadow-sm border border-border/60 flex items-center justify-center transition-opacity",
                                showCardChrome ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                selectedIds.has(p.id) && "ring-2 ring-primary/40",
                              )}
                            >
                              <Checkbox checked={selectedIds.has(p.id)} disabled={pending} className="pointer-events-none" />
                            </div>
                            <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" className="h-full w-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                              )}
                              {cfDebugBadge && thumb && isCloudflareDeliveryUrl(thumb) && (
                                <div
                                  className="absolute bottom-1.5 right-1.5 z-[15] flex h-5 w-5 items-center justify-center rounded-md bg-background/95 border border-border shadow-sm"
                                  title="Cloudflare Image Delivery"
                                >
                                  <Cloud className="h-3 w-3 text-sky-500" aria-hidden />
                                </div>
                              )}
                              {isVariable && (
                                <div className="absolute bottom-1.5 left-1.5 h-5 w-5 rounded-full bg-background shadow-sm border border-border/60 flex items-center justify-center" title="Has variations">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src="/variation.png" alt="Variable" className="h-3 w-3 object-contain" />
                                </div>
                              )}
                              {stockOut && (
                                <div className="absolute inset-0 bg-background/70 flex items-center justify-center backdrop-blur-[1px]">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive bg-background/90 px-2 py-0.5 rounded">Out of stock</span>
                                </div>
                              )}
                              {!stockOut && stockLow && (
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-warning ring-2 ring-background" title="Low stock" />
                              )}
                            </div>
                            <div className="px-2 py-1.5 border-t border-border/60">
                              <div className="text-[11px] font-medium leading-tight line-clamp-1">{p.name || "—"}</div>
                              <div className="flex items-center justify-between gap-1 mt-0.5">
                                <span className="text-[11px] font-semibold font-mono">{rangeText ?? variableSingleText ?? fmtPrice(p.price)}</span>
                                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot}`} title={statusLabel} />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            if (pending) { showLockedToast(p); return; }
                            if (selectedIds.size > 0) toggleSelect(p.id);
                            else if (!locked) setQuickEditProduct(p);
                          }}
                          className={`group relative border rounded-xl overflow-hidden hover:shadow-lg transition-all bg-card flex flex-col ${pending ? "opacity-60 cursor-not-allowed" : (locked && selectedIds.size === 0 ? "cursor-default" : "cursor-pointer")} ${selectedIds.has(p.id) ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                          title={pending ? pendingLabel(p.pending_action) : (locked ? "Editing is disabled during initial sync" : undefined)}
                        >
                          {pending && (
                            <div className="absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1.5 rounded-full bg-warning/95 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-warning-foreground shadow-sm uppercase tracking-wide">
                              <Lock className="h-3 w-3" />{pendingLabel(p.pending_action)}
                            </div>
                          )}
                          <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                            <div
                              className={cn(
                                "absolute top-2.5 left-2.5 z-10 flex items-center gap-1 transition-opacity pointer-events-none",
                                showCardChrome ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                              )}
                            >
                              <div
                                onClick={(e) => { e.stopPropagation(); if (!locked && !pending) toggleSelect(p.id); }}
                                className={cn(
                                  "pointer-events-auto h-6 w-6 rounded-md bg-background/95 backdrop-blur shadow-sm border border-border/60 flex items-center justify-center",
                                  selectedIds.has(p.id) && "ring-2 ring-primary/40",
                                )}
                              >
                                <Checkbox checked={selectedIds.has(p.id)} disabled={pending} className="pointer-events-none" />
                              </div>
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm border border-border/60">
                                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                                <span className="capitalize">{statusLabel}</span>
                              </div>
                            </div>
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="" className="h-full w-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
                            ) : (
                              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                            )}
                            {cfDebugBadge && thumb && isCloudflareDeliveryUrl(thumb) && (
                              <div
                                className="absolute top-11 right-2.5 z-[12] flex h-6 w-6 items-center justify-center rounded-md bg-background/95 border border-border shadow-sm"
                                title="Cloudflare Image Delivery"
                              >
                                <Cloud className="h-3.5 w-3.5 text-sky-500" aria-hidden />
                              </div>
                            )}
                            {isVariable && (
                              <div className="absolute bottom-2.5 left-2.5 h-8 w-8 rounded-full bg-background shadow-sm border border-border/60 flex items-center justify-center" title="Has variations">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/variation.png" alt="Variable" className="h-5 w-5 object-contain" />
                              </div>
                            )}
                            {stockOut && (
                              <div className="absolute top-2.5 right-2.5 inline-flex items-center rounded-full bg-destructive/95 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-destructive-foreground shadow-sm uppercase tracking-wide">
                                Out
                              </div>
                            )}
                            {!stockOut && stockLow && (
                              <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-warning/95 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-warning-foreground shadow-sm uppercase tracking-wide">
                                Low · {p.stock_quantity}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (!locked && !pending) router.push({ pathname: `/sites/${storeId}/products/edit/${p.id}`, query: { returnTo: buildReturnTo() } }); }}
                              disabled={locked || pending}
                              title={locked ? "Available after initial sync completes" : pending ? "This product is queued in a bulk job. Edits are disabled until it finishes." : "Edit product"}
                              className={cn(
                                "absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold shadow-md transition-opacity",
                                showCardChrome ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20",
                                "disabled:cursor-not-allowed disabled:opacity-40",
                              )}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          </div>
                          <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                            <div className="text-sm font-medium leading-tight line-clamp-2 min-h-[36px]">{p.name || "—"}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{cats || "Uncategorized"}</div>
                            {brandList.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {brandList.slice(0, 2).map((b) => (
                                  <span key={b} className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">{b}</span>
                                ))}
                                {brandList.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{brandList.length - 2}</span>
                                )}
                              </div>
                            )}
                            <div className="pt-2 mt-auto border-t border-border/60 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono uppercase tracking-wide">
                                <span className="truncate">{p.sku ? `SKU: ${p.sku}` : p.woo_id ? `ID: ${p.woo_id}` : "—"}</span>
                                {stockOut ? (
                                  <span className="text-destructive font-semibold whitespace-nowrap">Out of stock</span>
                                ) : p.stock_quantity != null ? (
                                  <span className="whitespace-nowrap">
                                    Stock: <span className={p.stock_quantity < 5 ? "text-warning" : ""}>{p.stock_quantity}</span>
                                  </span>
                                ) : p.stock_status === "instock" ? (
                                  <span className="text-success font-semibold whitespace-nowrap">In stock</span>
                                ) : p.stock_status === "onbackorder" ? (
                                  <span className="text-warning font-semibold whitespace-nowrap">Backorder</span>
                                ) : null}
                              </div>
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="flex items-baseline gap-1.5">
                                  {rangeText ? (
                                    <span className="text-base font-semibold font-mono text-foreground">{rangeText}</span>
                                  ) : variableSingleText ? (
                                    <span className="text-base font-semibold font-mono text-foreground">{variableSingleText}</span>
                                  ) : p.sale_price && p.sale_price !== p.regular_price ? (
                                    <>
                                      <span className="text-base font-semibold font-mono text-foreground">{fmtPrice(p.sale_price)}</span>
                                      <span className="ml-1.5 line-through text-muted-foreground text-xs">{fmtPrice(p.regular_price)}</span>
                                    </>
                                  ) : (
                                    <span className="text-base font-semibold font-mono text-foreground">{fmtPrice(p.price)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className={cn("overflow-x-auto transition-opacity duration-150", showRefetchOverlay && "opacity-70")}>
              <Table className="[&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-9 [&_th]:px-1.5 [&_th]:py-2">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8 pl-3 pr-0">
                      <Checkbox
                        checked={!locked && products.length > 0 && products.every((p) => selectedIds.has(p.id))}
                        disabled={locked}
                        onCheckedChange={(v) => {
                          if (locked) return;
                          if (v) setSelectedIds(new Set(products.map((p) => p.id)));
                          else setSelectedIds(new Set());
                        }}
                      />
                    </TableHead>
                    {visibleColList.map((c) => {
                      const baseCls = c.key === "image" ? "w-12" : "";
                      const numericKeys: ColumnKey[] = ["price", "regular_price", "sale_price", "stock", "wooId", "parent_id", "images_count"];
                      const isNumeric = numericKeys.includes(c.key);
                      const alignCls = isNumeric ? "text-right" : "text-left";
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
                        <TableHead
                          key={c.key}
                          className={cn(
                            baseCls,
                            alignCls,
                            "cursor-move select-none",
                            dragKey === c.key && "opacity-50",
                            productsColumnDensityClass(c.key),
                          )}
                          {...dragProps}
                        >
                          <span className={`inline-flex items-center gap-1 ${isNumeric ? "justify-end w-full" : ""}`}>
                            {isSortable ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextDir: SortDirection = isActive && sort.direction === "desc" ? "asc" : "desc";
                                  setSort({ field: c.sortable!, direction: nextDir, label: `${c.label} ${nextDir === "desc" ? "↓" : "↑"}` });
                                }}
                                className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${isActive ? "text-foreground font-medium" : ""}`}
                              >
                                {c.label}
                                <SortIcon className="h-3 w-3" />
                              </button>
                            ) : (
                              c.label
                            )}
                            <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                          </span>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showInitialLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        <TableCell className="w-8 pl-3 pr-0"><Checkbox disabled /></TableCell>
                        {visibleColList.map((c) => (
                          <TableCell key={c.key}>
                            {c.key === "image" ? <Skeleton className="h-9 w-9 rounded" /> : <Skeleton className="h-4 w-24" />}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColList.length + 1} className="py-8">
                        {activeSync ? (
                          <div className="text-center">
                            <Loader2 className="h-10 w-10 mx-auto text-primary/60 mb-2 animate-spin" />
                            <p className="text-sm font-medium">{t("products.empty.syncing")}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("products.empty.syncProgress", { percent: activeSync.progress })}</p>
                          </div>
                        ) : (
                          <EmptyState
                            illustration={<NoProductsIllustration className="w-full h-full" />}
                            title={t("products.empty.title")}
                            description={t("products.empty.description")}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((p) => {
                      const thumb = getProductThumbnail(p.images, p.image_mirror_urls);
                      const isSelected = selectedIds.has(p.id);
                      const priceHtml = (p.raw_data?.price_html as string) || "";
                      const currencyMatch = priceHtml.match(/<span class="woocommerce-Price-currencySymbol"[^>]*>([^<]+)<\/span>/);
                      const currency = currencyMatch ? currencyMatch[1].replace(/&[^;]+;/g, "").trim() : "";
                      const fmtPrice = (v: string | number | null | undefined) => v !== null && v !== undefined && v !== "" ? `${currency ? currency + " " : ""}${v}` : "—";
                      const statusLabel = p.status === "publish" ? "Active" : (p.status || "—");
                      const pending = isPending(p);
                      const minPRow = (p as ProductRow & { min_price?: number | null }).min_price;
                      const maxPRow = (p as ProductRow & { max_price?: number | null }).max_price;
                      const hasRangeRow = p.type === "variable" && minPRow != null && maxPRow != null && minPRow !== maxPRow;
                      const rangeTextRow = hasRangeRow ? `${currency ? currency + " " : ""}${Number(minPRow).toFixed(2)}–${Number(maxPRow).toFixed(2)}` : null;
                      return (
                          <TableRow
                            key={p.id}
                            className={`hover:bg-muted/30 cursor-pointer transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_44px] ${isSelected ? "bg-primary/5" : ""} ${pending ? "opacity-60" : ""}`}
                            onClick={() => {
                              if (pending) { showLockedToast(p); return; }
                              if (selectedIds.size > 0 && !locked) { toggleSelect(p.id); return; }
                              if (!locked) setQuickEditProduct(p);
                            }}
                          >
                            <TableCell className="w-8 pl-3 pr-0" onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={isSelected} disabled={locked || pending} onCheckedChange={() => { if (!locked && !pending) toggleSelect(p.id); }} />
                            </TableCell>
                            {visibleColList.map((c) => {
                              if (c.key === "image") {
                                return (
                                  <TableCell key={c.key}>
                                    <div className="relative h-9 w-9 shrink-0">
                                      {thumb ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={thumb} alt="" className="h-9 w-9 rounded object-cover border border-border" loading="lazy" />
                                      ) : (
                                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center border border-border">
                                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                                        </div>
                                      )}
                                      {cfDebugBadge && thumb && isCloudflareDeliveryUrl(thumb) && (
                                        <div
                                          className="absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-background/95 border border-border shadow-sm"
                                          title="Cloudflare Image Delivery"
                                        >
                                          <Cloud className="h-2.5 w-2.5 text-sky-500" aria-hidden />
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              }
                              if (c.key === "id") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.id} />;
                              }
                              if (c.key === "name") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.name || ""} />;
                              }
                              if (c.key === "status") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={statusLabel} />;
                              }
                              if (c.key === "sku") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.sku || ""} />;
                              }
                              if (c.key === "price") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={String(rangeTextRow ?? fmtPrice(p.price))} />
                                );
                              }
                              if (c.key === "regular_price") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={String(fmtPrice(p.regular_price))} />;
                              }
                              if (c.key === "sale_price") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={String(fmtPrice(p.sale_price))} />;
                              }
                              if (c.key === "stock") {
                                return (
                                  <ProductCatalogStringCell
                                    key={c.key}
                                    columnKey={c.key}
                                    raw={p.stock_quantity != null ? String(p.stock_quantity) : ""}
                                  />
                                );
                              }
                              if (c.key === "stock_status") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.stock_status || ""} />;
                              }
                              if (c.key === "manage_stock") {
                                return (
                                  <ProductCatalogStringCell
                                    key={c.key}
                                    columnKey={c.key}
                                    raw={String((p.raw_data?.manage_stock as boolean | string) ?? "")}
                                  />
                                );
                              }
                              if (c.key === "category") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={getCategoryNames(p.categories)} />
                                );
                              }
                              if (c.key === "brands") {
                                const brandStr = Array.isArray(p.brands)
                                  ? (p.brands as { name?: string }[])
                                      .map((b) => b.name)
                                      .filter(Boolean)
                                      .join(", ")
                                  : "";
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={brandStr} />;
                              }
                              if (c.key === "type") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.type || ""} />;
                              }
                              if (c.key === "slug") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.slug || ""} />;
                              }
                              if (c.key === "wooId") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.woo_id != null ? String(p.woo_id) : ""} />
                                );
                              }
                              if (c.key === "parent_id") {
                                const pid = (p.raw_data?.parent_id as number | undefined) ?? undefined;
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={pid != null ? String(pid) : ""} />
                                );
                              }
                              if (c.key === "permalink") {
                                return (
                                  <ProductCatalogStringCell
                                    key={c.key}
                                    columnKey={c.key}
                                    raw={(p.raw_data?.permalink as string) || ""}
                                  />
                                );
                              }
                              if (c.key === "tax_status") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={(p.raw_data?.tax_status as string) || ""} />
                                );
                              }
                              if (c.key === "tax_class") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={(p.raw_data?.tax_class as string) || ""} />
                                );
                              }
                              if (c.key === "shipping_required") {
                                return (
                                  <ProductCatalogStringCell
                                    key={c.key}
                                    columnKey={c.key}
                                    raw={String((p.raw_data?.shipping_required as boolean) ?? "")}
                                  />
                                );
                              }
                              if (c.key === "images_count") {
                                return (
                                  <ProductCatalogStringCell
                                    key={c.key}
                                    columnKey={c.key}
                                    raw={String(Array.isArray(p.images) ? p.images.length : 0)}
                                  />
                                );
                              }
                              if (c.key === "short_desc") {
                                return (
                                  <ProductCatalogStringCell
                                    key={c.key}
                                    columnKey={c.key}
                                    raw={stripHtmlForTablePreview(p.short_description || "")}
                                  />
                                );
                              }
                              if (c.key === "description") {
                                return (
                                  <ProductCatalogStringCell
                                    key={c.key}
                                    columnKey={c.key}
                                    raw={stripHtmlForTablePreview(p.description || "")}
                                  />
                                );
                              }
                              if (c.key === "attributes") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={JSON.stringify(p.attributes || [])} />
                                );
                              }
                              if (c.key === "date_created") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={(p.raw_data?.date_created as string) || ""} />
                                );
                              }
                              if (c.key === "date_modified") {
                                return (
                                  <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={(p.raw_data?.date_modified as string) || ""} />
                                );
                              }
                              if (c.key === "sales") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.synced_at || ""} />;
                              }
                              if (c.key === "created") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.created_at || ""} />;
                              }
                              if (c.key === "updated") {
                                return <ProductCatalogStringCell key={c.key} columnKey={c.key} raw={p.updated_at || ""} />;
                              }
                              return null;
                            })}
                          </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {!showInitialLoading && products.length > 0 && (
            <InfiniteScrollSentinel
              hasMore={hasNextPage}
              isLoading={isFetchingNextPage}
              onLoadMore={handleLoadMore}
              loaded={products.length}
              total={productCount}
            />
          )}
        </CardContent>
      </Card>

      <ProductTypeDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        onSelect={(type) => {
          setTypeDialogOpen(false);
          router.push({ pathname: `/sites/${storeId}/products/new`, query: { type, returnTo: buildReturnTo() } });
        }}
      />

      <ProductQuickEdit
        product={quickEditProduct}
        open={!!quickEditProduct}
        onOpenChange={(o) => { if (!o) setQuickEditProduct(null); }}
        siteName={storeName}
      />

      <Dialog open={!!bulkDialog} onOpenChange={(o) => { if (!o) setBulkDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkDialog === "status" && t("products.bulk.dialog.updateStatus")}
              {bulkDialog === "category" && t("products.bulk.dialog.updateCategories")}
              {bulkDialog === "tag" && t("products.bulk.dialog.updateTags")}
              {bulkDialog === "brand" && t("products.bulk.dialog.updateBrands")}
              {bulkDialog === "delete" && t("products.bulk.dialog.deleteProducts")}
            </DialogTitle>
            <DialogDescription>
              {bulkDialog === "delete"
                ? t("products.bulk.dialog.deleteConfirm", { count: selectedIds.size })
                : t("products.bulk.dialog.applyTo", { count: selectedIds.size })}
            </DialogDescription>
          </DialogHeader>

          {bulkDialog === "status" && (
            <div>
              <Label className="text-xs">New status</Label>
              <Select value={newProductStatus} onValueChange={(v) => setNewProductStatus(v as typeof newProductStatus)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {bulkDialog === "category" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t("products.bulk.dialog.mode")}</Label>
                <Select value={categoryMode} onValueChange={(v) => setCategoryMode(v as typeof categoryMode)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">{t("products.bulk.dialog.ops.addCats")}</SelectItem>
                    <SelectItem value="remove">{t("products.bulk.dialog.ops.removeCats")}</SelectItem>
                    <SelectItem value="replace">{t("products.bulk.dialog.ops.replaceCats")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("products.bulk.dialog.categoriesField")}</Label>
                <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border p-2 space-y-1">
                  {categoryOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("products.bulk.dialog.noCategoriesAvailable")}</p>
                  ) : (
                    categoryOptions.map((c) => (
                      <label key={c.woo_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <Checkbox
                          checked={bulkCategoryIds.has(c.woo_id)}
                          onCheckedChange={(v) => {
                            setBulkCategoryIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(c.woo_id);
                              else next.delete(c.woo_id);
                              return next;
                            });
                          }}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {bulkDialog === "tag" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t("products.bulk.dialog.mode")}</Label>
                <Select value={tagMode} onValueChange={(v) => setTagMode(v as typeof tagMode)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">{t("products.bulk.dialog.ops.addTags")}</SelectItem>
                    <SelectItem value="remove">{t("products.bulk.dialog.ops.removeTags")}</SelectItem>
                    <SelectItem value="replace">{t("products.bulk.dialog.ops.replaceTags")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("products.bulk.dialog.tagsField")}</Label>
                <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border p-2 space-y-1">
                  {tagOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("products.bulk.dialog.noTagsAvailable")}</p>
                  ) : (
                    tagOptions.map((c) => (
                      <label key={c.woo_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <Checkbox
                          checked={bulkTagIds.has(c.woo_id)}
                          onCheckedChange={(v) => {
                            setBulkTagIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(c.woo_id);
                              else next.delete(c.woo_id);
                              return next;
                            });
                          }}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {bulkDialog === "brand" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t("products.bulk.dialog.mode")}</Label>
                <Select value={brandMode} onValueChange={(v) => setBrandMode(v as typeof brandMode)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">{t("products.bulk.dialog.ops.addBrands")}</SelectItem>
                    <SelectItem value="remove">{t("products.bulk.dialog.ops.removeBrands")}</SelectItem>
                    <SelectItem value="replace">{t("products.bulk.dialog.ops.replaceBrands")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("products.bulk.dialog.brandsField")}</Label>
                <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border p-2 space-y-1">
                  {brandOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("products.bulk.dialog.noBrandsAvailable")}</p>
                  ) : (
                    brandOptions.map((c) => (
                      <label key={c.woo_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <Checkbox
                          checked={bulkBrandIds.has(c.woo_id)}
                          onCheckedChange={(v) => {
                            setBulkBrandIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(c.woo_id);
                              else next.delete(c.woo_id);
                              return next;
                            });
                          }}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkDialog(null)} disabled={bulkSubmitting}>Cancel</Button>
            <Button
              onClick={submitBulk}
              disabled={bulkSubmitting}
              className={bulkDialog === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {bulkSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {bulkDialog === "delete" ? "Delete" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}