import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Pencil, ExternalLink, TrendingUp, Trash2, Loader2, Save, RefreshCw, CheckCircle2, XCircle, Clock, Package } from "lucide-react";
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

  const stockOptions: { value: "instock" | "outofstock" | "onbackorder"; label: string; icon: typeof CheckCircle2; activeCls: string }[] = [
    { value: "instock", label: "In stock", icon: CheckCircle2, activeCls: "border-success bg-success/10 text-success" },
    { value: "outofstock", label: "Out of stock", icon: XCircle, activeCls: "border-destructive bg-destructive/10 text-destructive" },
    { value: "onbackorder", label: "Backorder", icon: Clock, activeCls: "border-warning bg-warning/10 text-warning" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base">Quick edit</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate leading-tight">{product.name || "—"}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                {product.type && <Badge variant="outline" className="text-[9px] uppercase tracking-wide h-4 px-1.5">{product.type}</Badge>}
                <span className="font-mono truncate">SKU: {product.sku || "—"}</span>
                <span className="font-mono">#{product.woo_id}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                <Switch checked={available} onCheckedChange={setAvailable} />
                <span className="text-[11px] font-medium">{available ? "Published" : "Draft"}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-5">
            <div className="space-y-5">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <Label className="text-xs font-semibold">Pricing</Label>
                  </div>
                  {onSalePrice && (
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">On sale</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Regular price</Label>
                    <div className="relative">
                      {currency && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">{currency}</span>
                      )}
                      <Input
                        type="number"
                        step="0.01"
                        value={regularPrice}
                        onChange={(e) => setRegularPrice(e.target.value)}
                        placeholder="0.00"
                        className={`h-9 font-mono text-sm ${currency ? "pl-10" : ""}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Sale price</Label>
                    <div className="relative">
                      {currency && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">{currency}</span>
                      )}
                      <Input
                        type="number"
                        step="0.01"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                        placeholder="—"
                        className={`h-9 font-mono text-sm ${currency ? "pl-10" : ""}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <Package className="h-3.5 w-3.5" />
                    </div>
                    <Label className="text-xs font-semibold">Stock</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Manage</span>
                    <Switch checked={manageStock} onCheckedChange={(v) => setManageStock(!!v)} />
                  </div>
                </div>

                {manageStock && (
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Quantity</Label>
                    <Input
                      type="number"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      placeholder="0"
                      className="h-9 font-mono text-sm"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 block">Status</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {stockOptions.map((opt) => {
                      const Icon = opt.icon;
                      const active = stockStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStockStatus(opt.value)}
                          className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2.5 text-[11px] font-medium transition-colors ${active ? opt.activeCls : "border-border text-muted-foreground hover:bg-muted/50"}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Button className="w-full h-10" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save changes
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 block">Actions</Label>
                <div className="flex flex-col gap-1.5">
                  {permalink && (
                    <>
                      <Button variant="outline" size="sm" className="justify-between h-8 text-xs" asChild>
                        <a href={permalink.replace(/\/$/, "") + "/wp-admin/post.php?post=" + product.woo_id + "&action=edit"} target="_blank" rel="noreferrer">
                          <span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Edit in Woo</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="justify-between h-8 text-xs" asChild>
                        <a href={permalink} target="_blank" rel="noreferrer">
                          <span className="flex items-center gap-1.5"><ExternalLink className="h-3 w-3" /> View public</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" className="justify-start h-8 text-xs" disabled>
                    <RefreshCw className="h-3 w-3 mr-1.5" /> Re-sync
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start h-8 text-xs text-destructive hover:text-destructive" disabled>
                    <Trash2 className="h-3 w-3 mr-1.5" /> Delete
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t border-border space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slug</span>
                  <span className="font-mono truncate max-w-[120px]">{product.slug || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last sync</span>
                  <span>{product.synced_at ? new Date(product.synced_at).toLocaleDateString() : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{product.updated_at ? new Date(product.updated_at).toLocaleDateString() : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}