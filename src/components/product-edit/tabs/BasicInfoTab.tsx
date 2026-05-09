import { LockedSlugField } from "@/components/ui/locked-slug-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X, ImageIcon, GripVertical, SquarePen, Images } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "next-i18next";
import { ProductFormState } from "@/services/productEditService";
import { slugify } from "@/lib/slugify";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";
import { RichTextEditor } from "@/components/product-edit/RichTextEditor";
import { TagPicker } from "@/components/product-edit/TagPicker";
import { ProductTaxonomyFields } from "@/components/product-edit/ProductTaxonomyFields";
const ProductImageEditorDialog = dynamic(
  () =>
    import("@/components/product-edit/image-editor/ProductImageEditorDialog").then((m) => ({
      default: m.ProductImageEditorDialog,
    })),
  { ssr: false },
);
type Props = {
  storeId: string;
  productId?: string | null;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
  /** Server / baseline slug for dirty re-lock (product edit). */
  committedSlug?: string;
};

export function BasicInfoTab({ storeId, productId: _productId, form, setForm, committedSlug = "" }: Props) {
  const { t } = useTranslation("site");
  const [imageOpen, setImageOpen] = useState<"main" | "gallery" | null>(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorIdx, setImageEditorIdx] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

  return (
    <>
    <div className="space-y-2">
      <section className="rounded-xl border border-border/70 bg-card p-2.5 shadow-sm sm:p-3" aria-labelledby="adv-basic-info-title">
        <h2 id="adv-basic-info-title" className="sr-only">
          Basic info
        </h2>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label required>Product Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Minimal Ceramic Mug" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adv-product-slug">{t("products.edit.slug")}</Label>
            <LockedSlugField
              id="adv-product-slug"
              value={form.slug ?? ""}
              committedValue={committedSlug}
              onChange={(v) => setForm((p) => ({ ...p, slug: slugify(v) }))}
              placeholder={t("products.edit.slugPlaceholder")}
            />
            <p className="text-[11px] text-muted-foreground">{t("products.edit.slugHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichTextEditor value={form.description} onChange={(html) => setForm((p) => ({ ...p, description: html }))} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Short Description</Label>
            <RichTextEditor value={form.short_description || ""} onChange={(html) => setForm((p) => ({ ...p, short_description: html }))} rows={2} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-2.5 shadow-sm sm:p-3" aria-labelledby="adv-product-media-title">
        <h2 id="adv-product-media-title" className="sr-only">
          Product media
        </h2>
        {/* Same row layout as Basic mode: primary image left, gallery as horizontal strip */}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
          <div className="space-y-1.5 shrink-0">
            <Label className="text-xs inline-flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Product image
            </Label>
            <div className="relative group h-[140px] w-[140px]">
              <button
                type="button"
                onClick={() => setImageOpen("main")}
                className="h-[140px] w-[140px] rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center bg-muted/30 overflow-hidden relative"
              >
                {mainImage?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mainImage.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-[10px]">Add image</span>
                  </div>
                )}
              </button>
              {mainImage?.src ? (
                <>
                  <button
                    type="button"
                    title={t("products.edit.removeMainImage")}
                    aria-label={t("products.edit.removeMainImage")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setForm((p) => ({
                        ...p,
                        images: [{ src: "", alt: "" }, ...p.images.slice(1)],
                      }));
                    }}
                    className="absolute top-1 right-1 z-[2] h-5 w-5 rounded-full bg-destructive/90 text-white opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center hover:bg-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-1 right-1 z-[2] h-7 w-7 shadow-sm"
                    title={t("products.edit.imageEditor.title")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setImageEditorIdx(0);
                      setImageEditorOpen(true);
                    }}
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <Label className="text-xs inline-flex items-center gap-1.5">
              <Images className="h-3.5 w-3.5 text-muted-foreground" />
              Gallery
            </Label>
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
                  className={`h-[104px] w-[104px] shrink-0 rounded-md border overflow-hidden relative group cursor-move transition-all ${dragOverIdx === i ? "border-primary ring-2 ring-primary/30" : "border-border"} ${dragIdx === i ? "opacity-40" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" className="h-full w-full object-cover pointer-events-none" />
                  <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-background/90 opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-sm">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                  </div>
                  {img.src ? (
                    <button
                      type="button"
                      title={t("products.edit.imageEditor.title")}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImageEditorIdx(i + 1);
                        setImageEditorOpen(true);
                      }}
                      className="absolute bottom-1 left-1 h-5 w-5 rounded-full bg-background/95 border border-border shadow-sm opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-muted z-[1]"
                    >
                      <SquarePen className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, images: p.images.filter((_, idx) => idx !== i + 1) }))}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setImageOpen("gallery")}
                className="h-[104px] w-[104px] shrink-0 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-2.5 shadow-sm sm:p-3" aria-labelledby="adv-taxonomy-title">
        <h2 id="adv-taxonomy-title" className="sr-only">
          Categories, brands & tags
        </h2>
        <div className="space-y-3">
          <ProductTaxonomyFields storeId={storeId} form={form} setForm={setForm} />

          <div className="space-y-1.5">
            <Label>Product Tags</Label>
            <TagPicker
              storeId={storeId}
              selected={form.tags}
              onChange={(tags) => setForm((p) => ({ ...p, tags }))}
            />
          </div>
        </div>
      </section>
    </div>

    <ProductImageEditorDialog
        open={imageEditorOpen}
        onOpenChange={setImageEditorOpen}
        storeId={storeId}
        src={form.images[imageEditorIdx]?.src ?? ""}
        alt={form.images[imageEditorIdx]?.alt ?? ""}
        onApply={(next) => {
          setForm((p) => {
            const images = [...p.images];
            if (!images[imageEditorIdx]) return p;
            images[imageEditorIdx] = { id: next.id, src: next.src, alt: next.alt };
            return { ...p, images };
          });
        }}
      />

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
    </>
  );
}