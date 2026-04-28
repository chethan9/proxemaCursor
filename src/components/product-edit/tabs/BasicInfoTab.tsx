import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ImageIcon, Loader2, GripVertical } from "lucide-react";
import { useState } from "react";
import { ProductFormState } from "@/services/productEditService";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";
import { RichTextEditor } from "@/components/product-edit/RichTextEditor";
import { TagPicker } from "@/components/product-edit/TagPicker";
import { useWooTaxonomy, useCreateWooTaxonomy } from "@/hooks/queries/useWooTaxonomy";

type Props = {
  storeId: string;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

export function BasicInfoTab({ storeId, form, setForm }: Props) {
  const [imageOpen, setImageOpen] = useState<"main" | "gallery" | null>(null);
  const [catInput, setCatInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const { data: categories = [] } = useWooTaxonomy(storeId, "categories");
  const { data: brands = [] } = useWooTaxonomy(storeId, "brands");
  const createCategory = useCreateWooTaxonomy(storeId, "categories");
  const createBrand = useCreateWooTaxonomy(storeId, "brands");

  const mainImage = form.images[0];
  const galleryImages = form.images.slice(1);

  const reorderGallery = (from: number, to: number) => {
    if (from === to) return;
    setForm((p) => {
      const gallery = p.images.slice(1);
      const [moved] = gallery.splice(from, 1);
      gallery.splice(to, 0, moved);
      return { ...p, images: [p.images[0], ...gallery] };
    });
  };

  const addCategory = async (name: string) => {
    const t = name.trim();
    if (!t) return;
    const existing = categories.find((c) => c.name.toLowerCase() === t.toLowerCase());
    if (existing) {
      if (!form.categories.find((c) => c.id === existing.id))
        setForm((p) => ({ ...p, categories: [...p.categories, { id: existing.id, name: existing.name }] }));
    } else {
      const created = await createCategory.mutateAsync({ name: t });
      setForm((p) => ({ ...p, categories: [...p.categories, { id: created.id, name: created.name }] }));
    }
    setCatInput("");
  };

  const addBrand = async (name: string) => {
    const t = name.trim();
    if (!t) return;
    const existing = brands.find((b) => b.name.toLowerCase() === t.toLowerCase());
    if (existing) {
      if (!form.brands.find((b) => b.id === existing.id))
        setForm((p) => ({ ...p, brands: [...p.brands, { id: existing.id, name: existing.name }] }));
    } else {
      const created = await createBrand.mutateAsync({ name: t });
      setForm((p) => ({ ...p, brands: [...p.brands, { id: created.id, name: created.name }] }));
    }
    setBrandInput("");
  };

  const addTag = (name: string) => {
    const t = name.trim();
    if (!t) return;
    if (form.tags.find((x) => x.name.toLowerCase() === t.toLowerCase())) return;
    setForm((p) => ({ ...p, tags: [...p.tags, { name: t }] }));
    setTagInput("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label required>Product Name</Label>
        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Minimal Ceramic Mug" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <RichTextEditor value={form.description} onChange={(html) => setForm((p) => ({ ...p, description: html }))} rows={4} />
      </div>
      <div className="space-y-1.5">
        <Label>Short Description</Label>
        <RichTextEditor value={form.short_description || ""} onChange={(html) => setForm((p) => ({ ...p, short_description: html }))} rows={2} />
      </div>

      <div className="flex items-start gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Product Image</Label>
          <button type="button" onClick={() => setImageOpen("main")} className="h-28 w-28 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center bg-muted/30 overflow-hidden">
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
              <div
                key={img.id ?? i}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={() => setDragOverIdx((v) => (v === i ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) reorderGallery(dragIdx, i);
                  setDragIdx(null);
                  setDragOverIdx(null);
                }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                className={`h-20 rounded-md border overflow-hidden relative group cursor-move transition-all ${dragOverIdx === i ? "border-primary ring-2 ring-primary/30" : "border-border"} ${dragIdx === i ? "opacity-40" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt="" className="h-full w-full object-cover pointer-events-none" />
                <div className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background/90 opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-sm">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                </div>
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

      <div className="space-y-1.5">
        <Label>Product Category</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.categories.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1.5">
              {c.name || `#${c.id}`}
              <button onClick={() => setForm((p) => ({ ...p, categories: p.categories.filter((x) => x.id !== c.id) }))}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input list="adv-cat-options" value={catInput} onChange={(e) => setCatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(catInput); } }} placeholder="Type and press Enter" />
          <datalist id="adv-cat-options">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          <Button type="button" variant="outline" onClick={() => addCategory(catInput)} disabled={!catInput.trim() || createCategory.isPending}>
            {createCategory.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Brands</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.brands.map((b) => (
            <Badge key={b.id} variant="secondary" className="gap-1.5">
              {b.name || `#${b.id}`}
              <button onClick={() => setForm((p) => ({ ...p, brands: p.brands.filter((x) => x.id !== b.id) }))}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input list="adv-brand-options" value={brandInput} onChange={(e) => setBrandInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBrand(brandInput); } }} placeholder="Type brand name" />
          <datalist id="adv-brand-options">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist>
          <Button type="button" variant="outline" onClick={() => addBrand(brandInput)} disabled={!brandInput.trim() || createBrand.isPending}>
            {createBrand.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Product Tags</Label>
        <TagPicker
          storeId={storeId}
          selected={form.tags}
          onChange={(tags) => setForm((p) => ({ ...p, tags }))}
        />
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