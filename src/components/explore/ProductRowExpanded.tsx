import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, ExternalLink, BarChart3, Loader2 } from "lucide-react";
import { updateProduct, type ProductRow } from "@/services/productService";
import { useToast } from "@/hooks/use-toast";

interface Props {
  product: ProductRow;
  storeUrl?: string | null;
  onSaved: (p: ProductRow) => void;
  onClose: () => void;
}

export function ProductRowExpanded({ product, storeUrl, onSaved, onClose }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [regularPrice, setRegularPrice] = useState<string>(product.regular_price?.toString() || "");
  const [salePrice, setSalePrice] = useState<string>(product.sale_price?.toString() || "");
  const [manageStock, setManageStock] = useState<boolean>(!!(product.raw_data as Record<string, unknown>)?.manage_stock);
  const [stockQuantity, setStockQuantity] = useState<string>(product.stock_quantity?.toString() || "");
  const [stockStatus, setStockStatus] = useState<string>(product.stock_status || "instock");
  const [saving, setSaving] = useState(false);

  const currency = "KWD";
  const permalink = (product.raw_data as Record<string, unknown>)?.permalink as string | undefined;
  const brandList = Array.isArray(product.brands) ? (product.brands as { name?: string }[]).map((b) => b.name).filter(Boolean) : [];
  const isVariable = ((product as ProductRow & { type?: string | null }).type) === "variable";
  const minP = (product as ProductRow & { min_price?: number | null }).min_price;
  const maxP = (product as ProductRow & { max_price?: number | null }).max_price;
  const showRange = isVariable && minP != null && maxP != null && minP !== maxP;

  const hasChanges =
    regularPrice !== (product.regular_price?.toString() || "") ||
    salePrice !== (product.sale_price?.toString() || "") ||
    manageStock !== !!(product.raw_data as Record<string, unknown>)?.manage_stock ||
    stockQuantity !== (product.stock_quantity?.toString() || "") ||
    stockStatus !== (product.stock_status || "instock");

  const handleSave = async () => {
    setSaving(true);
    const optimistic: ProductRow = {
      ...product,
      regular_price: regularPrice ? parseFloat(regularPrice) : null,
      sale_price: salePrice ? parseFloat(salePrice) : null,
      price: salePrice ? parseFloat(salePrice) : regularPrice ? parseFloat(regularPrice) : null,
      stock_status: stockStatus,
      stock_quantity: stockQuantity ? parseInt(stockQuantity, 10) : null,
    };
    onSaved(optimistic);

    try {
      const updates: Record<string, unknown> = {
        regular_price: regularPrice ? parseFloat(regularPrice) : null,
        sale_price: salePrice ? parseFloat(salePrice) : null,
        price: salePrice ? parseFloat(salePrice) : regularPrice ? parseFloat(regularPrice) : null,
        stock_status: stockStatus,
        stock_quantity: stockQuantity ? parseInt(stockQuantity, 10) : null,
      };
      const updated = await updateProduct(product.id, updates);
      onSaved(updated);
      toast({ title: "Product updated", description: product.name || "" });
    } catch (e) {
      onSaved(product);
      setRegularPrice(product.regular_price?.toString() || "");
      setSalePrice(product.sale_price?.toString() || "");
      setStockQuantity(product.stock_quantity?.toString() || "");
      setStockStatus(product.stock_status || "instock");
      toast({ title: "Update failed — reverted", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
      {brandList.length > 0 && (
        <div className="mb-4 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Brands</span>
          {brandList.map((b) => (
            <span key={b} className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{b}</span>
          ))}
        </div>
      )}
      {showRange && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1 text-xs">
          <span className="text-muted-foreground">Variation price range:</span>
          <span className="font-mono font-medium">{currency} {Number(minP).toFixed(2)} – {Number(maxP).toFixed(2)}</span>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input type="number" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} className="h-9 font-mono" placeholder="Regular" />
              <span className="text-xs text-muted-foreground font-medium w-10">{currency}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="h-9 font-mono" placeholder="Sale" />
              <span className="text-xs text-muted-foreground font-medium w-10">{currency}</span>
            </div>
          </div>
        </div>

        {/* Stock */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stock</div>
          {manageStock && (
            <Input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="Quantity" className="h-9 font-mono" />
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={manageStock} onCheckedChange={(v) => setManageStock(!!v)} />
            <span>Manage stock</span>
          </label>
          <div className="space-y-1.5">
            {[
              { v: "instock", l: "instock", color: "text-success" },
              { v: "outofstock", l: "outofstock", color: "text-destructive" },
              { v: "onbackorder", l: "onbackorder", color: "text-warning" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={stockStatus === o.v} onChange={() => setStockStatus(o.v)} className="h-4 w-4 accent-primary" />
                <span className={stockStatus === o.v ? `font-medium ${o.color}` : ""}>{o.l}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Actions</div>
          <Link
            href={{ pathname: `/sites/${product.store_id}/products/edit/${product.id}`, query: { returnTo: router.asPath || `/sites/${product.store_id}/products` } }}
            className="flex items-center gap-2 px-3 h-10 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="font-medium">Edit product</span>
            <span className="ml-auto">→</span>
          </Link>
          {permalink && (
            <a
              href={permalink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 h-10 rounded-md text-sm border border-border bg-background hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open on Store</span>
              <span className="ml-auto text-muted-foreground">↗</span>
            </a>
          )}
          <button
            disabled
            className="w-full flex items-center gap-2 px-3 h-10 rounded-md text-sm border border-border bg-background text-muted-foreground opacity-60 cursor-not-allowed"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Statistics</span>
            <span className="ml-auto">→</span>
          </button>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-center mt-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-9">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm" className="h-9 gap-2 min-w-[140px]">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}