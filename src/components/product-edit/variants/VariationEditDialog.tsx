import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, X, ImageIcon, ArrowRight, Image as ImageIco } from "lucide-react";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";
import { Variation, variationLabel } from "./utils";
import { cn } from "@/lib/utils";
import { NumberInput } from "@/components/ui/number-input";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  variation: Variation | null;
  onUpdate: (patch: Partial<Variation>) => void;
  onRemove: () => void;
  onSaveAndNext?: () => void;
  hasNext?: boolean;
  storeId: string;
  currency?: string;
}

export function VariationEditDialog({ open, onOpenChange, variation, onUpdate, onRemove, onSaveAndNext, hasNext, storeId, currency = "" }: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  if (!variation) return null;

  const label = variationLabel(variation);
  const gallery = variation.gallery || [];

  const priceOk = (s: string) => {
    const t = (s || "").trim();
    if (!t) return false;
    const n = parseFloat(t);
    return !Number.isNaN(n) && n > 0;
  };

  const setQty = (raw: string) => {
    if (raw === "") { onUpdate({ stock_quantity: null, manage_stock: true }); return; }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    const qty = Math.max(0, n);
    const nextStatus = qty === 0 ? "outofstock" : (variation.stock_status === "onbackorder" ? "onbackorder" : "instock");
    onUpdate({ stock_quantity: qty, manage_stock: true, stock_status: nextStatus as Variation["stock_status"] });
  };

  const priceField = (value: string, onChange: (v: string) => void, invalid?: boolean) => (
    <div className="relative">
      <NumberInput
        className={cn("h-9 pr-12", invalid && "border-destructive")}
        value={value}
        onValueChange={onChange}
        placeholder="0.00"
      />
      {currency && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">{currency}</span>}
    </div>
  );

  const regularMissing = variation.enabled !== false && !priceOk(variation.regular_price);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">Edit {label}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 grid grid-cols-[220px_1fr] gap-6 max-h-[75vh] overflow-y-auto">
          {/* Left: images */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Variation Image</Label>
              <button
                type="button"
                onClick={() => setImageOpen(true)}
                className="relative h-[180px] w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 overflow-hidden bg-muted/30 flex items-center justify-center"
              >
                {variation.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={variation.image.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-[10px]">Add image</span>
                  </div>
                )}
                {!variation.image && <span className="absolute bottom-1.5 left-1.5 text-[9px] uppercase bg-background/90 px-1.5 py-0.5 rounded text-muted-foreground">Uses product default</span>}
                {variation.image && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpdate({ image: null }); }}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-destructive/90 text-white flex items-center justify-center shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground">Gallery</Label>
                <span className="text-[10px] text-muted-foreground">{gallery.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {gallery.map((img, i) => (
                  <div key={img.id ?? i} className="relative aspect-square rounded-md border border-border overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => onUpdate({ gallery: gallery.filter((_, idx) => idx !== i) })}
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className="aspect-square rounded-md border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: dense field grid */}
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground" required>Regular Price</Label>
                {priceField(variation.regular_price, (v) => onUpdate({ regular_price: v }), regularMissing)}
                {regularMissing && <div className="text-[10px] text-destructive">Required &gt; 0</div>}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Sale Price</Label>
                {priceField(variation.sale_price, (v) => onUpdate({ sale_price: v }))}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">SKU</Label>
                <Input className="h-9" value={variation.sku} onChange={(e) => onUpdate({ sku: e.target.value })} placeholder="—" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Quantity</Label>
                <NumberInput
                  className={`h-9 ${!variation.manage_stock ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}`}
                  integer
                  value={variation.manage_stock ? (variation.stock_quantity ?? "") : ""}
                  onValueChange={(v) => setQty(v)}
                  placeholder={variation.manage_stock ? "—" : "Enable Manage Stock"}
                  disabled={!variation.manage_stock}
                  title={!variation.manage_stock ? "Tick Manage Stock to track quantity" : undefined}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Stock</Label>
                <Select value={variation.stock_status} onValueChange={(v) => onUpdate({ stock_status: v as Variation["stock_status"] })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instock">In Stock</SelectItem>
                    <SelectItem value="outofstock">Out of Stock</SelectItem>
                    <SelectItem value="onbackorder">On Backorder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Weight (kg)</Label>
                <Input className="h-9" value={variation.weight} onChange={(e) => onUpdate({ weight: e.target.value })} placeholder="—" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Dimensions (cm)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input className="h-9" value={variation.dimensions.length} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, length: e.target.value } })} placeholder="L" />
                <Input className="h-9" value={variation.dimensions.width} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, width: e.target.value } })} placeholder="W" />
                <Input className="h-9" value={variation.dimensions.height} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, height: e.target.value } })} placeholder="H" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Description</Label>
              <Textarea
                value={variation.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Optional variation-specific description"
                className="min-h-[90px] resize-none text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 border-t border-border">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={variation.enabled !== false} onCheckedChange={(v) => onUpdate({ enabled: !!v })} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={variation.virtual} onCheckedChange={(v) => onUpdate({ virtual: !!v })} />
                Virtual
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={variation.downloadable} onCheckedChange={(v) => onUpdate({ downloadable: !!v })} />
                Downloadable
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={variation.manage_stock} onCheckedChange={(v) => onUpdate({ manage_stock: !!v })} />
                Manage Stock
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/20 flex-row items-center justify-between sm:justify-between">
          <Button type="button" variant="ghost" onClick={onRemove} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {hasNext && onSaveAndNext && (
              <Button type="button" variant="outline" onClick={onSaveAndNext} className="gap-1.5">
                Save &amp; Edit Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button type="button" onClick={() => onOpenChange(false)}>Save Changes</Button>
          </div>
        </DialogFooter>

        {imageOpen && (
          <ImagePickerDialog
            storeId={storeId}
            open={imageOpen}
            onOpenChange={setImageOpen}
            mode="single"
            onConfirm={(items) => {
              const first = items[0];
              if (first) onUpdate({ image: { id: first.id, src: first.src, alt: first.alt } });
              setImageOpen(false);
            }}
          />
        )}
        {galleryOpen && (
          <ImagePickerDialog
            storeId={storeId}
            open={galleryOpen}
            onOpenChange={setGalleryOpen}
            mode="multi"
            onConfirm={(items) => {
              const mapped = items.map((it) => ({ id: it.id, src: it.src, alt: it.alt }));
              onUpdate({ gallery: [...gallery, ...mapped] });
              setGalleryOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}