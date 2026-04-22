import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <Input type="number" min="0" step="0.01" value={value} onChange={(e) => {
        const v = e.target.value;
        if (v === "" || v === "-") { onChange(""); return; }
        const n = parseFloat(v);
        onChange(Number.isNaN(n) ? v : (n < 0 ? "0" : v));
      }} className="h-9 pr-12 text-sm" />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">KWD</span>
    </div>
  );

  const Flag = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (v: boolean) => void }) => (
    <button type="button" onClick={() => onToggle(!checked)} className="flex items-center gap-1.5 text-xs cursor-pointer">
      <span className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-colors ${checked ? "bg-foreground border-foreground" : "border-muted-foreground/40"}`}>
        {checked && <Check className="h-2 w-2 text-background" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl p-0 gap-0 rounded-xl overflow-hidden bg-background">
        <DialogHeader className="px-5 py-3 border-b bg-background">
          <DialogTitle className="text-base font-semibold">Edit {label}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4 bg-background">
          <div className="grid grid-cols-3 gap-4">
            {/* Column 1: Media */}
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Variation Image</Label>
                <button type="button" onClick={() => setImageOpen(true)} className="mt-1.5 relative h-20 w-20 rounded-lg border border-border flex items-center justify-center bg-muted/30 overflow-hidden hover:border-foreground/30 transition-colors">
                  {variation.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={variation.image.src} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-foreground/80 text-background text-[9px] py-0.5 text-center font-medium">Default</span>
                    </>
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Gallery</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {gallery.map((g, gi) => (
                    <div key={gi} className="relative h-14 w-14 rounded-md overflow-hidden border border-border group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.src} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => onUpdate({ gallery: gallery.filter((_, i) => i !== gi) })} className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-background/90 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setGalleryOpen(true)} className="h-14 w-14 rounded-md border border-dashed border-border flex items-center justify-center bg-muted/10 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2: Pricing + Inventory */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">Regular Price</Label>
                  {priceInput(variation.regular_price, (v) => onUpdate({ regular_price: v }))}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">Sale Price</Label>
                  {priceInput(variation.sale_price, (v) => onUpdate({ sale_price: v }))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">SKU</Label>
                <Input className="h-9" value={variation.sku} onChange={(e) => onUpdate({ sku: e.target.value })} placeholder="—" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">Quantity</Label>
                  <Input className="h-9" type="number" min="0" value={variation.stock_quantity ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { onUpdate({ stock_quantity: null, manage_stock: true }); return; }
                    const n = Number(v);
                    onUpdate({ stock_quantity: Number.isNaN(n) ? null : Math.max(0, n), manage_stock: true });
                  }} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">Stock</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs" value={variation.stock_status} onChange={(e) => onUpdate({ stock_status: e.target.value as Variation["stock_status"] })}>
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out of Stock</option>
                    <option value="onbackorder">Backorder</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                <Flag label="Enabled" checked={variation.enabled !== false} onToggle={(v) => onUpdate({ enabled: v })} />
                <Flag label="Virtual" checked={!!variation.virtual} onToggle={(v) => onUpdate({ virtual: v })} />
                <Flag label="Downloadable" checked={!!variation.downloadable} onToggle={(v) => onUpdate({ downloadable: v })} />
                <Flag label="Manage Stock" checked={!!variation.manage_stock} onToggle={(v) => onUpdate({ manage_stock: v })} />
              </div>
            </div>

            {/* Column 3: Shipping + Description */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Weight (kg)</Label>
                <Input className="h-9" type="number" min="0" step="0.01" value={variation.weight} onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || v === "-") { onUpdate({ weight: "" }); return; }
                  const n = parseFloat(v);
                  onUpdate({ weight: Number.isNaN(n) ? v : (n < 0 ? "0" : v) });
                }} placeholder="—" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Dimensions (cm)</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Input className="h-9" type="number" min="0" step="0.01" value={variation.dimensions.length} onChange={(e) => {
                    const v = e.target.value;
                    const n = parseFloat(v);
                    const next = v === "" || v === "-" ? "" : (Number.isNaN(n) ? v : (n < 0 ? "0" : v));
                    onUpdate({ dimensions: { ...variation.dimensions, length: next } });
                  }} placeholder="L" />
                  <Input className="h-9" type="number" min="0" step="0.01" value={variation.dimensions.width} onChange={(e) => {
                    const v = e.target.value;
                    const n = parseFloat(v);
                    const next = v === "" || v === "-" ? "" : (Number.isNaN(n) ? v : (n < 0 ? "0" : v));
                    onUpdate({ dimensions: { ...variation.dimensions, width: next } });
                  }} placeholder="W" />
                  <Input className="h-9" type="number" min="0" step="0.01" value={variation.dimensions.height} onChange={(e) => {
                    const v = e.target.value;
                    const n = parseFloat(v);
                    const next = v === "" || v === "-" ? "" : (Number.isNaN(n) ? v : (n < 0 ? "0" : v));
                    onUpdate({ dimensions: { ...variation.dimensions, height: next } });
                  }} placeholder="H" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Description</Label>
                <Textarea rows={3} className="text-xs resize-none" value={variation.description} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="Optional variation-specific description" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t bg-background">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onRemove}>Remove</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={onClose}>Cancel</Button>
            {index < total - 1 && <Button variant="outline" size="sm" className="rounded-full" onClick={onSaveNext}>Save & Edit Next</Button>}
            <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 rounded-full" onClick={onClose}>Save Changes</Button>
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