import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, ExternalLink, BarChart3, Trash2, Loader2 } from "lucide-react";
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
  const [regularPrice, setRegularPrice] = useState<string>(product.regular_price?.toString() || "");
  const [salePrice, setSalePrice] = useState<string>(product.sale_price?.toString() || "");
  const [manageStock, setManageStock] = useState<boolean>(!!(product.raw_data as Record<string, unknown>)?.manage_stock);
  const [stockQuantity, setStockQuantity] = useState<string>(product.stock_quantity?.toString() || "");
  const [stockStatus, setStockStatus] = useState<string>(product.stock_status || "instock");
  const [saving, setSaving] = useState(false);

  const currency = "KWD";
  const permalink = (product.raw_data as Record<string, unknown>)?.permalink as string | undefined;

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
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</div>
          {storeUrl && (
            <a href={`${storeUrl.replace(/\/$/, "")}/wp-admin/post.php?post=${product.woo_id}&action=edit`} target="_blank" rel="noreferrer" className="block">
              <Button variant="outline" size="sm" className="w-full justify-between h-9">
                <span className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5" />Edit Product</span>
                <span className="text-muted-foreground">→</span>
              </Button>
            </a>
          )}
          {permalink && (
            <a href={permalink} target="_blank" rel="noreferrer" className="block">
              <Button variant="outline" size="sm" className="w-full justify-between h-9">
                <span className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" />View Product</span>
                <span className="text-muted-foreground">→</span>
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" className="w-full justify-between h-9" disabled>
            <span className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" />Statistics</span>
            <span className="text-muted-foreground">→</span>
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start h-9 text-destructive hover:text-destructive hover:bg-destructive/10" disabled>
            <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
          </Button>
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