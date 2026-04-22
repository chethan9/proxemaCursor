import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, ImageIcon, Loader2, Info, Search, GripVertical, AlertCircle, Sparkles } from "lucide-react";
import { ProductFormState } from "@/services/productEditService";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";
import { RichTextEditor } from "@/components/product-edit/RichTextEditor";
import { useWooTaxonomy, useCreateWooTaxonomy } from "@/hooks/queries/useWooTaxonomy";
import { cn } from "@/lib/utils";

interface Props {
  storeId: string;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
  saving: boolean;
  onCancel: () => void;
  onPublish: () => void;
  isEdit: boolean;
}

const BANNER_KEY = "product-basic-banner-dismissed";

export function BasicEditor({ storeId, form, setForm, saving, onCancel, onPublish, isEdit }: Props) {
  const [imageOpen, setImageOpen] = useState<"main" | "gallery" | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const { data: categories = [] } = useWooTaxonomy(storeId, "categories");
  const createCategory = useCreateWooTaxonomy(storeId, "categories");

  useEffect(() => {
    setBannerDismissed(typeof window !== "undefined" && localStorage.getItem(BANNER_KEY) === "1");
  }, []);

  const dismissBanner = () => {
    localStorage.setItem(BANNER_KEY, "1");
    setBannerDismissed(true);
  };

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

  const regularNum = parseFloat(form.regular_price) || 0;
  const saleNum = parseFloat(form.sale_price) || 0;
  const isFree = regularNum === 0 && form.regular_price === "0";
  const discountPct = regularNum > 0 && saleNum > 0 && saleNum < regularNum ? Math.round(((regularNum - saleNum) / regularNum) * 100) : 0;
  const publishBlocked = form.status === "publish" && !isFree && regularNum <= 0;

  // Clamp negative numeric string to 0 (defensive: spinner arrows can bypass min="0" in some browsers)
  const clampNonNegative = (v: string): string => {
    if (v === "" || v === "-") return "";
    const n = parseFloat(v);
    if (Number.isNaN(n)) return v;
    return n < 0 ? "0" : v;
  };

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    const selected = new Set(form.categories.map((c) => c.id));
    return categories.filter((c) => !selected.has(c.id) && (!q || c.name.toLowerCase().includes(q)));
  }, [catSearch, categories, form.categories]);

  const canCreateCat = catSearch.trim().length > 0 && !categories.find((c) => c.name.toLowerCase() === catSearch.trim().toLowerCase());

  const addCategoryById = (id: number, name: string) => {
    if (!form.categories.find((c) => c.id === id)) {
      setForm((p) => ({ ...p, categories: [...p.categories, { id, name }] }));
    }
    setCatSearch("");
    setCatOpen(false);
  };

  const createAndAddCategory = async () => {
    const name = catSearch.trim();
    if (!name) return;
    const created = await createCategory.mutateAsync({ name });
    setForm((p) => ({ ...p, categories: [...p.categories, { id: created.id, name: created.name }] }));
    setCatSearch("");
    setCatOpen(false);
  };

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (form.tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())) return;
    setForm((p) => ({ ...p, tags: [...p.tags, { name: trimmed }] }));
    setTagInput("");
  };

  const toggleFree = (v: boolean) => {
    if (v) {
      setForm((p) => ({ ...p, regular_price: "0", sale_price: "" }));
    } else {
      setForm((p) => ({ ...p, regular_price: "" }));
    }
  };

  const generateSku = () => {
    const base = (form.name || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]+/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join("-");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const sku = base ? `${base}-${suffix}` : `SKU-${Date.now().toString(36).toUpperCase()}`;
    setForm((p) => ({ ...p, sku }));
  };

  const statusOptions: { value: ProductFormState["status"]; label: string }[] = [
    { value: "publish", label: "Active" },
    { value: "draft", label: "Draft" },
    { value: "pending", label: "Pending" },
    { value: "private", label: "Private" },
  ];

  const stockPills: { value: ProductFormState["stock_status"]; label: string }[] = [
    { value: "instock", label: "In Stock" },
    { value: "outofstock", label: "Out of Stock" },
    { value: "onbackorder", label: "On Backorder" },
  ];

  return (
    <div className="space-y-4">
      {!bannerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Basic Mode</div>
            <div className="text-xs text-muted-foreground">Essential product details only. Switch to Advanced for taxes, variants, shipping rules & more.</div>
          </div>
          <button onClick={dismissBanner} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Product name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Minimal Ceramic Mug" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <RichTextEditor value={form.description} onChange={(html) => setForm((p) => ({ ...p, description: html }))} rows={6} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Product image</Label>
                  <button type="button" onClick={() => setImageOpen("main")} className="h-[140px] w-[140px] rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center bg-muted/30 overflow-hidden relative">
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
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Label className="text-xs">Gallery</Label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
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
                        className={cn(
                          "h-[104px] w-[104px] shrink-0 rounded-md border overflow-hidden relative group cursor-move transition-all",
                          dragOverIdx === i ? "border-primary ring-2 ring-primary/30" : "border-border",
                          dragIdx === i && "opacity-40"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.src} alt="" className="h-full w-full object-cover pointer-events-none" />
                        <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-background/90 opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-sm">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <button type="button" onClick={() => setForm((p) => ({ ...p, images: p.images.filter((_, idx) => idx !== i + 1) }))} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setImageOpen("gallery")} className="h-[104px] w-[104px] shrink-0 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Categories</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {form.categories.map((c) => (
                    <Badge key={c.id} variant="secondary" className="gap-1.5 py-1">
                      {c.name || `#${c.id}`}
                      <button onClick={() => setForm((p) => ({ ...p, categories: p.categories.filter((x) => x.id !== c.id) }))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                  <Popover open={catOpen} onOpenChange={setCatOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-7 gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Add category
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder="Search or create…" className="h-8 pl-7 text-sm" autoFocus />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {filteredCats.slice(0, 50).map((c) => (
                          <button key={c.id} type="button" onClick={() => addCategoryById(c.id, c.name)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left">
                            <span className="truncate">{c.name}</span>
                          </button>
                        ))}
                        {filteredCats.length === 0 && !canCreateCat && (
                          <div className="px-3 py-4 text-xs text-muted-foreground text-center">No categories</div>
                        )}
                      </div>
                      {canCreateCat && (
                        <button type="button" onClick={createAndAddCategory} disabled={createCategory.isPending} className="w-full flex items-center gap-2 px-3 py-2 text-sm border-t border-border hover:bg-muted disabled:opacity-60">
                          {createCategory.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          <span>Create "<span className="font-medium">{catSearch.trim()}</span>"</span>
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {form.tags.map((t, i) => (
                    <Badge key={i} variant="secondary" className="gap-1.5 py-1">
                      {t.name}
                      <button onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((_, idx) => idx !== i) }))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }} onBlur={() => addTag(tagInput)} placeholder="Type and press Enter" className="h-7 w-40 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="grid grid-cols-4 gap-1">
                {statusOptions.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, status: s.value }))}
                    className={cn(
                      "px-2 py-1.5 text-xs rounded-md border transition-colors",
                      form.status === s.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Price</div>
                {discountPct > 0 && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0 text-[10px]">
                    {discountPct}% off
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Regular</Label>
                  <Input type="number" min="0" step="0.01" disabled={isFree} value={form.regular_price} onChange={(e) => setForm((p) => ({ ...p, regular_price: clampNonNegative(e.target.value) }))} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Sale</Label>
                  <Input type="number" min="0" step="0.01" disabled={isFree} value={form.sale_price} onChange={(e) => setForm((p) => ({ ...p, sale_price: clampNonNegative(e.target.value) }))} placeholder="0.00" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                <Checkbox checked={isFree} onCheckedChange={(v) => toggleFree(!!v)} />
                Free product
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-medium">Inventory</div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={form.manage_stock} onCheckedChange={(v) => setForm((p) => ({ ...p, manage_stock: !!v }))} />
                Track stock
              </label>
              {form.manage_stock && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Stock quantity</Label>
                  <Input type="number" min="0" value={form.stock_quantity ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { setForm((p) => ({ ...p, stock_quantity: null })); return; }
                    const n = Number(v);
                    setForm((p) => ({ ...p, stock_quantity: Number.isNaN(n) ? null : Math.max(0, n) }));
                  }} placeholder="0" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Stock status</Label>
                <div className="grid grid-cols-3 gap-1">
                  {stockPills.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, stock_status: s.value }))}
                      className={cn(
                        "px-2 py-1.5 text-[11px] rounded-md border transition-colors",
                        form.stock_status === s.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">SKU</Label>
                <div className="flex gap-1.5">
                  <Input value={form.sku || ""} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} placeholder="Optional" className="flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={generateSku}
                    title={form.name.trim() ? "Auto-generate from product name" : "Enter product name first for name-based SKU"}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-sm font-medium">Shipping</div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Weight (kg)</Label>
                <Input type="number" min="0" step="0.01" value={form.weight || ""} onChange={(e) => setForm((p) => ({ ...p, weight: clampNonNegative(e.target.value) }))} placeholder="0.00" />
              </div>
            </CardContent>
          </Card>

          {publishBlocked && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <span className="text-foreground/80">Add a price or mark as <span className="font-medium">Free product</span> to publish. Save as Draft to skip pricing for now.</span>
            </div>
          )}

          <div className="flex gap-2 sticky bottom-4">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={onPublish} disabled={saving || !form.name.trim() || publishBlocked}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving…" : "Publishing…"}</> : (isEdit ? "Save changes" : (form.status === "publish" ? "Publish" : "Save"))}
            </Button>
          </div>
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