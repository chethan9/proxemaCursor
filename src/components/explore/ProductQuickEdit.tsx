import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Pencil, ExternalLink, TrendingUp, Trash2, Loader2, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateProduct, getProductThumbnail, type ProductRow } from "@/services/productService";

interface Props {
  product: ProductRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (p: ProductRow) => void;
}

export function ProductQuickEdit({ product, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stockStatus, setStockStatus] = useState<"instock" | "outofstock" | "onbackorder">("instock");
  const [manageStock, setManageStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("");
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setRegularPrice(String(product.regular_price ?? product.price ?? ""));
    setSalePrice(String(product.sale_price ?? ""));
    setStockStatus((product.stock_status as "instock" | "outofstock" | "onbackorder") || "instock");
    setManageStock(Boolean(product.raw_data?.manage_stock));
    setStockQuantity(product.stock_quantity != null ? String(product.stock_quantity) : "");
    setAvailable(product.status === "publish");
  }, [product]);

  if (!product) return null;

  const thumb = getProductThumbnail(product.images);
  const currency = (product.raw_data?.currency as string) || "";
  const onSalePrice = salePrice && salePrice !== regularPrice;

  const save = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        regular_price: regularPrice || null,
        sale_price: salePrice || null,
        price: salePrice || regularPrice || null,
        stock_status: stockStatus,
        status: available ? "publish" : "draft",
      };
      if (manageStock) {
        updates.stock_quantity = stockQuantity ? parseInt(stockQuantity, 10) : null;
      }
      const updated = await updateProduct(product.id, updates);
      toast({ title: "Product updated", description: product.name || "" });
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast({ title: "Failed to save", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const permalink = product.raw_data?.permalink as string | undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick edit</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {/* Header row */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <div className="h-16 w-16 rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{product.name || "—"}</div>
              <div className="mt-1 flex items-center gap-2">
                {product.type && <Badge variant="outline" className="text-[10px] uppercase">{product.type}</Badge>}
                <span className="text-xs text-muted-foreground font-mono truncate">{product.sku || "—"}</span>
              </div>
              <div className="mt-1 text-sm font-semibold font-mono">
                {onSalePrice ? (
                  <>
                    <span>{currency} {salePrice}</span>
                    <span className="ml-2 text-xs line-through text-muted-foreground">{currency} {regularPrice}</span>
                  </>
                ) : (
                  <span>{currency} {regularPrice || "—"}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Switch checked={available} onCheckedChange={setAvailable} />
              <span className="text-[10px] text-muted-foreground">{available ? "Active" : "Draft"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">
            {/* Left: form */}
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold">Price</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={regularPrice}
                      onChange={(e) => setRegularPrice(e.target.value)}
                      placeholder="Regular price"
                      className="h-9"
                    />
                    {currency && <Badge variant="secondary" className="h-9 px-2.5">{currency}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      placeholder="Sale price (optional)"
                      className="h-9"
                    />
                    {currency && <Badge variant="secondary" className="h-9 px-2.5">{currency}</Badge>}
                    {onSalePrice && (
                      <span className="text-xs text-muted-foreground line-through font-mono whitespace-nowrap">
                        {currency} {regularPrice}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Stock</Label>
                <div className="mt-2 space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={manageStock} onCheckedChange={(v) => setManageStock(!!v)} />
                    Manage stock?
                  </label>

                  {manageStock && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantity</Label>
                      <Input
                        type="number"
                        value={stockQuantity}
                        onChange={(e) => setStockQuantity(e.target.value)}
                        placeholder="0"
                        className="h-9 mt-1"
                      />
                    </div>
                  )}

                  <RadioGroup value={stockStatus} onValueChange={(v) => setStockStatus(v as "instock" | "outofstock" | "onbackorder")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="instock" id="rg-instock" />
                      <Label htmlFor="rg-instock" className="font-normal cursor-pointer text-success">In stock</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="outofstock" id="rg-outofstock" />
                      <Label htmlFor="rg-outofstock" className="font-normal cursor-pointer text-destructive">Out of stock</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="onbackorder" id="rg-backorder" />
                      <Label htmlFor="rg-backorder" className="font-normal cursor-pointer text-warning">On backorder</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <Button className="w-full h-10" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save changes
              </Button>
            </div>

            {/* Right: actions */}
            <div>
              <Label className="text-sm font-semibold">Actions</Label>
              <div className="mt-2 flex flex-col gap-2">
                {permalink && (
                  <>
                    <Button variant="outline" size="sm" className="justify-between h-9" asChild>
                      <a href={permalink.replace(/\/$/, "") + "/wp-admin/post.php?post=" + product.woo_id + "&action=edit"} target="_blank" rel="noreferrer">
                        <span className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Edit Product</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="justify-between h-9" asChild>
                      <a href={permalink} target="_blank" rel="noreferrer">
                        <span className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" /> View Product</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" className="justify-start h-9" disabled>
                  <TrendingUp className="h-3.5 w-3.5 mr-2" /> Statistics
                </Button>
                <Button variant="outline" size="sm" className="justify-start h-9" disabled>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Re-sync
                </Button>
                <Button variant="outline" size="sm" className="justify-start h-9 text-destructive hover:text-destructive" disabled>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </Button>
              </div>

              <div className="mt-5 pt-4 border-t border-border space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Woo ID</span><span className="font-mono">{product.woo_id}</span></div>
                <div className="flex justify-between"><span>Slug</span><span className="font-mono truncate max-w-[120px]">{product.slug || "—"}</span></div>
                <div className="flex justify-between"><span>Last sync</span><span>{product.synced_at ? new Date(product.synced_at).toLocaleDateString() : "—"}</span></div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}