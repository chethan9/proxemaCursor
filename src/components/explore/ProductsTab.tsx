import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";
import { ArrowLeft, Package, ImageIcon, LayoutGrid, List, Grid3x3, Search } from "lucide-react";
import {
  getProductThumbnail,
  getCategoryNames,
  type ProductRow,
} from "@/services/productService";
import { ProductQuickEdit } from "@/components/explore/ProductQuickEdit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts, useProductCategoryOptions } from "@/hooks/queries/useProducts";
import { useQueryClient } from "@tanstack/react-query";

type ViewMode = "list" | "grid" | "compact";

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
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [quickEditProduct, setQuickEditProduct] = useState<ProductRow | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, categoryFilter]);

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
                  return (
                    <TableRow key={p.id} onClick={() => setQuickEditProduct(p)} className="cursor-pointer hover:bg-muted/30">
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
                return (
                  <div key={p.id} onClick={() => setQuickEditProduct(p)} className="border border-border rounded-md overflow-hidden bg-card hover:border-primary/50 cursor-pointer">
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
                return (
                  <div key={p.id} onClick={() => setQuickEditProduct(p)} className="border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:shadow-md transition bg-card flex flex-col cursor-pointer">
                    <div className="relative aspect-square bg-muted">
                      {thumb ? <Image src={thumb} alt={p.name || ""} fill className="object-cover" unoptimized /> : <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground/40" /></div>}
                      <Badge variant="outline" className="absolute top-2 left-2 bg-background/90 backdrop-blur capitalize text-xs">{p.status}</Badge>
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
    </div>
  );
}