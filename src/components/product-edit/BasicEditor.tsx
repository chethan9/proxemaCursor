import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ImageIcon, Loader2 } from "lucide-react";
import { ProductFormState } from "@/services/productEditService";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";
import { useWooTaxonomy, useCreateWooTaxonomy } from "@/hooks/queries/useWooTaxonomy";

interface Props {
  storeId: string;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
  saving: boolean;
  onCancel: () => void;
  onPublish: () => void;
  isEdit: boolean;
}

export function BasicEditor({ storeId, form, setForm, saving, onCancel, onPublish, isEdit }: Props) {
  const [imageOpen, setImageOpen] = useState<"main" | "gallery" | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [catInput, setCatInput] = useState("");
  const { data: categories = [] } = useWooTaxonomy(storeId, "categories");
  const createCategory = useCreateWooTaxonomy(storeId, "categories");

  const mainImage = form.images[0];
  const galleryImages = form.images.slice(1);

  const addCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!form.categories.find((c) => c.id === existing.id)) {
        setForm((p) => ({ ...p, categories: [...p.categories, { id: existing.id, name: existing.name }] }));
      }
    } else {
      const created = await createCategory.mutateAsync({ name: trimmed });
      setForm((p) => ({ ...p, categories: [...p.categories, { id: created.id, name: created.name }] }));
    }
    setCatInput("");
  };

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (form.tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())) return;
    setForm((p) => ({ ...p, tags: [...p.tags, { name: trimmed }] }));
    setTagInput("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Product name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Minimal Ceramic Mug" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Short description</Label>
              <Textarea rows={2} value={form.short_description || ""} onChange={(e) => setForm((p) => ({ ...p, short_description: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Product image</Label>
                <button type="button" onClick={() => setImageOpen("main")} className="h-28 w-28 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center bg-muted/30 overflow-hidden relative">
                  {mainImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mainImage.src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-[10px]">Add image</span>
                    </div>
                  )}
                </button>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Gallery</Label>
                <div className="grid grid-cols-5 gap-2">
                  {galleryImages.map((img, i) => (
                    <div key={i} className="h-20 rounded-md border border-border overflow-hidden relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setForm((p) => ({ ...p, images: p.images.filter((_, idx) => idx !== i + 1) }))} className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setImageOpen("gallery")} className="h-20 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.categories.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1.5">
                    {c.name || `#${c.id}`}
                    <button onClick={() => setForm((p) => ({ ...p, categories: p.categories.filter((x) => x.id !== c.id) }))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input list="cat-options" value={catInput} onChange={(e) => setCatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(catInput); } }} placeholder="Type category name and press Enter" />
                <datalist id="cat-options">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                <Button type="button" variant="outline" onClick={() => addCategory(catInput)} disabled={!catInput.trim() || createCategory.isPending}>
                  {createCategory.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map((t, i) => (
                  <Badge key={i} variant="secondary" className="gap-1.5">
                    {t.name}
                    <button onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((_, idx) => idx !== i) }))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }} placeholder="Type tag and press Enter" />
                <Button type="button" variant="outline" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>Add</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ProductFormState["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-medium">Price</div>
            <div className="space-y-1.5">
              <Label className="text-xs">Regular price</Label>
              <Input type="number" step="0.01" value={form.regular_price} onChange={(e) => setForm((p) => ({ ...p, regular_price: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sale price</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm((p) => ({ ...p, sale_price: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-medium">Inventory</div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={form.manage_stock} onCheckedChange={(v) => setForm((p) => ({ ...p, manage_stock: !!v }))} />
              Track stock
            </label>
            {form.manage_stock && (
              <div className="space-y-1.5">
                <Label className="text-xs">Stock quantity</Label>
                <Input type="number" value={form.stock_quantity ?? ""} onChange={(e) => setForm((p) => ({ ...p, stock_quantity: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Stock status</Label>
              <Select value={form.stock_status} onValueChange={(v) => setForm((p) => ({ ...p, stock_status: v as ProductFormState["stock_status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instock">In stock</SelectItem>
                  <SelectItem value="outofstock">Out of stock</SelectItem>
                  <SelectItem value="onbackorder">On backorder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input value={form.sku || ""} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={onPublish} disabled={saving || !form.name.trim()}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving…" : "Publishing…"}</> : (isEdit ? "Save changes" : "Publish")}
          </Button>
        </div>
      </div>

      {imageOpen && (
        <ImagePickerDialog
          storeId={storeId}
          open={!!imageOpen}
          onOpenChange={(o) => { if (!o) setImageOpen(null); }}
          mode={imageOpen === "gallery" ? "multi" : "single"}
          onConfirm={(items) => {
            setForm((p) => {
              if (imageOpen === "main") {
                const [first] = items;
                if (!first) return p;
                const rest = p.images.slice(1);
                return { ...p, images: [{ id: first.id, src: first.src, alt: first.alt }, ...rest] };
              }
              const existing = new Set(p.images.map((i) => i.id).filter(Boolean));
              const newOnes = items.filter((i) => !existing.has(i.id)).map((i) => ({ id: i.id, src: i.src, alt: i.alt }));
              return { ...p, images: [...p.images, ...newOnes] };
            });
            setImageOpen(null);
          }}
        />
      )}
    </div>
  );
}