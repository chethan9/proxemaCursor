import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { ArrowLeft, Columns3, ArrowUpDown, Download, Package, ImageIcon, LayoutGrid, List, Grid3x3, ChevronDown, GripVertical, Search } from "lucide-react";
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
import { useBackgroundPagination } from "@/hooks/useBackgroundPagination";
import { queryKeys } from "@/lib/query-client";
import { fetchProducts } from "@/services/productService";
import { useQueryClient } from "@tanstack/react-query";
import { createBulkJob } from "@/services/bulkJobService";
import { DollarSign, Boxes, Tag as TagIcon, Trash2, X, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type ColumnKey = "image" | "id" | "name" | "status" | "sku" | "price" | "regular_price" | "sale_price" | "stock" | "stock_status" | "manage_stock" | "category" | "type" | "slug" | "wooId" | "parent_id" | "permalink" | "tax_status" | "tax_class" | "shipping_required" | "images_count" | "short_desc" | "description" | "attributes" | "sales" | "date_created" | "date_modified" | "created" | "updated";

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

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500];

interface ProductsTabProps {
  storeId: string;
  storeUrl?: string;
  search: string;
  storeName?: string;
  onSearchChange?: (v: string) => void;
  embedHeader?: boolean;
}

export function ProductsTab({ storeId, storeUrl, search, storeName, onSearchChange, embedHeader = false }: ProductsTabProps) {
  const queryClient = useQueryClient();
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
  const [quickEditProduct, setQuickEditProduct] = useState<ProductRow | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<null | "price" | "stock" | "status" | "category" | "delete">(null);
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

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    image: true, id: false, name: true, status: true, sku: true, price: true,
    regular_price: false, sale_price: false, stock: true, stock_status: false,
    manage_stock: false, category: true, type: false, slug: false, wooId: false,
    parent_id: false, permalink: false, tax_status: false, tax_class: false,
    shipping_required: false, images_count: false, short_desc: false, description: false,
    attributes: false, sales: false, date_created: false, date_modified: false,
    created: false, updated: false,
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [excludeOutOfStock, setExcludeOutOfStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState(SORT_OPTIONS[0]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-col-order", JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-page-size", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, sort, storeId, excludeOutOfStock, categoryFilter, stockStatusFilter, priceMin, priceMax]);

  const { data: productsResult, isLoading: loading } = useProducts({
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
  });
  const products = productsResult?.data ?? [];
  const productCount = productsResult?.count ?? 0;

  const submitBulk = useCallback(async () => {
    if (!bulkDialog || selectedIds.size === 0 || overLimit) return;
    const wooIds = products.filter((p) => selectedIds.has(p.id)).map((p) => p.woo_id).filter((id): id is number => id != null);
    if (wooIds.length === 0) return;
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

  useEffect(() => { setSelectedIds(new Set()); }, [storeId, debouncedSearch, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, priceMin, priceMax, page, pageSize]);

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
  const prefsLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prefsLoaded.current) return;
    const hasLocal = typeof window !== "undefined" && (localStorage.getItem("explore-col-order") || localStorage.getItem("explore-page-size") || localStorage.getItem("explore-view-mode"));
    if (hasLocal) { prefsLoaded.current = true; return; }
    fetchPreferences("products").then((remote) => {
      if (remote) {
        if (Array.isArray(remote.columnOrder)) setColumnOrder(remote.columnOrder as ColumnKey[]);
        if (remote.visibleCols && typeof remote.visibleCols === "object") setVisibleCols((cur) => ({ ...cur, ...(remote.visibleCols as Record<ColumnKey, boolean>) }));
        if (typeof remote.pageSize === "number") setPageSize(remote.pageSize);
        if (typeof remote.viewMode === "string") setViewMode(remote.viewMode as "table" | "grid" | "compact");
        if (typeof remote.statusFilter === "string") setStatusFilter(remote.statusFilter);
        if (typeof remote.excludeOutOfStock === "boolean") setExcludeOutOfStock(remote.excludeOutOfStock);
        if (typeof remote.categoryFilter === "string") setCategoryFilter(remote.categoryFilter);
        if (typeof remote.stockStatusFilter === "string") setStockStatusFilter(remote.stockStatusFilter);
        if (remote.sort && typeof remote.sort === "object") setSort(remote.sort as typeof SORT_OPTIONS[number]);
      }
      prefsLoaded.current = true;
    }).catch(() => { prefsLoaded.current = true; });
  }, []);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferences("products", { columnOrder, visibleCols, pageSize, viewMode, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, sort }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [columnOrder, visibleCols, pageSize, viewMode, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, sort]);

  const visibleColList = useMemo(
    () => columnOrder
      .map((k) => COLUMNS.find((c) => c.key === k))
      .filter((c): c is typeof COLUMNS[number] => !!c && visibleCols[c.key]),
    [visibleCols, columnOrder]
  );

  return (
    <div className="space-y-2">
      {embedHeader && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
          </div>
          <div className="flex-1" />
          <div className="w-full max-w-[288px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search products by name or SKU..." value={search} onChange={(e) => onSearchChange?.(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-shrink-0">
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
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title="Customize columns">
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
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" onClick={exportCsv} disabled={products.length === 0} title="Export CSV">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export</span>
            </Button>
          </div>
        </div>
      )}

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 -mx-6 px-6 pt-2 pb-1 bg-background/85 backdrop-blur border-b border-border [[data-theme-preset=modern]_&]:border-b-0 [[data-theme-preset=modern]_&]:pb-0">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-md border border-border bg-background px-1 h-9">
                {["all", "publish", "draft", "pending", "private"].map((s) => (
                  <Button key={s} variant="ghost" size="sm" className={`h-7 text-xs capitalize px-2.5 ${statusFilter === s ? "bg-foreground/10 text-foreground font-medium hover:bg-foreground/15" : ""}`} onClick={() => setStatusFilter(s)}>
                    {s === "all" ? "All" : s}
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background text-xs cursor-pointer select-none">
                <Switch checked={excludeOutOfStock} onCheckedChange={(v) => setExcludeOutOfStock(!!v)} />
                <span>Exclude out of stock</span>
              </label>
              {!embedHeader && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
                <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => {
                  setStatusFilter("all"); setExcludeOutOfStock(false); setCategoryFilter("all");
                  setStockStatusFilter("all"); setPriceMin(""); setPriceMax("");
                }}>Clear</Button>
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
                        <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title="Customize columns">
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
                    <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" onClick={exportCsv} disabled={products.length === 0} title="Export CSV">
                      <Download className="h-3.5 w-3.5" />
                      <span className="text-xs">Export</span>
                    </Button>
                  </>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
                  <Package className="h-3.5 w-3.5" />
                  <span className="font-medium">{productCount.toLocaleString()}</span>
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
                      {loading && productCount === 0 ? "Loading…" : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, productCount)} of ${productCount.toLocaleString()}`}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= productCount || loading}><ArrowLeft className="h-3.5 w-3.5 rotate-180" /></Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {viewMode !== "table" ? (
            <div className="p-4">
              {(() => {
                const isCompact = viewMode === "compact";
                const gridCls = isCompact
                  ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2"
                  : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3";
                if (loading) {
                  return (
                    <div className={gridCls}>
                      {Array.from({ length: isCompact ? 24 : 10 }).map((_, i) => (
                        <div key={`skg-${i}`} className="border border-border rounded-md overflow-hidden bg-card">
                          <Skeleton className="aspect-square w-full rounded-none" />
                        </div>
                      ))}
                    </div>
                  );
                }
                if (products.length === 0) {
                  return (
                    <div className="py-16 text-center">
                      <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No products found</p>
                    </div>
                  );
                }
                return (
                  <div className={gridCls}>
                    {products.map((p) => {
                      const thumb = getProductThumbnail(p.images);
                      const cats = getCategoryNames(p.categories);
                      const statusColor: Record<string, string> = {
                        publish: "bg-success/10 text-success border-success/20",
                        draft: "bg-muted text-muted-foreground border-border",
                        pending: "bg-warning/10 text-warning border-warning/20",
                        private: "bg-secondary text-secondary-foreground border-border",
                      };
                      const cls = statusColor[p.status || ""] || "bg-muted text-muted-foreground border-border";
                      if (isCompact) {
                        const stockLow = p.stock_quantity != null && p.stock_quantity < 5;
                        const stockOut = p.stock_quantity === 0 || p.stock_status === "outofstock";
                        return (
                          <div key={p.id} onClick={() => setQuickEditProduct(p)} className="group relative border border-border rounded-md overflow-hidden bg-card hover:border-primary/50 hover:shadow-md transition cursor-pointer">
                            <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                              )}
                              {stockOut && (
                                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                                  <span className="text-[9px] font-semibold uppercase text-destructive">Out</span>
                                </div>
                              )}
                              {!stockOut && stockLow && (
                                <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-warning ring-1 ring-background" />
                              )}
                            </div>
                          </div>
                        );
                      }
                      const dotColor: Record<string, string> = {
                        publish: "bg-success",
                        draft: "bg-muted-foreground/50",
                        pending: "bg-warning",
                        private: "bg-muted-foreground/50",
                      };
                      const dot = dotColor[p.status || ""] || "bg-muted-foreground/50";
                      const label = p.status === "publish" ? "Active" : (p.status || "—");
                      return (
                        <div key={p.id} onClick={() => setQuickEditProduct(p)} className="group border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:shadow-md transition bg-card flex flex-col cursor-pointer">
                          <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="" className="h-full w-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                            ) : (
                              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                            )}
                            <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm border border-border/60">
                              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                              <span className="capitalize">{label}</span>
                            </div>
                          </div>
                          <div className="p-2.5 space-y-1 flex-1 flex flex-col">
                            <div className="text-[13px] font-medium leading-tight line-clamp-2 min-h-[32px]">{p.name || "—"}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{cats || "No category"}</div>
                            <div className="flex items-end justify-between gap-2 pt-1 mt-auto border-t border-border/50">
                              <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground font-mono truncate">{p.sku || "—"}</div>
                                <div className="text-xs font-semibold font-mono">{p.price || "—"}</div>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
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
                      return (
                        <TableHead key={c.key} className={`${baseCls} ${alignCls} cursor-move select-none ${dragKey === c.key ? "opacity-50" : ""}`} {...dragProps}>
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
                        {visibleColList.map((c) => (
                          <TableCell key={c.key}>
                            {c.key === "image" ? <Skeleton className="h-10 w-10 rounded" /> : <Skeleton className="h-4 w-24" />}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColList.length} className="text-center py-16">
                        <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No products found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((p) => {
                      const thumb = getProductThumbnail(p.images);
                      const isExpanded = expandedRowId === p.id;
                      return (
                        <>
                          <TableRow key={p.id} className={`hover:bg-muted/30 cursor-pointer transition-colors ${isExpanded ? "bg-muted/30 !border-b-0" : ""}`} onClick={() => setExpandedRowId((cur) => (cur === p.id ? null : p.id))}>
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
                                    <div className="font-medium truncate">{p.name || "—"}</div>
                                    {p.type && p.type !== "simple" && (
                                      <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{p.type}</div>
                                    )}
                                  </TableCell>
                                );
                              }
                              if (c.key === "status") {
                                const statusColor: Record<string, string> = {
                                  publish: "bg-success/10 text-success border-success/20",
                                  draft: "bg-muted text-muted-foreground border-border",
                                  pending: "bg-warning/10 text-warning border-warning/20",
                                  private: "bg-secondary text-secondary-foreground border-border",
                                };
                                const cls = statusColor[p.status || ""] || "bg-muted text-muted-foreground border-border";
                                return (
                                  <TableCell key={c.key}>
                                    <Badge variant="outline" className={`capitalize text-[10px] ${cls}`}>
                                      {p.status === "publish" ? "Active" : p.status || "—"}
                                    </Badge>
                                  </TableCell>
                                );
                              }
                              if (c.key === "sku") return <TableCell key={c.key} className="font-mono text-sm text-muted-foreground">{p.sku || "—"}</TableCell>;
                              if (c.key === "price") {
                                return (
                                  <TableCell key={c.key} className="font-mono text-sm text-right">
                                    {p.sale_price && p.sale_price !== p.regular_price ? (
                                      <div>
                                        <span>{p.sale_price}</span>
                                        <span className="ml-1.5 line-through text-muted-foreground text-xs">{p.regular_price}</span>
                                      </div>
                                    ) : (p.price || "—")}
                                  </TableCell>
                                );
                              }
                              if (c.key === "stock") {
                                const qty = p.stock_quantity;
                                const status = p.stock_status;
                                return (
                                  <TableCell key={c.key} className="text-sm text-right">
                                    {qty != null ? (
                                      <span className={qty === 0 ? "text-destructive" : qty < 5 ? "text-warning" : ""}>{qty} in stock</span>
                                    ) : status === "instock" ? (
                                      <span className="text-success">In stock</span>
                                    ) : status === "outofstock" ? (
                                      <span className="text-destructive">Out of stock</span>
                                    ) : "—"}
                                  </TableCell>
                                );
                              }
                              if (c.key === "category") {
                                const cats = getCategoryNames(p.categories);
                                return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[200px] truncate">{cats || "—"}</TableCell>;
                              }
                              if (c.key === "sales") return <TableCell key={c.key} className="text-xs text-muted-foreground">{p.synced_at ? new Date(p.synced_at).toLocaleString() : "—"}</TableCell>;
                              if (c.key === "created") return <TableCell key={c.key} className="text-xs text-muted-foreground">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</TableCell>;
                              if (c.key === "updated") return <TableCell key={c.key} className="text-xs text-muted-foreground">{p.updated_at ? new Date(p.updated_at).toLocaleString() : "—"}</TableCell>;
                              if (c.key === "regular_price") return <TableCell key={c.key} className="font-mono text-sm text-right">{p.regular_price || "—"}</TableCell>;
                              if (c.key === "sale_price") return <TableCell key={c.key} className="font-mono text-sm text-right">{p.sale_price || "—"}</TableCell>;
                              if (c.key === "stock_status") {
                                const s = p.stock_status;
                                return (
                                  <TableCell key={c.key} className="text-xs">
                                    <span className={s === "instock" ? "text-success" : s === "outofstock" ? "text-destructive" : "text-muted-foreground"}>{s || "—"}</span>
                                  </TableCell>
                                );
                              }
                              if (c.key === "type") return <TableCell key={c.key} className="text-xs text-muted-foreground capitalize">{p.type || "—"}</TableCell>;
                              if (c.key === "slug") return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{p.slug || "—"}</TableCell>;
                              if (c.key === "wooId") return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground text-right">{p.woo_id ?? "—"}</TableCell>;
                              if (c.key === "parent_id") {
                                const pid = p.raw_data?.parent_id as number | undefined;
                                return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground text-right">{pid || "—"}</TableCell>;
                              }
                              if (c.key === "permalink") {
                                const link = p.raw_data?.permalink as string | undefined;
                                return <TableCell key={c.key} className="text-xs max-w-[220px] truncate">{link ? <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{link}</a> : "—"}</TableCell>;
                              }
                              if (c.key === "tax_status") return <TableCell key={c.key} className="text-xs text-muted-foreground capitalize">{(p.raw_data?.tax_status as string) || "—"}</TableCell>;
                              if (c.key === "tax_class") return <TableCell key={c.key} className="text-xs text-muted-foreground">{(p.raw_data?.tax_class as string) || "—"}</TableCell>;
                              if (c.key === "shipping_required") {
                                const sr = p.raw_data?.shipping_required;
                                return <TableCell key={c.key} className="text-xs text-muted-foreground">{sr === true ? "Yes" : sr === false ? "No" : "—"}</TableCell>;
                              }
                              if (c.key === "images_count") return <TableCell key={c.key} className="text-xs text-muted-foreground text-right">{Array.isArray(p.images) ? p.images.length : 0}</TableCell>;
                              if (c.key === "short_desc") {
                                const txt = (p.short_description || "").replace(/<[^>]+>/g, "");
                                return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[280px] truncate">{txt || "—"}</TableCell>;
                              }
                              if (c.key === "description") {
                                const txt = (p.description || "").replace(/<[^>]+>/g, "");
                                return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[320px] truncate">{txt || "—"}</TableCell>;
                              }
                              if (c.key === "attributes") {
                                const attrs = Array.isArray(p.attributes) ? p.attributes : [];
                                const summary = attrs.map((a: unknown) => {
                                  const obj = a as { name?: string; options?: string[] };
                                  return obj.name ? `${obj.name}${obj.options?.length ? `: ${obj.options.slice(0, 2).join(", ")}` : ""}` : "";
                                }).filter(Boolean).join(" • ");
                                return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[260px] truncate">{summary || "—"}</TableCell>;
                              }
                              if (c.key === "date_created") {
                                const d = p.raw_data?.date_created as string | undefined;
                                return <TableCell key={c.key} className="text-xs text-muted-foreground">{d ? new Date(d).toLocaleString() : "—"}</TableCell>;
                              }
                              if (c.key === "date_modified") {
                                const d = p.raw_data?.date_modified as string | undefined;
                                return <TableCell key={c.key} className="text-xs text-muted-foreground">{d ? new Date(d).toLocaleString() : "—"}</TableCell>;
                              }
                              return <TableCell key={c.key}>—</TableCell>;
                            })}
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${p.id}-exp`} className="hover:bg-muted/30 bg-muted/30 !border-t-0">
                              <TableCell colSpan={visibleColList.length} className="p-0">
                                <ProductRowExpanded
                                  product={p}
                                  storeUrl={storeUrl}
                                  onClose={() => setExpandedRowId(null)}
                                  onSaved={(updated) => {
                                    setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                                  }}
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
          )}
        </CardContent>
      </Card>

      <ProductQuickEdit
        product={quickEditProduct}
        open={!!quickEditProduct}
        onClose={() => setQuickEditProduct(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["products", storeId] });
          setQuickEditProduct(null);
        }}
      />
    </div>
  );
}