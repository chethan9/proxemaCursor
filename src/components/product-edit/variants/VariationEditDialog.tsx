import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, Plus, X, Check } from "lucide-react";
import { Variation } from "@/services/productEditService";
import { variationLabel } from "./utils";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";

type Props = {
  storeId: string;
  variation: Variation;
  index: number;
  total: number;
  onClose: () => void;
  onSaveNext: () => void;
  onUpdate: (patch: Partial<Variation>) => void;
  onRemove: () => void;
};

export function VariationEditDialog({ storeId, variation, index, total, onClose, onSaveNext, onUpdate, onRemove }: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const label = variationLabel(variation);
  const gallery = variation.gallery || [];

  const priceInput = (value: string, onChange: (v: string) => void) => (
    <div className="relative">
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 pr-16 text-sm" />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">KWD</span>
    </div>
  );

  const RadioFlag = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (v: boolean) => void }) => (
    <button type="button" onClick={() => onToggle(!checked)} className="flex items-center gap-2 text-sm cursor-pointer">
      <span className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${checked ? "bg-foreground border-foreground" : "border-muted-foreground/40"}`}>
        {checked && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0 rounded-xl overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b">
          <DialogTitle className="text-lg font-semibold">Edit {label}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 py-5 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Regular Price</Label>
                {priceInput(variation.regular_price, (v) => onUpdate({ regular_price: v }))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sale Price</Label>
                {priceInput(variation.sale_price, (v) => onUpdate({ sale_price: v }))}
              </div>
            </div>

            <div className="border-t pt-5">
              <div className="flex gap-8 items-start">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Variation Image</Label>
                  <button type="button" onClick={() => setImageOpen(true)} className="relative h-24 w-24 rounded-xl border border-border flex items-center justify-center bg-muted/30 overflow-hidden hover:border-foreground/30 transition-colors">
                    {variation.image ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={variation.image.src} alt="" className="h-full w-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-muted/90 text-[10px] py-0.5 text-center font-medium">Default</span>
                      </>
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <Label className="text-xs font-medium">Variation Gallery</Label>
                  <div className="flex flex-wrap gap-2">
                    {gallery.map((g, gi) => (
                      <div key={gi} className="relative h-24 w-24 rounded-xl overflow-hidden border border-border group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.src} alt="" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => onUpdate({ gallery: gallery.filter((_, i) => i !== gi) })} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setGalleryOpen(true)} className="h-24 w-24 rounded-xl border border-dashed border-border flex items-center justify-center bg-muted/10 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-5 space-y-3">
              <h3 className="text-sm font-semibold">Inventory</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-normal">SKU</Label>
                  <Input className="h-11" value={variation.sku} onChange={(e) => onUpdate({ sku: e.target.value })} placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-normal">Quantity</Label>
                  <Input className="h-11" type="number" value={variation.stock_quantity ?? ""} onChange={(e) => onUpdate({ stock_quantity: e.target.value ? Number(e.target.value) : null, manage_stock: true })} placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-normal">Stock Status</Label>
                  <select className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm" value={variation.stock_status} onChange={(e) => onUpdate({ stock_status: e.target.value as Variation["stock_status"] })}>
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out of Stock</option>
                    <option value="onbackorder">On Backorder</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t pt-5 space-y-3">
              <h3 className="text-sm font-semibold">Shipping</h3>
              <div className="grid grid-cols-[1fr_2fr] gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-normal">Weight <span className="text-[10px]">(kg)</span></Label>
                  <Input className="h-11" value={variation.weight} onChange={(e) => onUpdate({ weight: e.target.value })} placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-normal">Dimensions <span className="text-[10px]">(cm)</span></Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input className="h-11" value={variation.dimensions.length} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, length: e.target.value } })} placeholder="Length" />
                    <Input className="h-11" value={variation.dimensions.width} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, width: e.target.value } })} placeholder="Width" />
                    <Input className="h-11" value={variation.dimensions.height} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, height: e.target.value } })} placeholder="Height" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-5 flex flex-wrap gap-6">
              <RadioFlag label="Enabled" checked={variation.enabled !== false} onToggle={(v) => onUpdate({ enabled: v })} />
              <RadioFlag label="Virtual" checked={!!variation.virtual} onToggle={(v) => onUpdate({ virtual: v })} />
              <RadioFlag label="Downloadable" checked={!!variation.downloadable} onToggle={(v) => onUpdate({ downloadable: v })} />
              <RadioFlag label="Manage Stock" checked={!!variation.manage_stock} onToggle={(v) => onUpdate({ manage_stock: v })} />
            </div>

            <div className="border-t pt-5 space-y-2">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea rows={3} value={variation.description} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="Optional variation-specific description" />
            </div>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t bg-background">
          <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onRemove}>Remove</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
            {index < total - 1 && <Button variant="outline" className="rounded-full" onClick={onSaveNext}>Save & Edit Next</Button>}
            <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full" onClick={onClose}>Save Changes</Button>
          </div>
        </div>
        {imageOpen && (
          <ImagePickerDialog
            storeId={storeId}
            open={imageOpen}
            onOpenChange={setImageOpen}
            mode="single"
            onConfirm={(items) => {
              const [first] = items;
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