import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { ProductFormState } from "@/services/productEditService";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";
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

  const { data: categories = [] } = useWooTaxonomy(storeId, "categories");
  const { data: brands = [] } = useWooTaxonomy(storeId, "brands");
  const createCategory = useCreateWooTaxonomy(storeId, "categories");
  const createBrand = useCreateWooTaxonomy(storeId, "brands");

  const mainImage = form.images[0];
  const galleryImages = form.images.slice(1);

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
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Product Name</Label>
        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Minimal Ceramic Mug" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={6} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>Short Description</Label>
        <Textarea rows={2} value={form.short_description || ""} onChange={(e) => setForm((p) => ({ ...p, short_description: e.target.value }))} />
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
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.tags.map((t, i) => (
            <Badge key={i} variant="secondary" className="gap-1.5">
              {t.name}
              <button onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((_, idx) => idx !== i) }))}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }} placeholder="Type and press Enter" />
          <Button type="button" variant="outline" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>Add</Button>
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