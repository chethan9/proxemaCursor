import { useEffect, useState, useCallback } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ArrowLeft, Package, ImageIcon, LayoutGrid, List, Grid3x3, Search, DollarSign, Boxes, Tag as TagIcon, Trash2, X, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import {
  getProductThumbnail,
  getCategoryNames,
  type ProductRow,
} from "@/services/productService";
import { ProductQuickEdit } from "@/components/explore/ProductQuickEdit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts, useProductCategoryOptions } from "@/hooks/queries/useProducts";
import { useQueryClient } from "@tanstack/react-query";
import { createBulkJob } from "@/services/bulkJobService";
import { supabase } from "@/integrations/supabase/client";

type ViewMode = "list" | "grid" | "compact";
type BulkDialogType = null | "price" | "stock" | "status" | "category" | "delete";

interface ProductsTabProps {
  storeId: string;
  storeUrl: string;
  storeName: string;
  search: string;
  onSearchChange: (v: string) => void;
  embedHeader?: boolean;
}

export function ProductsTab({ storeId, storeUrl, search, storeName, onSearchChange, embedHeader = false }: ProductsTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [quickEditProduct, setQuickEditProduct] = useState<ProductRow | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<BulkDialogType>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [priceOp, setPriceOp] = useState<"set" | "increase_pct" | "decrease_pct" | "increase_fixed" | "decrease_fixed" | "set_sale">("set");
  const [priceValue, setPriceValue] = useState("");
  const [stockOp, setStockOp] = useState<"set" | "adjust" | "set_status">("set");
  const [stockValue, setStockValue] = useState("");
  const [stockStatus, setStockStatus] = useState<"instock" | "outofstock" | "onbackorder">("instock");
  const [newProductStatus, setNewProductStatus] = useState<"publish" | "draft" | "pending" | "private">("publish");
  const [categoryMode, setCategoryMode] = useState<"add" | "remove" | "replace">("add");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  const [allCategories, setAllCategories] = useState<{ woo_id: number; name: string }[]>([]);

  const MAX_BULK = 500;
  const overLimit = selectedIds.size > MAX_BULK;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, categoryFilter]);
  useEffect(() => { setSelectedIds(new Set()); }, [storeId, debouncedSearch, statusFilter, categoryFilter, page]);

  const { data: productsResult, isLoading } = useProducts({
    storeId,
    page,
    pageSize,
    search: debouncedSearch,
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
    categoryFilter: categoryFilter === "all" ? undefined : categoryFilter,
    sortField: "woo_date_created",
    sortDirection: "desc",
    excludeOutOfStock: false,
  });
  const products = productsResult?.data ?? [];
  const productCount = productsResult?.count ?? 0;
  const { data: categoryOptions = [] } = useProductCategoryOptions(storeId);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (bulkDialog === "category" && allCategories.length === 0 && storeId) {
      supabase
        .from("categories")
        .select("woo_id,name")
        .eq("store_id", storeId)
        .order("name")
        .then(({ data }) => {
          if (data) {
            setAllCategories(data.filter((c): c is { woo_id: number; name: string } => c.woo_id != null));
          }
        });
    }
  }, [bulkDialog, storeId, allCategories.length]);

  const submitBulk = useCallback(async () => {
    if (!bulkDialog || selectedIds.size === 0 || overLimit) return;
    const wooIds = products
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.woo_id)
      .filter((id): id is number => id != null);
    if (wooIds.length === 0) {
      toast({ title: "Nothing to process", variant: "destructive" });
      return;
    }
    setBulkSubmitting(true);
    try {
      if (bulkDialog === "price") {
        const num = Number(priceValue);
        if (!priceValue || Number.isNaN(num)) {
          toast({ title: "Enter a valid number", variant: "destructive" });
          setBulkSubmitting(false);
          return;
        }
        await createBulkJob({
          store_id: storeId,
          job_type: "update_product_price",
          total: wooIds.length,
          payload: { type: "update_product_price", product_ids: wooIds, operation: priceOp, value: num },
        });
      } else if (bulkDialog === "stock") {
        if (stockOp === "set_status") {
          await createBulkJob({
            store_id: storeId,
            job_type: "update_product_stock",
            total: wooIds.length,
            payload: { type: "update_product_stock", product_ids: wooIds, operation: "set_status", stock_status: stockStatus },
          });
        } else {
          const num = Number(stockValue);
          if (!stockValue || Number.isNaN(num)) {
            toast({ title: "Enter a valid number", variant: "destructive" });
            setBulkSubmitting(false);
            return;
          }
          await createBulkJob({
            store_id: storeId,
            job_type: "update_product_stock",
            total: wooIds.length,
            payload: { type: "update_product_stock", product_ids: wooIds, operation: stockOp, value: num },
          });
        }
      } else if (bulkDialog === "status") {
        await createBulkJob({
          store_id: storeId,
          job_type: "update_product_status",
          total: wooIds.length,
          payload: { type: "update_product_status", product_ids: wooIds, new_status: newProductStatus },
        });
      } else if (bulkDialog === "category") {
        if (selectedCategoryIds.size === 0) {
          toast({ title: "Pick at least one category", variant: "destructive" });
          setBulkSubmitting(false);
          return;
        }
        await createBulkJob({
          store_id: storeId,
          job_type: "assign_product_categories",
          total: wooIds.length,
          payload: { type: "assign_product_categories", product_ids: wooIds, mode: categoryMode, category_ids: Array.from(selectedCategoryIds) },
        });
      } else if (bulkDialog === "delete") {
        await createBulkJob({
          store_id: storeId,
          job_type: "delete_products",
          total: wooIds.length,
          payload: { type: "delete_products", product_ids: wooIds, force: false },
        });
      }
      toast({ title: "Bulk job queued", description: `Processing ${wooIds.length} products in background.` });
      setSelectedIds(new Set());
      setBulkDialog(null);
      setPriceValue("");
      setStockValue("");
      setSelectedCategoryIds(new Set());
    } catch (err) {
      toast({
        title: "Failed to queue",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBulkSubmitting(false);
    }
  }, [bulkDialog, selectedIds, overLimit, products, storeId, priceOp, priceValue, stockOp, stockValue, stockStatus, newProductStatus, categoryMode, selectedCategoryIds, toast]);

  const allVisibleSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(products.map((p) => p.id)));
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      {embedHeader && (
        <div className="flex items-center gap-3">
          <Link href={`/sites/${storeId}/home`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          </Link>
          <h1 className="text-xl font-semibold">{storeName} — Products</h1>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="publish">Publish</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions.map((c) => {
              const opt = c as unknown as { woo_id: number; name: string };
              return (
                <SelectItem key={opt.woo_id} value={String(opt.woo_id)}>{opt.name}</SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1 border border-border rounded-md p-0.5">
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={viewMode === "compact" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("compact")}><Grid3x3 className="h-4 w-4" /></Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className={`flex items-center gap-3 px-4 py-2.5 border border-border rounded-md ${overLimit ? "bg-destructive/5 border-destructive/30" : "bg-primary/5 border-primary/30"}`}>
          <Badge variant="secondary" className="font-mono text-xs">{selectedIds.size}</Badge>
          <span className="text-xs font-medium">selected</span>
          {overLimit && <span className="text-[11px] text-destructive">(max {MAX_BULK} per job)</span>}
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit} onClick={() => setBulkDialog("price")}>
            <DollarSign className="h-3.5 w-3.5" />Price
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit} onClick={() => setBulkDialog("stock")}>
            <Boxes className="h-3.5 w-3.5" />Stock
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit}>
                <CheckCircle2 className="h-3.5 w-3.5" />Status<ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Change status to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["publish", "draft", "pending", "private"] as const).map((s) => (
                <DropdownMenuItem key={s} onClick={() => { setNewProductStatus(s); setBulkDialog("status"); }} className="capitalize text-xs">{s}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={overLimit} onClick={() => setBulkDialog("category")}>
            <TagIcon className="h-3.5 w-3.5" />Categories
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" disabled={overLimit} onClick={() => setBulkDialog("delete")}>
            <Trash2 className="h-3.5 w-3.5" />Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setSelectedIds(new Set())}>
            <X className="h-3.5 w-3.5" />Clear
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No products found</p>
            </div>
          ) : viewMode === "list" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 pl-2"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} /></TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const thumb = getProductThumbnail(p);
                  const isSel = selectedIds.has(p.id);
                  return (
                    <TableRow key={p.id} onClick={() => setQuickEditProduct(p)} className={`cursor-pointer hover:bg-muted/30 ${isSel ? "bg-primary/5" : ""}`}>
                      <TableCell className="w-8 pl-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSel} onCheckedChange={() => toggleSelect(p.id)} />
                      </TableCell>
                      <TableCell>
                        {thumb ? (
                          <div className="relative h-10 w-10 rounded overflow-hidden bg-muted">
                            <Image src={thumb} alt={p.name || ""} fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground/50" /></div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{p.sku || "—"}</TableCell>
                      <TableCell>{p.price ?? "—"}</TableCell>
                      <TableCell>{p.stock_quantity ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{p.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : viewMode === "compact" ? (
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {products.map((p) => {
                const thumb = getProductThumbnail(p);
                const isSel = selectedIds.has(p.id);
                return (
                  <div key={p.id} className={`relative border rounded-md overflow-hidden bg-card hover:border-primary/50 cursor-pointer ${isSel ? "border-primary ring-1 ring-primary" : "border-border"}`} onClick={() => setQuickEditProduct(p)}>
                    <div className="absolute top-1 left-1 z-10" onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}>
                      <Checkbox checked={isSel} className="bg-background/90" />
                    </div>
                    <div className="relative aspect-square bg-muted">
                      {thumb ? <Image src={thumb} alt={p.name || ""} fill className="object-cover" unoptimized /> : <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/40" /></div>}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.price ?? "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map((p) => {
                const thumb = getProductThumbnail(p);
                const cats = getCategoryNames(p);
                const isSel = selectedIds.has(p.id);
                return (
                  <div key={p.id} className={`relative border rounded-lg overflow-hidden hover:shadow-md transition bg-card flex flex-col cursor-pointer ${isSel ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"}`} onClick={() => setQuickEditProduct(p)}>
                    <div className="absolute top-2 left-2 z-10" onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}>
                      <Checkbox checked={isSel} className="bg-background/90" />
                    </div>
                    <div className="relative aspect-square bg-muted">
                      {thumb ? <Image src={thumb} alt={p.name || ""} fill className="object-cover" unoptimized /> : <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground/40" /></div>}
                      <Badge variant="outline" className="absolute top-2 right-2 bg-background/90 backdrop-blur capitalize text-xs">{p.status}</Badge>
                    </div>
                    <div className="p-3 flex flex-col gap-1">
                      <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                      {cats && <p className="text-xs text-muted-foreground truncate">{cats}</p>}
                      <div className="flex items-baseline justify-between mt-auto pt-1">
                        <p className="text-xs text-muted-foreground">{p.sku || "—"}</p>
                        <p className="text-sm font-semibold">{p.price ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {productCount > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Page {page + 1} of {Math.ceil(productCount / pageSize)} — {productCount} total</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= productCount} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
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

      <Dialog open={bulkDialog === "price"} onOpenChange={(v) => !v && setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update price for {selectedIds.size} products</DialogTitle>
            <DialogDescription>Changes are queued and pushed to WooCommerce in the background.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-xs">Operation</Label>
              <Select value={priceOp} onValueChange={(v) => setPriceOp(v as typeof priceOp)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set regular price to…</SelectItem>
                  <SelectItem value="set_sale">Set sale price to…</SelectItem>
                  <SelectItem value="increase_pct">Increase by %</SelectItem>
                  <SelectItem value="decrease_pct">Decrease by %</SelectItem>
                  <SelectItem value="increase_fixed">Increase by fixed amount</SelectItem>
                  <SelectItem value="decrease_fixed">Decrease by fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} placeholder="e.g. 19.99 or 10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)} disabled={bulkSubmitting}>Cancel</Button>
            <Button onClick={submitBulk} disabled={bulkSubmitting}>{bulkSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Queueing…</> : "Queue job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialog === "stock"} onOpenChange={(v) => !v && setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update stock for {selectedIds.size} products</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-xs">Operation</Label>
              <Select value={stockOp} onValueChange={(v) => setStockOp(v as typeof stockOp)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set stock quantity to…</SelectItem>
                  <SelectItem value="adjust">Adjust by (+ or -)</SelectItem>
                  <SelectItem value="set_status">Set stock status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {stockOp !== "set_status" ? (
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input type="number" value={stockValue} onChange={(e) => setStockValue(e.target.value)} placeholder={stockOp === "adjust" ? "e.g. -5 or 10" : "e.g. 50"} />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Stock status</Label>
                <Select value={stockStatus} onValueChange={(v) => setStockStatus(v as typeof stockStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instock">In stock</SelectItem>
                    <SelectItem value="outofstock">Out of stock</SelectItem>
                    <SelectItem value="onbackorder">On backorder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)} disabled={bulkSubmitting}>Cancel</Button>
            <Button onClick={submitBulk} disabled={bulkSubmitting}>{bulkSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Queueing…</> : "Queue job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialog === "status"} onOpenChange={(v) => !v && setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status of {selectedIds.size} products to &quot;{newProductStatus}&quot;?</DialogTitle>
            <DialogDescription>Changes are queued and pushed to WooCommerce in the background.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)} disabled={bulkSubmitting}>Cancel</Button>
            <Button onClick={submitBulk} disabled={bulkSubmitting}>{bulkSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Queueing…</> : "Queue job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialog === "category"} onOpenChange={(v) => !v && setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign categories to {selectedIds.size} products</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={categoryMode} onValueChange={(v) => setCategoryMode(v as typeof categoryMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add to existing</SelectItem>
                  <SelectItem value="remove">Remove from existing</SelectItem>
                  <SelectItem value="replace">Replace all</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categories ({selectedCategoryIds.size} selected)</Label>
              <div className="max-h-60 overflow-auto border border-border rounded-md p-2 flex flex-col gap-1">
                {allCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Loading categories…</p>
                ) : (
                  allCategories.map((c) => {
                    const checked = selectedCategoryIds.has(c.woo_id);
                    return (
                      <label key={c.woo_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedCategoryIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(c.woo_id);
                              else next.delete(c.woo_id);
                              return next;
                            });
                          }}
                        />
                        {c.name}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)} disabled={bulkSubmitting}>Cancel</Button>
            <Button onClick={submitBulk} disabled={bulkSubmitting}>{bulkSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Queueing…</> : "Queue job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialog === "delete"} onOpenChange={(v) => !v && setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} products?</DialogTitle>
            <DialogDescription>They will be moved to trash in WooCommerce and removed from the mirror. This cannot be undone here.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)} disabled={bulkSubmitting}>Cancel</Button>
            <Button variant="destructive" onClick={submitBulk} disabled={bulkSubmitting}>{bulkSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Queueing…</> : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}