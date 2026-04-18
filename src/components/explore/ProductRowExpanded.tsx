import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pencil, ExternalLink, BarChart3, Trash2, RefreshCw, Loader2, ImageIcon } from "lucide-react";
import { updateProduct, getProductThumbnail, type ProductRow } from "@/services/productService";
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
  const [isActive, setIsActive] = useState<boolean>(product.status === "publish");
  const [saving, setSaving] = useState(false);

  const thumb = getProductThumbnail(product.images);
  const currency = "KWD";
  const permalink = (product.raw_data as Record<string, unknown>)?.permalink as string | undefined;

  const hasChanges =
    regularPrice !== (product.regular_price?.toString() || "") ||
    salePrice !== (product.sale_price?.toString() || "") ||
    manageStock !== !!(product.raw_data as Record<string, unknown>)?.manage_stock ||
    stockQuantity !== (product.stock_quantity?.toString() || "") ||
    stockStatus !== (product.stock_status || "instock") ||
    isActive !== (product.status === "publish");

  const handleSave = async () => {
    setSaving(true);

    const optimistic: ProductRow = {
      ...product,
      regular_price: regularPrice ? parseFloat(regularPrice) : null,
      sale_price: salePrice ? parseFloat(salePrice) : null,
      price: salePrice ? parseFloat(salePrice) : regularPrice ? parseFloat(regularPrice) : null,
      stock_status: stockStatus,
      stock_quantity: stockQuantity ? parseInt(stockQuantity, 10) : null,
      status: isActive ? "publish" : "draft",
    };
    onSaved(optimistic);

    try {
      const updates: Record<string, unknown> = {
        regular_price: regularPrice ? parseFloat(regularPrice) : null,
        sale_price: salePrice ? parseFloat(salePrice) : null,
        price: salePrice ? parseFloat(salePrice) : regularPrice ? parseFloat(regularPrice) : null,
        stock_status: stockStatus,
        stock_quantity: stockQuantity ? parseInt(stockQuantity, 10) : null,
        status: isActive ? "publish" : "draft",
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
      setIsActive(product.status === "publish");
      toast({ title: "Update failed — reverted", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-muted/20 border-t border-border" onClick={(e) => e.stopPropagation()}>
      <div className="p-5 space-y-4">
        {/* Top row: product summary with availability toggle */}
        <div className="flex items-start gap-4 pb-4 border-b border-border">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-16 w-16 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{product.name || "—"}</div>
            <div className="flex items-center gap-2 mt-1">
              {product.type && (
                <Badge variant="outline" className="text-[10px] uppercase">{product.type}</Badge>
              )}
              {product.sku && <span className="text-xs text-muted-foreground font-mono">SKU: {product.sku}</span>}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="font-mono font-semibold text-base">
                {product.sale_price && product.sale_price !== product.regular_price ? product.sale_price : product.price || "—"} {currency}
              </div>
              {product.sale_price && product.sale_price !== product.regular_price && product.regular_price && (
                <div className="text-xs line-through text-muted-foreground font-mono">{product.regular_price} {currency}</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground w-20 text-center">
              {stockStatus}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-xs text-muted-foreground">{isActive ? "Live" : "Draft"}</span>
            </div>
          </div>
        </div>

        {/* Body: 3 columns - Price, Stock, Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Price */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  className="h-9 font-mono"
                  placeholder="Regular"
                />
                <Badge variant="secondary" className="shrink-0">{currency}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="h-9 font-mono"
                  placeholder="Sale"
                />
                <Badge variant="secondary" className="shrink-0">{currency}</Badge>
                {product.regular_price && salePrice && parseFloat(salePrice) < parseFloat(product.regular_price.toString()) && (
                  <span className="text-xs line-through text-muted-foreground font-mono">{product.regular_price} {currency}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stock */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stock</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={manageStock} onCheckedChange={(v) => setManageStock(!!v)} />
              <span>Manage stock?</span>
            </label>
            {manageStock && (
              <Input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="Quantity"
                className="h-9 font-mono"
              />
            )}
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-semibold text-muted-foreground">Status</div>
              {[
                { v: "instock", l: "instock", color: "text-success" },
                { v: "outofstock", l: "outofstock", color: "text-destructive" },
                { v: "onbackorder", l: "onbackorder", color: "text-warning" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    checked={stockStatus === o.v}
                    onChange={() => setStockStatus(o.v)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className={stockStatus === o.v ? `font-medium ${o.color}` : ""}>{o.l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</div>
            {permalink && (
              <a href={permalink} target="_blank" rel="noreferrer" className="block">
                <Button variant="outline" size="sm" className="w-full justify-between h-9">
                  <span className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" />View product</span>
                  <span className="text-muted-foreground">→</span>
                </Button>
              </a>
            )}
            {storeUrl && (
              <a href={`${storeUrl.replace(/\/$/, "")}/wp-admin/post.php?post=${product.woo_id}&action=edit`} target="_blank" rel="noreferrer" className="block">
                <Button variant="outline" size="sm" className="w-full justify-between h-9">
                  <span className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5" />Edit in WordPress</span>
                  <span className="text-muted-foreground">→</span>
                </Button>
              </a>
            )}
            <Button variant="outline" size="sm" className="w-full justify-between h-9" disabled>
              <span className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" />Statistics</span>
              <span className="text-muted-foreground">→</span>
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start h-9 text-destructive hover:text-destructive hover:bg-destructive/10 mt-3" disabled>
              <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
            </Button>
          </div>
        </div>

        {/* Footer: save + cancel */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {product.synced_at && <>Last synced {new Date(product.synced_at).toLocaleString()}</>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-9">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm" className="h-9 gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}