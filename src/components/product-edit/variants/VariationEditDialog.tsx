import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, Plus, X } from "lucide-react";
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

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle>Edit {label}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Regular Price</Label>
                <Input type="number" step="0.01" value={variation.regular_price} onChange={(e) => onUpdate({ regular_price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Offer Price</Label>
                <Input type="number" step="0.01" value={variation.sale_price} onChange={(e) => onUpdate({ sale_price: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-5 items-start">
              <div className="space-y-1.5">
                <Label className="text-xs">Variation Image</Label>
                <button type="button" onClick={() => setImageOpen(true)} className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                  {variation.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={variation.image.src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Variation Gallery</Label>
                <div className="flex flex-wrap gap-2">
                  {gallery.map((g, gi) => (
                    <div key={gi} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.src} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => onUpdate({ gallery: gallery.filter((_, i) => i !== gi) })} className="absolute top-0.5 right-0.5 h-5 w-5 rounded bg-background/90 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setGalleryOpen(true)} className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 text-muted-foreground">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Inventory</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">SKU</span>
                  <Input value={variation.sku} onChange={(e) => onUpdate({ sku: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Quantity</span>
                  <Input type="number" value={variation.stock_quantity ?? ""} onChange={(e) => onUpdate({ stock_quantity: e.target.value ? Number(e.target.value) : null, manage_stock: true })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Stock Status</span>
                  <select className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm" value={variation.stock_status} onChange={(e) => onUpdate({ stock_status: e.target.value as Variation["stock_status"] })}>
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out Of Stock</option>
                    <option value="onbackorder">On Backorder</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Shipping</Label>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Weight (kg)</span>
                  <Input value={variation.weight} onChange={(e) => onUpdate({ weight: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Length</span>
                  <Input value={variation.dimensions.length} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, length: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Width</span>
                  <Input value={variation.dimensions.width} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, width: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Height</span>
                  <Input value={variation.dimensions.height} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, height: e.target.value } })} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={variation.enabled !== false} onCheckedChange={(v) => onUpdate({ enabled: !!v })} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!variation.virtual} onCheckedChange={(v) => onUpdate({ virtual: !!v })} />
                Virtual
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!variation.downloadable} onCheckedChange={(v) => onUpdate({ downloadable: !!v })} />
                Downloadable
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!variation.manage_stock} onCheckedChange={(v) => onUpdate({ manage_stock: !!v })} />
                Manage Stock
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea rows={3} value={variation.description} onChange={(e) => onUpdate({ description: e.target.value })} />
            </div>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between gap-2 p-4 border-t bg-muted/30">
          <Button variant="ghost" className="text-destructive" onClick={onRemove}>Remove</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {index < total - 1 && <Button variant="outline" onClick={onSaveNext}>Save & Edit Next</Button>}
            <Button className="bg-foreground text-background hover:bg-foreground/90" onClick={onClose}>Save Changes</Button>
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