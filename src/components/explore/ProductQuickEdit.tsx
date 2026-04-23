import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";

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
  sku: string | null;
  regular_price: string | number | null;
  sale_price: string | number | null;
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
      setManageStock(product.stock_quantity != null);
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
              if (!Array.isArray(old)) return old;
              return (old as Product[]).map((p) =>
                p.id === product.id ? { ...p, ...(patch as Partial<Product>) } : p
              );
            },
          },
        ]
      : [],
    siteName,
    successToast: "Synced to WooCommerce",
    onSuccessExtra: () => onOpenChange(false),
  });

  if (!product) return null;

  function handleSave() {
    const patch: Record<string, unknown> = {
      name,
      sku,
      regular_price: regular,
      sale_price: sale,
      status,
      stock_status: stockStatus,
      manage_stock: manageStock,
    };
    if (manageStock) patch.stock_quantity = stockQty === "" ? null : Number(stockQty);
    mutation.mutate(patch);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick edit</DialogTitle>
          <DialogDescription>Changes sync to WooCommerce immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Regular price</Label>
              <Input type="number" value={regular} onChange={(e) => setRegular(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sale price</Label>
              <Input type="number" value={sale} onChange={(e) => setSale(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Manage stock</Label>
              <Switch checked={manageStock} onCheckedChange={setManageStock} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Stock status</Label>
                <Select value={stockStatus} onValueChange={setStockStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instock">In stock</SelectItem>
                    <SelectItem value="outofstock">Out of stock</SelectItem>
                    <SelectItem value="onbackorder">On backorder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {manageStock && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>last sync</span>
            <span>{product.synced_at ? new Date(product.synced_at).toLocaleDateString() : "—"}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
