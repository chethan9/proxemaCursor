import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Search, Columns3, ArrowUpDown, Download, Package, Loader2, ImageIcon, LayoutGrid, List, Grid3x3, Filter } from "lucide-react";
import { getStore } from "@/services/storeService";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchProducts,
  getProductThumbnail,
  getCategoryNames,
  type ProductRow,
  type ProductSortField,
  type SortDirection,
} from "@/services/productService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OrdersTab } from "@/components/explore/OrdersTab";
import { TaxonomyTab } from "@/components/explore/TaxonomyTab";
import { ProductQuickEdit } from "@/components/explore/ProductQuickEdit";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

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

export default function ExploreStorePage() {
  const router = useRouter();
  const { id } = router.query;
  const storeId = typeof id === "string" ? id : "";

  const [store, setStore] = useState<StoreRow | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  // Products state
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const v = parseInt(localStorage.getItem("explore-page-size") || "50", 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 50;
  });
  const [productsLoading, setProductsLoading] = useState(false);

  // Filter/sort/view state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [excludeOutOfStock, setExcludeOutOfStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [sort, setSort] = useState(SORT_OPTIONS[0]);
  const [viewMode, setViewMode] = useState<"table" | "grid" | "compact">(() => {
    if (typeof window === "undefined") return "table";
    return (localStorage.getItem("explore-view-mode") as "table" | "grid" | "compact") || "table";
  });
  const [activeTab, setActiveTab] = useState("products");
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-view-mode", viewMode);
  }, [viewMode]);

  // Column visibility + order
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    image: true,
    id: false,
    name: true,
    status: true,
    sku: true,
    price: true,
    regular_price: false,
    sale_price: false,
    stock: true,
    stock_status: false,
    manage_stock: false,
    category: true,
    type: false,
    slug: false,
    wooId: false,
    parent_id: false,
    permalink: false,
    tax_status: false,
    tax_class: false,
    shipping_required: false,
    images_count: false,
    short_desc: false,
    description: false,
    attributes: false,
    sales: false,
    date_created: false,
    date_modified: false,
    created: false,
    updated: false,
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

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-col-order", JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("explore-page-size", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    if (!storeId) return;
    setStoreLoading(true);
    getStore(storeId)
      .then((s) => setStore(s))
      .catch((e) => console.error("Load store failed:", e))
      .finally(() => setStoreLoading(false));
  }, [storeId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, sort, storeId, excludeOutOfStock, pageSize, categoryFilter, stockStatusFilter, priceMin, priceMax]);

  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setProductsLoading(true);
    try {
      const { data, count } = await fetchProducts({
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
        priceMin: priceMin ? parseFloat(priceMin) : undefined,
        priceMax: priceMax ? parseFloat(priceMax) : undefined,
      });
      setProductCount(count);
      setProducts(data);
    } catch (e) {
      console.error("Load products failed:", e);
    } finally {
      setProductsLoading(false);
    }
  }, [storeId, page, pageSize, debouncedSearch, sort, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, priceMin, priceMax]);

  useEffect(() => {
    if (storeId) loadProducts();
  }, [storeId, loadProducts]);

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

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!storeId) return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("products")
        .select("categories")
        .eq("store_id", storeId)
        .limit(500)
        .then(({ data }) => {
          const set = new Set<string>();
          (data || []).forEach((r: { categories: unknown }) => {
            if (Array.isArray(r.categories)) {
              r.categories.forEach((c: unknown) => {
                const obj = c as { name?: string };
                if (obj?.name) set.add(obj.name);
              });
            }
          });
          setCategoryOptions(Array.from(set).sort());
        });
    });
  }, [storeId]);

  if (storeLoading) {
    return (
      <AuthGuard>
        <AppLayout title="Explore">
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-96 w-full" />
          </div>
        </AppLayout>
      </AuthGuard>
    );
  }

  if (!store) {
    return (
      <AuthGuard>
        <AppLayout title="Explore">
          <div className="p-6">Store not found</div>
        </AppLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppLayout title={store.name}>
        <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
          {/* Header with tabs inline */}
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/explore">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate leading-tight">{store.name}</h1>
              <p className="text-xs text-muted-foreground truncate">{store.url}</p>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-auto">
              <TabsList>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsContent value="products" className="space-y-3 mt-0">
              {/* Sticky toolbar: filters + pagination */}
              <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur border-b border-border">
                <Card>
                  <CardContent className="p-3 space-y-2">
                    {/* Row 1: search + filters + actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-0.5 rounded-md border border-border bg-background px-1 h-9">
                        {["all", "publish", "draft", "pending", "private"].map((s) => (
                          <Button
                            key={s}
                            variant={statusFilter === s ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs capitalize px-2.5"
                            onClick={() => setStatusFilter(s)}
                          >
                            {s === "all" ? "All" : s}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant={excludeOutOfStock ? "secondary" : "outline"}
                        size="sm"
                        className="h-9 text-xs gap-1.5 px-2.5"
                        onClick={() => setExcludeOutOfStock((v) => !v)}
                        title={excludeOutOfStock ? "Showing in-stock only — click to include out-of-stock" : "Exclude out-of-stock items"}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${excludeOutOfStock ? "bg-success" : "bg-muted-foreground/40"}`} />
                        EOS
                      </Button>

                      {categoryOptions.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={categoryFilter !== "all" ? "secondary" : "outline"}
                              size="sm"
                              className="h-9 text-xs gap-1.5 px-2.5"
                            >
                              <Filter className="h-3.5 w-3.5" />
                              <span className="max-w-[120px] truncate">
                                {categoryFilter === "all" ? "Categories" : categoryFilter}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-64 p-0">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                              <span className="text-xs font-semibold">Filter by category</span>
                              {categoryFilter !== "all" && (
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => setCategoryFilter("all")}>
                                  Clear
                                </Button>
                              )}
                            </div>
                            <div className="max-h-[280px] overflow-y-auto p-1">
                              <button
                                onClick={() => setCategoryFilter("all")}
                                className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${categoryFilter === "all" ? "bg-accent" : ""}`}
                              >
                                All categories
                              </button>
                              {categoryOptions.map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setCategoryFilter(cat)}
                                  className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate ${categoryFilter === cat ? "bg-accent" : ""}`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}

                      {(excludeOutOfStock || statusFilter !== "all" || search || categoryFilter !== "all" || stockStatusFilter !== "all" || priceMin || priceMax) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("all");
                            setExcludeOutOfStock(false);
                            setCategoryFilter("all");
                            setStockStatusFilter("all");
                            setPriceMin("");
                            setPriceMax("");
                          }}
                        >
                          Clear
                        </Button>
                      )}

                      <div className="flex-1 flex justify-center min-w-[200px]">
                        <div className="relative w-full max-w-[360px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search name or SKU..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 h-9">
                          <Button
                            variant={viewMode === "table" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setViewMode("table")}
                            title="Table view"
                          >
                            <List className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={viewMode === "grid" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setViewMode("grid")}
                            title="Grid view"
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={viewMode === "compact" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setViewMode("compact")}
                            title="Compact grid"
                          >
                            <Grid3x3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

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
                          <PopoverContent align="end" className="w-[680px] p-0" sideOffset={6}>
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                              <div>
                                <div className="text-sm font-medium">Customize columns</div>
                                <div className="text-[11px] text-muted-foreground">Click to show/hide</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    const all: Record<string, boolean> = {};
                                    COLUMNS.forEach((c) => { all[c.key] = true; });
                                    setVisibleCols(all as Record<ColumnKey, boolean>);
                                  }}
                                >
                                  Select all
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    const none: Record<string, boolean> = {};
                                    COLUMNS.forEach((c) => { none[c.key] = c.key === "name"; });
                                    setVisibleCols(none as Record<ColumnKey, boolean>);
                                    setColumnOrder(COLUMNS.map((c) => c.key));
                                  }}
                                >
                                  Reset
                                </Button>
                              </div>
                            </div>

                            <div className="max-h-[380px] overflow-y-auto p-4">
                              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                                {(() => {
                                  const groupMap: Record<string, string> = {
                                    "Basic": "Basic",
                                    "Pricing": "Pricing & Inventory",
                                    "Inventory": "Pricing & Inventory",
                                    "Tax & Shipping": "Tax, Taxonomy & Content",
                                    "Taxonomy": "Tax, Taxonomy & Content",
                                    "Content": "Tax, Taxonomy & Content",
                                    "Dates": "Dates",
                                  };
                                  const grouped: Record<string, typeof COLUMNS> = {};
                                  COLUMNS.forEach((c) => {
                                    const g = groupMap[c.group] || c.group;
                                    if (!grouped[g]) grouped[g] = [];
                                    grouped[g].push(c);
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

                        <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={exportCsv} disabled={products.length === 0} title="Export CSV">
                          <Download className="h-3.5 w-3.5" />
                        </Button>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
                          <Package className="h-3.5 w-3.5" />
                          <span className="font-medium">{productCount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: pagination (only shown when there are results) */}
                    {productCount > 0 && (
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
                            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, productCount)} of {productCount.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(0)} disabled={page === 0}>First</Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
                            <span className="px-2 font-medium">Page {page + 1} / {Math.max(1, Math.ceil(productCount / pageSize))}</span>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= productCount}>Next</Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(Math.max(0, Math.ceil(productCount / pageSize) - 1))} disabled={(page + 1) * pageSize >= productCount}>Last</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Products table or grid */}
              <Card>
                <CardContent className="p-0">
                  {viewMode !== "table" ? (
                    <div className="p-4">
                      {(() => {
                        const isCompact = viewMode === "compact";
                        const gridCls = isCompact
                          ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2"
                          : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3";

                        if (productsLoading) {
                          return (
                            <div className={gridCls}>
                              {Array.from({ length: isCompact ? 24 : 10 }).map((_, i) => (
                                <div key={`skg-${i}`} className="group relative border border-border rounded-md overflow-hidden bg-card hover:border-primary/50 hover:shadow-md transition cursor-pointer">
                                  <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                    <Skeleton className="aspect-square w-full rounded-none" />
                                    {!isCompact && (
                                      <div className="p-2.5 space-y-1.5">
                                        <Skeleton className="h-3.5 w-full" />
                                        <Skeleton className="h-3 w-2/3" />
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
                                  <div
                                    key={p.id}
                                    onClick={() => setEditingProduct(p)}
                                    className="group relative border border-border rounded-md overflow-hidden bg-card hover:border-primary/50 hover:shadow-md transition cursor-pointer"
                                    title={`${p.name || "—"}${p.sku ? ` · ${p.sku}` : ""}${p.price ? ` · ${p.price}` : ""}`}
                                  >
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
                                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-background/95 via-background/80 to-transparent opacity-0 group-hover:opacity-100 transition">
                                      <div className="text-[10px] font-medium leading-tight line-clamp-2">{p.name || "—"}</div>
                                      <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5">
                                        <span className="font-mono truncate">{p.sku || "—"}</span>
                                        <span className="font-mono font-medium text-foreground">{p.price || "—"}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={p.id} onClick={() => setEditingProduct(p)} className="group border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:shadow-md transition bg-card flex flex-col cursor-pointer">
                                  <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                    {thumb ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={thumb} alt="" className="h-full w-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                                    ) : (
                                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                                    )}
                                    <Badge variant="outline" className={`absolute top-1.5 left-1.5 capitalize text-[10px] ${cls} backdrop-blur-sm`}>
                                      {p.status === "publish" ? "Active" : p.status || "—"}
                                    </Badge>
                                    {p.sale_price && p.sale_price !== p.regular_price && p.regular_price && (
                                      <Badge className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground text-[10px]">
                                        Sale
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="p-2.5 space-y-1 flex-1 flex flex-col">
                                    <div className="text-[13px] font-medium leading-tight line-clamp-2 min-h-[32px]">{p.name || "—"}</div>
                                    <div className="text-[11px] text-muted-foreground truncate">{cats || "No category"}</div>
                                    <div className="flex items-end justify-between gap-2 pt-1 mt-auto border-t border-border/50">
                                      <div className="min-w-0">
                                        <div className="text-[10px] text-muted-foreground font-mono truncate">{p.sku || "—"}</div>
                                        <div className="text-xs font-semibold font-mono">
                                          {p.sale_price && p.sale_price !== p.regular_price ? (
                                            <>
                                              <span className="text-destructive">{p.sale_price}</span>
                                              <span className="ml-1 line-through text-muted-foreground text-xs">{p.regular_price}</span>
                                            </>
                                          ) : (
                                            <span>{p.price || "—"}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-right shrink-0">
                                        {p.stock_quantity != null ? (
                                          <span className={p.stock_quantity === 0 ? "text-destructive font-medium" : p.stock_quantity < 5 ? "text-warning font-medium" : ""}>
                                            {p.stock_quantity} qty
                                          </span>
                                        ) : p.stock_status === "instock" ? (
                                          <span className="text-success">In stock</span>
                                        ) : p.stock_status === "outofstock" ? (
                                          <span className="text-destructive">Out of stock</span>
                                        ) : (
                                          "—"
                                        )}
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
                            if (c.key === "price") {
                              const active = !!(priceMin || priceMax);
                              return (
                                <TableHead key={c.key} className={baseCls}>
                                  <div className="flex items-center gap-1">
                                    <span>{c.label}</span>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className={`h-5 w-5 p-0 ${active ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}>
                                          <Filter className="h-3 w-3" />
                                          {active && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent align="start" className="w-60 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold">Filter by price</span>
                                          {active && (
                                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 font-normal" onClick={() => { setPriceMin(""); setPriceMax(""); }}>
                                              Clear
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="number"
                                            value={priceMin}
                                            onChange={(e) => setPriceMin(e.target.value)}
                                            placeholder="Min"
                                            className="h-8 text-xs"
                                          />
                                          <span className="text-muted-foreground text-xs">to</span>
                                          <Input
                                            type="number"
                                            value={priceMax}
                                            onChange={(e) => setPriceMax(e.target.value)}
                                            placeholder="Max"
                                            className="h-8 text-xs"
                                          />
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </TableHead>
                              );
                            }
                            if (c.key === "stock" || c.key === "stock_status") {
                              const active = stockStatusFilter !== "all";
                              return (
                                <TableHead key={c.key} className={baseCls}>
                                  <div className="flex items-center gap-1">
                                    <span>{c.label}</span>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className={`h-5 w-5 p-0 relative ${active ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}>
                                          <Filter className="h-3 w-3" />
                                          {active && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent align="start" className="w-52 p-2">
                                        <div className="flex items-center justify-between mb-1 px-1">
                                          <span className="text-xs font-semibold">Filter by stock</span>
                                          {active && (
                                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 font-normal" onClick={() => setStockStatusFilter("all")}>
                                              Clear
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                          {[
                                            { v: "all", l: "All" },
                                            { v: "instock", l: "In stock" },
                                            { v: "outofstock", l: "Out of stock" },
                                            { v: "onbackorder", l: "On backorder" },
                                          ].map((o) => (
                                            <button
                                              key={o.v}
                                              onClick={() => setStockStatusFilter(o.v)}
                                              className={`text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${stockStatusFilter === o.v ? "bg-accent font-medium" : ""}`}
                                            >
                                              {o.l}
                                            </button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </TableHead>
                              );
                            }
                            return (
                              <TableHead key={c.key} className={baseCls}>
                                {c.label}
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsLoading ? (
                          Array.from({ length: 10 }).map((_, i) => (
                            <TableRow key={`sk-${i}`}>
                              {visibleColList.map((c) => (
                                <TableCell key={c.key}>
                                  {c.key === "image" ? (
                                    <Skeleton className="h-10 w-10 rounded" />
                                  ) : (
                                    <Skeleton className="h-4 w-24" />
                                  )}
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
                            return (
                              <TableRow key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setEditingProduct(p)}>
                                {visibleColList.map((c) => {
                                  if (c.key === "image") {
                                    return (
                                      <TableCell key={c.key}>
                                        {thumb ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={thumb}
                                            alt=""
                                            className="h-10 w-10 rounded object-cover border border-border"
                                            loading="lazy"
                                          />
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
                                  if (c.key === "sku") {
                                    return <TableCell key={c.key} className="font-mono text-sm text-muted-foreground">{p.sku || "—"}</TableCell>;
                                  }
                                  if (c.key === "price") {
                                    return (
                                      <TableCell key={c.key} className="font-mono text-sm">
                                        {p.sale_price && p.sale_price !== p.regular_price ? (
                                          <div>
                                            <span>{p.sale_price}</span>
                                            <span className="ml-1.5 line-through text-muted-foreground text-xs">{p.regular_price}</span>
                                          </div>
                                        ) : (
                                          p.price || "—"
                                        )}
                                      </TableCell>
                                    );
                                  }
                                  if (c.key === "stock") {
                                    const qty = p.stock_quantity;
                                    const status = p.stock_status;
                                    return (
                                      <TableCell key={c.key} className="text-sm">
                                        {qty != null ? (
                                          <span className={qty === 0 ? "text-destructive" : qty < 5 ? "text-warning" : ""}>
                                            {qty} in stock
                                          </span>
                                        ) : status === "instock" ? (
                                          <span className="text-success">In stock</span>
                                        ) : status === "outofstock" ? (
                                          <span className="text-destructive">Out of stock</span>
                                        ) : (
                                          "—"
                                        )}
                                      </TableCell>
                                    );
                                  }
                                  if (c.key === "category") {
                                    const cats = getCategoryNames(p.categories);
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[200px] truncate">{cats || "—"}</TableCell>;
                                  }
                                  if (c.key === "sales") {
                                    return (
                                      <TableCell key={c.key} className="text-xs text-muted-foreground">
                                        {p.synced_at ? new Date(p.synced_at).toLocaleString() : "—"}
                                      </TableCell>
                                    );
                                  }
                                  if (c.key === "created") {
                                    return (
                                      <TableCell key={c.key} className="text-xs text-muted-foreground">
                                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                                      </TableCell>
                                    );
                                  }
                                  if (c.key === "updated") {
                                    return (
                                      <TableCell key={c.key} className="text-xs text-muted-foreground">
                                        {p.updated_at ? new Date(p.updated_at).toLocaleString() : "—"}
                                      </TableCell>
                                    );
                                  }
                                  if (c.key === "regular_price") {
                                    return <TableCell key={c.key} className="font-mono text-sm">{p.regular_price || "—"}</TableCell>;
                                  }
                                  if (c.key === "sale_price") {
                                    return <TableCell key={c.key} className="font-mono text-sm">{p.sale_price || "—"}</TableCell>;
                                  }
                                  if (c.key === "stock_status") {
                                    const s = p.stock_status;
                                    return (
                                      <TableCell key={c.key} className="text-xs">
                                        <span className={s === "instock" ? "text-success" : s === "outofstock" ? "text-destructive" : "text-muted-foreground"}>
                                          {s || "—"}
                                        </span>
                                      </TableCell>
                                    );
                                  }
                                  if (c.key === "type") {
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground capitalize">{p.type || "—"}</TableCell>;
                                  }
                                  if (c.key === "slug") {
                                    return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{p.slug || "—"}</TableCell>;
                                  }
                                  if (c.key === "wooId") {
                                    return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground">{p.woo_id ?? "—"}</TableCell>;
                                  }
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
                                    const summary = attrs
                                      .map((a: unknown) => {
                                        const obj = a as { name?: string; options?: string[] };
                                        return obj.name ? `${obj.name}${obj.options?.length ? `: ${obj.options.slice(0,2).join(", ")}` : ""}` : "";
                                      })
                                      .filter(Boolean)
                                      .join(" • ");
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[260px] truncate">{summary || "—"}</TableCell>;
                                  }
                                  if (c.key === "id") {
                                    return <TableCell key={c.key} className="font-mono text-[11px] text-muted-foreground">{p.id.slice(0, 8)}…</TableCell>;
                                  }
                                  if (c.key === "manage_stock") {
                                    const ms = p.raw_data?.manage_stock;
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground">{ms === true ? "Yes" : ms === false ? "No" : "—"}</TableCell>;
                                  }
                                  if (c.key === "parent_id") {
                                    const pid = p.raw_data?.parent_id as number | undefined;
                                    return <TableCell key={c.key} className="font-mono text-xs text-muted-foreground">{pid || "—"}</TableCell>;
                                  }
                                  if (c.key === "permalink") {
                                    const link = p.raw_data?.permalink as string | undefined;
                                    return (
                                      <TableCell key={c.key} className="text-xs max-w-[220px] truncate">
                                        {link ? <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{link}</a> : "—"}
                                      </TableCell>
                                    );
                                  }
                                  if (c.key === "tax_status") {
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground capitalize">{(p.raw_data?.tax_status as string) || "—"}</TableCell>;
                                  }
                                  if (c.key === "tax_class") {
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground">{(p.raw_data?.tax_class as string) || "—"}</TableCell>;
                                  }
                                  if (c.key === "shipping_required") {
                                    const sr = p.raw_data?.shipping_required;
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground">{sr === true ? "Yes" : sr === false ? "No" : "—"}</TableCell>;
                                  }
                                  if (c.key === "images_count") {
                                    const n = Array.isArray(p.images) ? p.images.length : 0;
                                    return <TableCell key={c.key} className="text-xs text-muted-foreground">{n}</TableCell>;
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
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  )}

                  {/* Pagination controls */}
                  {false && !productsLoading && productCount > 0 && (
                    <div />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders">
              <OrdersTab storeId={storeId} />
            </TabsContent>
            <TabsContent value="tags">
              <TaxonomyTab storeId={storeId} mode="tags" />
            </TabsContent>
            <TabsContent value="categories">
              <TaxonomyTab storeId={storeId} mode="categories" />
            </TabsContent>
          </Tabs>
        </div>
        <ProductQuickEdit
          product={editingProduct}
          open={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(p) => {
            setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)));
          }}
        />
      </AppLayout>
    </AuthGuard>
  );
}