import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { ArrowLeft, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, Package, ImageIcon, LayoutGrid, List, Grid3x3, ChevronDown, GripVertical, Search, Pencil, Plus, FilterX } from "lucide-react";
import {
  getProductThumbnail,
  getCategoryNames,
  type ProductRow,
  type ProductSortField,
  type SortDirection,
} from "@/services/productService";
import { fetchPreferences, savePreferences } from "@/services/viewPreferencesService";
import { ProductRowExpanded } from "@/components/explore/ProductRowExpanded";
import { ProductQuickEdit } from "@/components/explore/ProductQuickEdit";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts, useProductCategoryOptions } from "@/hooks/queries/useProducts";
import { useAllActiveSyncs } from "@/hooks/queries/useAllActiveSyncs";
import { useBackgroundPagination } from "@/hooks/useBackgroundPagination";
import { queryKeys } from "@/lib/query-client";
import { fetchProducts } from "@/services/productService";
import { useQueryClient } from "@tanstack/react-query";
import { createBulkJob } from "@/services/bulkJobService";
import { DollarSign, Boxes, Tag as TagIcon, Trash2, X, CheckCircle2, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/router";
import { useScrollExpandedIntoView } from "@/hooks/useScrollExpandedIntoView";
import { SyncPill } from "@/components/ui/sync-pill";
import { EmptyState } from "@/components/EmptyState";
import { NoProductsIllustration } from "@/components/illustrations/EmptyIllustrations";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";
import { TableLoadingOverlay } from "@/components/ui/table-loading-overlay";
import { ProgressSlot } from "@/contexts/LoadingProvider";
import { useExplorerKeyboard } from "@/hooks/useExplorerKeyboard";
import { cn } from "@/lib/utils";
import { useSyncUrl, getQueryString } from "@/hooks/useUrlState";
import { ProductTypeDialog } from "@/components/product-edit/ProductTypeDialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";

const PENDING_LABELS: Record<string, string> = {
  delete: "Scheduled for deletion",
  status_change: "Scheduled for status change",
  price_update: "Scheduled for price update",
  stock_update: "Scheduled for stock update",
  category_update: "Scheduled for category update",
};
function pendingLabel(action?: string | null) {
  if (!action) return "";
  return PENDING_LABELS[action] || `Scheduled: ${action}`;
}

type ColumnKey =
  | "image" | "id" | "wooId" | "name" | "slug" | "sku" | "type" | "status" | "permalink" | "parent_id"
  | "price" | "regular_price" | "sale_price"
  | "stock" | "stock_status" | "manage_stock"
  | "tax_status" | "tax_class" | "shipping_required"
  | "category" | "brands" | "attributes" | "images_count"
  | "short_desc" | "description"
  | "date_created" | "date_modified" | "sales" | "created" | "updated";

const COLUMNS: { key: ColumnKey; label: string; group: string; sortable?: ProductSortField }[] = [
  { key: "image", label: "Image", group: "Basic" },
  { key: "id", label: "ID", group: "Basic" },
  { key: "wooId", label: "Woo ID", group: "Basic" },
  { key: "name", label: "Product name", group: "Basic", sortable: "name" },
  { key: "slug", label: "Slug", group: "Basic" },
  { key: "sku", label: "SKU", group: "Basic" },
  { key: "type", label: "Type", group: "Basic" },
  { key: "status", label: "Status", group: "Basic" },
  { key: "permalink", label: "Permalink", group: "Basic" },
  { key: "parent_id", label: "Parent ID", group: "Basic" },
  { key: "price", label: "Price", group: "Pricing", sortable: "price" },
  { key: "regular_price", label: "Regular price", group: "Pricing" },
  { key: "sale_price", label: "Sale price", group: "Pricing" },
  { key: "stock", label: "Stock qty", group: "Inventory", sortable: "stock_quantity" },
  { key: "stock_status", label: "Stock status", group: "Inventory" },
  { key: "manage_stock", label: "Manage stock", group: "Inventory" },
  { key: "tax_status", label: "Tax status", group: "Tax & Shipping" },
  { key: "tax_class", label: "Tax class", group: "Tax & Shipping" },
  { key: "shipping_required", label: "Shipping required", group: "Tax & Shipping" },
  { key: "category", label: "Categories", group: "Taxonomy" },
  { key: "brands", label: "Brands", group: "Taxonomy" },
  { key: "attributes", label: "Attributes", group: "Taxonomy" },
  { key: "images_count", label: "Images count", group: "Taxonomy" },
  { key: "short_desc", label: "Short description", group: "Content" },
  { key: "description", label: "Description", group: "Content" },
  { key: "date_created", label: "Date created (Woo)", group: "Dates" },
  { key: "date_modified", label: "Date modified (Woo)", group: "Dates" },
  { key: "sales", label: "Last synced", group: "Dates", sortable: "synced_at" },
  { key: "created", label: "Created at (DB)", group: "Dates", sortable: "created_at" },
  { key: "updated", label: "Updated at (DB)", group: "Dates", sortable: "updated_at" },
];

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

export function ProductsTab({ storeId, storeUrl, search, storeName, onSearchChange, embedHeader = false }: ProductsTabProps) {
  const { t, i18n } = useTranslation("site");
  const queryClient = useQueryClient();
  const { locked } = useSyncLocked(storeId);
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const v = parseInt(localStorage.getItem("explore-page-size") || "50", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 50;
  });
  const [viewMode, setViewMode] = useState<"table" | "grid" | "compact">(() => {
    if (typeof window === "undefined") return "table";
    return (localStorage.getItem("explore-view-mode") as "table" | "grid" | "compact") || "table";
  });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  useScrollExpandedIntoView(expandedRowId);
  const [quickEditProduct, setQuickEditProduct] = useState<ProductRow | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<null | "price" | "stock" | "status" | "category" | "delete">(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [priceOp, setPriceOp] = useState<"set" | "increase_pct" | "decrease_pct" | "increase_fixed" | "decrease_fixed" | "set_sale">("set");
  const [priceValue, setPriceValue] = useState("");
  const [stockOp, setStockOp] = useState<"set" | "adjust" | "set_status">("set");
  const [stockValue, setStockValue] = useState("");
  const [stockStatusVal, setStockStatusVal] = useState<"instock" | "outofstock" | "onbackorder">("instock");
  const [newProductStatus, setNewProductStatus] = useState<"publish" | "draft" | "pending" | "private">("publish");
  const [categoryMode, setCategoryMode] = useState<"add" | "remove" | "replace">("add");
  const [bulkCategoryIds, setBulkCategoryIds] = useState<Set<number>>(new Set());
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
      try {
        const saved = localStorage.getItem("explore-visible-cols");
        if (saved) return { ...defaults, ...JSON.parse(saved) };
      } catch { /* ignore */ }
    }
    return defaults;
  });
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    if (typeof window !== "undefined") {
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

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, sort, storeId, excludeOutOfStock, categoryFilter, stockStatusFilter, priceMin, priceMax]);

  useSyncUrl(
    {
      status: statusFilter,
      cat: categoryFilter,
      stock: stockStatusFilter,
      pmin: priceMin,
      pmax: priceMax,
      q: debouncedSearch,
    },
    { status: "all", cat: "all", stock: "all", pmin: "", pmax: "", q: "" },
  );

  const buildReturnTo = useCallback(() => {
    if (typeof window === "undefined") return `/sites/${storeId}/products`;
    return router.asPath || `/sites/${storeId}/products`;
  }, [router, storeId]);

  const { data: productsResult, isLoading: loading, isFetching } = useProducts({
    storeId,
    page,
    pageSize,
    search: debouncedSearch,
    sortField: sort.field,
    sortDirection: sort.direction,
    statusFilter,
    excludeOutOfStock,
    categoryFilter: categoryFilter === "all" ? undefined : categoryFilter,
    stockStatusFilter,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
    enabled: isHydrated,
  });
  const products = productsResult?.data ?? [];
  const productCount = productsResult?.count ?? 0;
  const showInitialLoading = !isHydrated || loading;
  const showRefetchOverlay = isFetching && !loading && products.length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExplorerKeyboard({
    searchRef: searchInputRef,
    onPrev: () => { if (page > 0) setPage((p) => Math.max(0, p - 1)); },
    onNext: () => { if ((page + 1) * pageSize < productCount) setPage((p) => p + 1); },
  });

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
      if (bulkDialog === "price") {
        const num = Number(priceValue);
        if (!priceValue || Number.isNaN(num)) { setBulkSubmitting(false); return; }
        await createBulkJob({ store_id: storeId, job_type: "update_product_price", total: wooIds.length, payload: { type: "update_product_price", product_ids: wooIds, operation: priceOp, value: num } });
      } else if (bulkDialog === "stock") {
        if (stockOp === "set_status") {
          await createBulkJob({ store_id: storeId, job_type: "update_product_stock", total: wooIds.length, payload: { type: "update_product_stock", product_ids: wooIds, operation: "set_status", stock_status: stockStatusVal } });
        } else {
          const num = Number(stockValue);
          if (!stockValue || Number.isNaN(num)) { setBulkSubmitting(false); return; }
          await createBulkJob({ store_id: storeId, job_type: "update_product_stock", total: wooIds.length, payload: { type: "update_product_stock", product_ids: wooIds, operation: stockOp, value: num } });
        }
      } else if (bulkDialog === "status") {
        await createBulkJob({ store_id: storeId, job_type: "update_product_status", total: wooIds.length, payload: { type: "update_product_status", product_ids: wooIds, new_status: newProductStatus } });
      } else if (bulkDialog === "category") {
        if (bulkCategoryIds.size === 0) { setBulkSubmitting(false); return; }
        await createBulkJob({ store_id: storeId, job_type: "assign_product_categories", total: wooIds.length, payload: { type: "assign_product_categories", product_ids: wooIds, mode: categoryMode, category_ids: Array.from(bulkCategoryIds) } });
      } else if (bulkDialog === "delete") {
        await createBulkJob({ store_id: storeId, job_type: "delete_products", total: wooIds.length, payload: { type: "delete_products", product_ids: wooIds, force: false } });
      }
      setSelectedIds(new Set());
      setBulkDialog(null);
      setPriceValue(""); setStockValue(""); setBulkCategoryIds(new Set());
    } catch (err) {
      console.error("[bulk]", err);
    } finally {
      setBulkSubmitting(false);
    }
  }, [bulkDialog, selectedIds, overLimit, products, storeId, priceOp, priceValue, stockOp, stockValue, stockStatusVal, newProductStatus, categoryMode, bulkCategoryIds]);

  useEffect(() => { setSelectedIds(new Set()); }, [storeId, page, pageSize]);

  const prefetchOpts = useMemo(() => ({
    storeId,
    search: debouncedSearch,
    sortField: sort.field,
    sortDirection: sort.direction,
    statusFilter,
    excludeOutOfStock,
    categoryFilter: categoryFilter === "all" ? undefined : categoryFilter,
    stockStatusFilter,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
  }), [storeId, debouncedSearch, sort.field, sort.direction, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, priceMin, priceMax]);

  useBackgroundPagination({
    enabled: !!storeId && productCount > 0,
    totalCount: productCount,
    pageSize,
    currentPage: page,
    queryKeyFn: (p) => queryKeys.products(storeId, { ...prefetchOpts, page: p, pageSize } as unknown as Record<string, unknown>),
    queryFn: (p) => fetchProducts({ ...prefetchOpts, page: p, pageSize }),
    maxRecords: 20000,
    resetKey: `${JSON.stringify(prefetchOpts)}|${pageSize}`,
  });

  // Keep adjacent pages warm so next/prev is instant across table/grid/compact views.
  useEffect(() => {
    if (!storeId || !isHydrated || productCount <= 0) return;
    const totalPages = Math.ceil(productCount / pageSize);
    const candidates = [page + 1, page - 1].filter((p) => p >= 0 && p < totalPages);
    for (const p of candidates) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.products(storeId, { ...prefetchOpts, page: p, pageSize } as unknown as Record<string, unknown>),
        queryFn: () => fetchProducts({ ...prefetchOpts, page: p, pageSize }),
        staleTime: 60_000,
      });
    }
  }, [queryClient, storeId, isHydrated, productCount, page, pageSize, prefetchOpts]);

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

  const exportCsv = useCallback(() => {
    if (products.length === 0) return;
    const cols = visibleColList.filter((c) => c.key !== "image");
    const header = cols.map((c) => c.label).join(",");
    const rows = products.map((p) => cols.map((c) => {
      let v: string | number = "";
      switch (c.key) {
        case "id": v = p.id; break;
        case "name": v = p.name || ""; break;
        case "status": v = p.status || ""; break;
        case "sku": v = p.sku || ""; break;
        case "price": v = (p.price as string) || ""; break;
        case "regular_price": v = (p.regular_price as string) || ""; break;
        case "sale_price": v = (p.sale_price as string) || ""; break;
        case "stock": v = p.stock_quantity ?? ""; break;
        case "stock_status": v = p.stock_status || ""; break;
        case "manage_stock": v = String((p.raw_data?.manage_stock as boolean | string) ?? ""); break;
        case "category": v = getCategoryNames(p.categories); break;
        case "type": v = p.type || ""; break;
        case "slug": v = p.slug || ""; break;
        case "wooId": v = p.woo_id ?? ""; break;
        case "parent_id": v = (p.raw_data?.parent_id as number) ?? ""; break;
        case "permalink": v = (p.raw_data?.permalink as string) || ""; break;
        case "tax_status": v = (p.raw_data?.tax_status as string) || ""; break;
        case "tax_class": v = (p.raw_data?.tax_class as string) || ""; break;
        case "shipping_required": v = String((p.raw_data?.shipping_required as boolean) ?? ""); break;
        case "images_count": v = Array.isArray(p.images) ? p.images.length : 0; break;
        case "short_desc": v = (p.short_description || "").replace(/<[^>]+>/g, "").slice(0, 200); break;
        case "description": v = (p.description || "").replace(/<[^>]+>/g, "").slice(0, 500); break;
        case "attributes": v = JSON.stringify(p.attributes || []); break;
        case "date_created": v = (p.raw_data?.date_created as string) || ""; break;
        case "date_modified": v = (p.raw_data?.date_modified as string) || ""; break;
        case "sales": v = p.synced_at || ""; break;
        case "created": v = p.created_at || ""; break;
        case "updated": v = p.updated_at || ""; break;
      }
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(",")).join("\n");
    const csv = `${header}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${storeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [products, visibleColList, storeId]);

  const { data: categoryOptions = [] } = useProductCategoryOptions(storeId);
  const { data: activeSyncs = [] } = useAllActiveSyncs();
  const activeSync = activeSyncs.find((s) => s.store_id === storeId);
  const prefsLoaded = useRef(false);
  const prefsLoading = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prefsLoaded.current || prefsLoading.current) return;
    if (!router.isReady) return;
    prefsLoading.current = true;
    const urlStatus = getQueryString(router.query, "status");
    const urlCat = getQueryString(router.query, "cat");
    const urlStock = getQueryString(router.query, "stock");
    const urlPmin = getQueryString(router.query, "pmin");
    const urlPmax = getQueryString(router.query, "pmax");
    // Filters precedence URL > DB > defaults. URL is applied unconditionally first
    // because the initial useState ran before router.isReady (router.query was empty).
    if (urlStatus !== undefined) setStatusFilter(urlStatus);
    if (urlCat !== undefined) setCategoryFilter(urlCat);
    if (urlStock !== undefined) setStockStatusFilter(urlStock);
    if (urlPmin !== undefined) setPriceMin(urlPmin);
    if (urlPmax !== undefined) setPriceMax(urlPmax);
    fetchPreferences("products").then((remote) => {
      if (remote) {
        // Table preferences (columns/order/page-size/view mode) — DB always wins.
        if (Array.isArray(remote.columnOrder)) setColumnOrder(remote.columnOrder as ColumnKey[]);
        if (remote.visibleCols && typeof remote.visibleCols === "object") setVisibleCols((cur) => ({ ...cur, ...(remote.visibleCols as Record<ColumnKey, boolean>) }));
        if (typeof remote.pageSize === "number") setPageSize(remote.pageSize);
        if (typeof remote.viewMode === "string") setViewMode(remote.viewMode as "table" | "grid" | "compact");
        // Filters: only apply DB pref when URL didn't override.
        if (urlStatus === undefined && typeof remote.statusFilter === "string") setStatusFilter(remote.statusFilter);
        if (typeof remote.excludeOutOfStock === "boolean") setExcludeOutOfStock(remote.excludeOutOfStock);
        if (urlCat === undefined && typeof remote.categoryFilter === "string") setCategoryFilter(remote.categoryFilter);
        if (urlStock === undefined && typeof remote.stockStatusFilter === "string") setStockStatusFilter(remote.stockStatusFilter);
        if (remote.sort && typeof remote.sort === "object") setSort(remote.sort as typeof SORT_OPTIONS[number]);
      }
      prefsLoaded.current = true;
      setIsHydrated(true);
    }).catch(() => {
      prefsLoaded.current = true;
      setIsHydrated(true);
    });
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferences("products", { columnOrder, visibleCols, pageSize, viewMode, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, sort }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [columnOrder, visibleCols, pageSize, viewMode, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, sort]);

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
                  <SelectItem key={c} value={c}>{c}</SelectItem>
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
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" onClick={exportCsv} disabled={products.length === 0 || locked} title={locked ? t("products.toolbar.lockedHint") : t("products.toolbar.exportCsv")}>
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">{t("products.toolbar.export")}</span>
            </Button>
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
              {!embedHeader && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={locked}>
                  <SelectTrigger className="h-9 w-[180px] text-xs">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(excludeOutOfStock || statusFilter !== "all" || categoryFilter !== "all" || stockStatusFilter !== "all" || priceMin || priceMax) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5" onClick={() => {
                  setStatusFilter("all"); setExcludeOutOfStock(false); setCategoryFilter("all");
                  setStockStatusFilter("all"); setPriceMin(""); setPriceMax("");
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
                    <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" onClick={exportCsv} disabled={products.length === 0 || locked} title={locked ? "Available after initial sync completes" : "Export CSV"}>
                      <Download className="h-3.5 w-3.5" />
                      <span className="text-xs">Export</span>
                    </Button>
                  </>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
                  <Package className="h-3.5 w-3.5" />
                  <span className="font-medium">{formatNumber(productCount, i18n.language)}</span>
                </div>
                {(productCount > 0 || loading) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 border-l border-border">
                    <span>Rows:</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1">{pageSize}<ChevronDown className="h-3 w-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <DropdownMenuItem key={n} onClick={() => setPageSize(n)} className={pageSize === n ? "bg-accent" : ""}>{n}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="whitespace-nowrap">
                      {loading && productCount === 0 ? "Loading…" : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, productCount)} of ${formatNumber(productCount, i18n.language)}`}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= productCount}><ArrowLeft className="h-3.5 w-3.5 rotate-180" /></Button>
                    </div>
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
              </div>
              <div className="flex-1" />
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("price")}><DollarSign className="h-3.5 w-3.5" />{t("products.bulk.price")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("stock")}><Boxes className="h-3.5 w-3.5" />{t("products.bulk.stock")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("status")}><CheckCircle2 className="h-3.5 w-3.5" />{t("products.bulk.status")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit || locked} onClick={() => setBulkDialog("category")}><TagIcon className="h-3.5 w-3.5" />{t("products.bulk.categories")}</Button>
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
                      const thumb = getProductThumbnail(p.images);
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
                              className={`absolute top-1.5 left-1.5 z-10 h-5 w-5 rounded bg-background/95 backdrop-blur shadow-sm border border-border/60 flex items-center justify-center transition-opacity ${selectedIds.has(p.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
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
                          <div
                            onClick={(e) => { e.stopPropagation(); if (!locked && !pending) toggleSelect(p.id); }}
                            className={`absolute top-2.5 left-2.5 z-10 h-6 w-6 rounded-md bg-background/95 backdrop-blur shadow-sm border border-border/60 flex items-center justify-center transition-opacity ${selectedIds.has(p.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                          >
                            <Checkbox checked={selectedIds.has(p.id)} disabled={pending} className="pointer-events-none" />
                          </div>
                          <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="" className="h-full w-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
                            ) : (
                              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                            )}
                            {isVariable && (
                              <div className="absolute bottom-2.5 left-2.5 h-8 w-8 rounded-full bg-background shadow-sm border border-border/60 flex items-center justify-center" title="Has variations">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/variation.png" alt="Variable" className="h-5 w-5 object-contain" />
                              </div>
                            )}
                            <div className="absolute top-2.5 left-11 inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm border border-border/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background">
                              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                              <span className="capitalize">{statusLabel}</span>
                            </div>
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
                              onClick={(e) => { e.stopPropagation(); if (!locked && !pending) router.push({ pathname: `/sites/${storeId}/products/edit/${p.id}`, query: { returnTo: buildReturnTo() } }); }}
                              disabled={locked || pending}
                              title={locked ? "Available after initial sync completes" : pending ? "This product is queued in a bulk job. Edits are disabled until it finishes." : "Edit product"}
                              className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-background/95 backdrop-blur px-2.5 py-1.5 text-[11px] font-medium shadow-sm border border-border/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background disabled:cursor-not-allowed disabled:opacity-0"
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
              <Table>
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
                      const baseCls = c.key === "image" ? "w-14" : "";
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
                        <TableHead key={c.key} className={`${baseCls} ${alignCls} cursor-move select-none ${dragKey === c.key ? "opacity-50" : ""}`} {...dragProps}>
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
                            {c.key === "image" ? <Skeleton className="h-10 w-10 rounded" /> : <Skeleton className="h-4 w-24" />}
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
                      const thumb = getProductThumbnail(p.images);
                      const isExpanded = expandedRowId === p.id;
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
                        <React.Fragment key={p.id}>
                          <TableRow className={`hover:bg-muted/30 cursor-pointer transition-colors ${isExpanded ? "bg-muted/30 !border-b-0" : ""} ${isSelected ? "bg-primary/5" : ""} ${pending ? "opacity-60" : ""}`} onClick={() => { if (pending) { showLockedToast(p); return; } setExpandedRowId((cur) => (cur === p.id ? null : p.id)); }}>
                            <TableCell className="w-8 pl-3 pr-0" onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={isSelected} disabled={locked || pending} onCheckedChange={() => { if (!locked && !pending) toggleSelect(p.id); }} />
                            </TableCell>
                            {visibleColList.map((c) => {
                              if (c.key === "image") {
                                return (
                                  <TableCell key={c.key}>
                                    {thumb ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={thumb} alt="" className="h-10 w-10 rounded object-cover border border-border" loading="lazy" />
                                    ) : (
                                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center border border-border">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              }
                              if (c.key === "name") {
                                return (
                                  <TableCell key={c.key} className="max-w-[320px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="truncate">{p.name || "—"}</span>
                                    </div>
                                  </TableCell>
                                );
                              }
                              if (c.key === "status") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-medium">{statusLabel}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "sku") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.sku || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "price") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{rangeTextRow ?? fmtPrice(p.price)}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "regular_price") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{fmtPrice(p.regular_price)}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "sale_price") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{fmtPrice(p.sale_price)}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "stock") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.stock_quantity ?? "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "stock_status") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.stock_status}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "manage_stock") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{String((p.raw_data?.manage_stock as boolean | string) ?? "")}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "category") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{getCategoryNames(p.categories)}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "type") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.type}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "slug") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.slug}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "wooId") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.woo_id ?? "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "parent_id") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.raw_data?.parent_id as number) ?? "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "permalink") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.raw_data?.permalink as string) || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "tax_status") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.raw_data?.tax_status as string) || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "tax_class") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.raw_data?.tax_class as string) || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "shipping_required") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{String((p.raw_data?.shipping_required as boolean) ?? "")}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "images_count") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{Array.isArray(p.images) ? p.images.length : 0}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "short_desc") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.short_description || "").replace(/<[^>]+>/g, "").slice(0, 200)}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "description") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.description || "").replace(/<[^>]+>/g, "").slice(0, 500)}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "attributes") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{JSON.stringify(p.attributes || [])}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "date_created") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.raw_data?.date_created as string) || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "date_modified") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{(p.raw_data?.date_modified as string) || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "sales") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.synced_at || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "created") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.created_at || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "updated") {
                                return (
                                  <TableCell key={c.key}>
                                    <span className="text-xs font-mono truncate">{p.updated_at || "—"}</span>
                                  </TableCell>
                                );
                              }
                              return null;
                            })}
                          </TableRow>
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
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
      />

      <Dialog open={!!bulkDialog} onOpenChange={(o) => { if (!o) setBulkDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkDialog === "price" && t("products.bulk.dialog.updatePrice")}
              {bulkDialog === "stock" && t("products.bulk.dialog.updateStock")}
              {bulkDialog === "status" && t("products.bulk.dialog.updateStatus")}
              {bulkDialog === "category" && t("products.bulk.dialog.updateCategories")}
              {bulkDialog === "delete" && t("products.bulk.dialog.deleteProducts")}
            </DialogTitle>
            <DialogDescription>
              {bulkDialog === "delete"
                ? t("products.bulk.dialog.deleteConfirm", { count: selectedIds.size })
                : t("products.bulk.dialog.applyTo", { count: selectedIds.size })}
            </DialogDescription>
          </DialogHeader>

          {bulkDialog === "price" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Operation</Label>
                <Select value={priceOp} onValueChange={(v) => setPriceOp(v as typeof priceOp)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Set regular price to</SelectItem>
                    <SelectItem value="set_sale">Set sale price to</SelectItem>
                    <SelectItem value="increase_pct">Increase by %</SelectItem>
                    <SelectItem value="decrease_pct">Decrease by %</SelectItem>
                    <SelectItem value="increase_fixed">Increase by fixed amount</SelectItem>
                    <SelectItem value="decrease_fixed">Decrease by fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} className="mt-1" placeholder="0.00" />
              </div>
            </div>
          )}

          {bulkDialog === "stock" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Operation</Label>
                <Select value={stockOp} onValueChange={(v) => setStockOp(v as typeof stockOp)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Set quantity to</SelectItem>
                    <SelectItem value="adjust">Adjust quantity by</SelectItem>
                    <SelectItem value="set_status">Set stock status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {stockOp === "set_status" ? (
                <div>
                  <Label className="text-xs">Stock status</Label>
                  <Select value={stockStatusVal} onValueChange={(v) => setStockStatusVal(v as typeof stockStatusVal)}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instock">In stock</SelectItem>
                      <SelectItem value="outofstock">Out of stock</SelectItem>
                      <SelectItem value="onbackorder">On backorder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" value={stockValue} onChange={(e) => setStockValue(e.target.value)} className="mt-1" placeholder="0" />
                </div>
              )}
            </div>
          )}

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
                <Label className="text-xs">Mode</Label>
                <Select value={categoryMode} onValueChange={(v) => setCategoryMode(v as typeof categoryMode)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add categories</SelectItem>
                    <SelectItem value="remove">Remove categories</SelectItem>
                    <SelectItem value="replace">Replace with</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Categories</Label>
                <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border p-2 space-y-1">
                  {categoryOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No categories available</p>
                  ) : categoryOptions.map((name) => {
                    const id = name;
                    const checked = bulkCategoryIds.has(id as unknown as number);
                    return (
                      <label key={name} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setBulkCategoryIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(id as unknown as number);
                              else next.delete(id as unknown as number);
                              return next;
                            });
                          }}
                        />
                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Note: category lookup uses names. For ID-precise targeting, use the bulk-jobs page.</p>
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