import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pencil } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "next-i18next";
import { formatDate } from "@/lib/format-number";

async function patchProduct(storeId: string, productId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return res.json();
}

type Product = {
  id: string;
  store_id: string;
  woo_id: number | null;
  name: string | null;
  /** WooCommerce product type, e.g. `simple` | `variable` */
  type?: string | null;
  sku: string | null;
  regular_price: string | number | null;
  sale_price: string | number | null;
  manage_stock?: boolean | null;
  stock_quantity: number | null;
  stock_status: string | null;
  status: string | null;
  synced_at?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null;
  siteName?: string;
};

export function ProductQuickEdit({ open, onOpenChange, product, siteName }: Props) {
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [regular, setRegular] = useState("");
  const [sale, setSale] = useState("");
  const [stockStatus, setStockStatus] = useState("instock");
  const [stockQty, setStockQty] = useState<string>("");
  const [status, setStatus] = useState("publish");
  const [manageStock, setManageStock] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setSku(product.sku || "");
      setRegular(product.regular_price != null ? String(product.regular_price) : "");
      setSale(product.sale_price != null ? String(product.sale_price) : "");
      setStockStatus(product.stock_status || "instock");
      setStockQty(product.stock_quantity != null ? String(product.stock_quantity) : "");
      setStatus(product.status || "publish");
      setManageStock(!!product.manage_stock);
    }
  }, [product]);

  const mutation = useSiteMutation<Record<string, unknown>, Record<string, unknown>>({
    mutationFn: (patch) => patchProduct(product!.store_id, product!.id, patch),
    invalidateKeys: product ? [queryKeys.products(product.store_id), ["product", product.id]] : [],
    track: product ? { entityType: "product", storeId: product.store_id, entityId: () => product.id } : undefined,
    optimisticUpdates: product
      ? [
          {
            queryKey: queryKeys.products(product.store_id),
            updater: (old, patch) => {
              const apply = (rows: Product[]) =>
                rows.map((p) => (p.id === product.id ? { ...p, ...(patch as Partial<Product>) } : p));
              if (Array.isArray(old)) return apply(old as Product[]);
              if (old && typeof old === "object" && "pages" in old) {
                const o = old as { pages: Array<{ data: Product[] }>; pageParams?: unknown[] };
                return {
                  ...o,
                  pages: o.pages.map((page) => ({ ...page, data: apply(page.data) })),
                };
              }
              return old;
            },
          },
        ]
      : [],
    siteName,
    successToast: "Synced to WooCommerce",
    onSuccessExtra: () => onOpenChange(false),
  });

  if (!product) return null;

  const isVariable = product.type === "variable";

  const clampNonNeg = (v: string): string => {
    if (v === "" || v === "-") return "";
    const n = parseFloat(v);
    if (Number.isNaN(n)) return v;
    return n < 0 ? "0" : v;
  };

  function handleSave() {
    if (!isVariable) {
      const regNum = parseFloat(regular);
      if (!regular || Number.isNaN(regNum) || regNum <= 0) {
        toast({ title: "Invalid price", description: "Regular price must be greater than 0.", variant: "destructive" });
        return;
      }
      if (sale) {
        const saleNum = parseFloat(sale);
        if (Number.isNaN(saleNum) || saleNum <= 0) {
          toast({ title: "Invalid sale price", description: "Sale price must be greater than 0.", variant: "destructive" });
          return;
        }
        if (saleNum >= regNum) {
          toast({ title: "Invalid sale price", description: "Sale price must be less than regular price.", variant: "destructive" });
          return;
        }
      }
    }
    if (manageStock && stockQty !== "") {
      const qtyNum = Number(stockQty);
      if (Number.isNaN(qtyNum) || qtyNum < 0) {
        toast({ title: "Invalid quantity", description: "Stock quantity cannot be negative.", variant: "destructive" });
        return;
      }
    }
    const patch: Record<string, unknown> = {
      name,
      sku,
      status,
      stock_status: stockStatus,
      manage_stock: manageStock,
    };
    if (product.type) patch.type = product.type;
    if (!isVariable) {
      patch.regular_price = regular;
      patch.sale_price = sale;
    }
    if (manageStock) patch.stock_quantity = stockQty === "" ? null : Number(stockQty);
    mutation.mutate(patch);
  }

  const setQtyRaw = (v: string) => {
    const clean = clampNonNeg(v);
    setStockQty(clean);
    if (clean === "") return;
    const n = Number(clean);
    if (Number.isNaN(n)) return;
    setManageStock(true);
    if (n === 0) setStockStatus("outofstock");
    else if (stockStatus !== "onbackorder") setStockStatus("instock");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-background p-5 gap-3 text-foreground shadow-lg">
        <DialogHeader className="space-y-0.5">
          <DialogTitle className="text-base text-foreground">Quick edit</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Syncs to WooCommerce immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground" required>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground" required={status === "publish" && !isVariable}>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} className="h-8 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 bg-card text-sm text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground" required={status === "publish" && !isVariable}>Regular price</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={isVariable ? "" : regular}
                onChange={(e) => setRegular(clampNonNeg(e.target.value))}
                className="h-8 text-sm"
                disabled={isVariable}
                placeholder={isVariable ? "Per variation" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Sale price</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={isVariable ? "" : sale}
                onChange={(e) => setSale(clampNonNeg(e.target.value))}
                className="h-8 text-sm"
                disabled={isVariable}
                placeholder={isVariable ? "Per variation" : ""}
              />
            </div>
          </div>
          {isVariable && (
            <p className="text-[10px] text-muted-foreground -mt-1.5">
              This is a variable product — set prices per variation in the full editor.
            </p>
          )}
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-2.5 mt-1 border-t-2 border-t-border/80">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">Manage stock</Label>
              <Switch checked={manageStock} onCheckedChange={setManageStock} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Stock status</Label>
                <Select value={stockStatus} onValueChange={setStockStatus}>
                  <SelectTrigger className="h-8 bg-card text-sm text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instock">In stock</SelectItem>
                    <SelectItem value="outofstock">Out of stock</SelectItem>
                    <SelectItem value="onbackorder">On backorder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {manageStock && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground" required>Qty</Label>
                  <Input type="number" min="0" value={stockQty} onChange={(e) => setQtyRaw(e.target.value)} className="h-8 text-sm" />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Last sync</span>
            <span>{product.synced_at ? formatDate(product.synced_at, i18n.language) : "—"}</span>
          </div>
        </div>
        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 border-t border-border pt-2 mt-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Link
              href={{ pathname: `/sites/${product.store_id}/products/edit/${product.id}`, query: { returnTo: router.asPath || `/sites/${product.store_id}/products` } }}
              onClick={() => onOpenChange(false)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit full product
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}