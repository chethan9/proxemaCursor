import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "next-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  ImageIcon,
  GripVertical,
  AlertCircle,
  Sparkles,
  SquarePen,
  PackageCheck,
  PackageX,
  Hourglass,
  Tag,
  CircleDollarSign,
  Boxes,
  Truck,
  Images,
  Eye,
  PanelRightOpen,
} from "lucide-react";
import { ProductFormState } from "@/services/productEditService";
import { validateProductForm } from "@/services/productValidation";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";
import { RichTextEditor } from "@/components/product-edit/RichTextEditor";
import { TagPicker } from "@/components/product-edit/TagPicker";
import { ProductTaxonomyFields } from "@/components/product-edit/ProductTaxonomyFields";
import { cn } from "@/lib/utils";
import { LivePreviewCard } from "@/components/product-edit/LivePreviewCard";

const ProductImageEditorDialog = dynamic(
  () =>
    import("@/components/product-edit/image-editor/ProductImageEditorDialog").then((m) => ({
      default: m.ProductImageEditorDialog,
    })),
  { ssr: false },
);

interface Props {
  storeId: string;
  /** Product UUID when editing; omit on create flow */
  productId?: string | null;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
}

const PREVIEW_OPEN_KEY = "product-edit-live-preview-open";

export function BasicEditor({ storeId, productId, form, setForm }: Props) {
  const { t } = useTranslation("site");
  const [imageOpen, setImageOpen] = useState<"main" | "gallery" | null>(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorIdx, setImageEditorIdx] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  useEffect(() => {
    try {
      if (localStorage.getItem(PREVIEW_OPEN_KEY) === "0") setPreviewOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  const persistPreviewOpen = (open: boolean) => {
    setPreviewOpen(open);
    try {
      localStorage.setItem(PREVIEW_OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
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
  const saleVersusRegularInvalid = regularNum > 0 && saleNum > 0 && saleNum >= regularNum;
  const discountPct = regularNum > 0 && saleNum > 0 && saleNum < regularNum ? Math.round(((regularNum - saleNum) / regularNum) * 100) : 0;
  const publishing = form.status === "publish";
  const validation = useMemo(() => validateProductForm(form), [form]);
  const saveBlocked = !validation.ok;
  /** Highlight simple product price field when publish requires a positive regular price */
  const priceInvalid = publishing && form.type === "simple" && regularNum <= 0;
  /** Parent SKU is optional for variable products (SKUs live on variations). */
  const parentSkuRequired = publishing && form.type !== "variable";

  // Clamp negative numeric string to 0 (defensive: spinner arrows can bypass min="0" in some browsers)
  const clampNonNegative = (v: string): string => {
    if (v === "" || v === "-") return "";
    const n = parseFloat(v);
    if (Number.isNaN(n)) return v;
    return n < 0 ? "0" : v;
  };

  const setStockQty = (raw: string) => {
    setForm((p) => {
      if (raw === "") return { ...p, stock_quantity: null };
      const n = Number(raw);
      if (Number.isNaN(n)) return p;
      const qty = Math.max(0, n);
      const nextStatus: typeof p.stock_status = qty === 0 ? "outofstock" : (p.stock_status === "onbackorder" ? "onbackorder" : "instock");
      return { ...p, stock_quantity: qty, manage_stock: true, stock_status: nextStatus };
    });
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

  const stockPills: {
    value: ProductFormState["stock_status"];
    label: string;
    Icon: typeof PackageCheck;
    activeClass: string;
    iconClass: string;
  }[] = [
    {
      value: "instock",
      label: "In Stock",
      Icon: PackageCheck,
      activeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 font-medium",
      iconClass: "text-emerald-600",
    },
    {
      value: "outofstock",
      label: "Out of Stock",
      Icon: PackageX,
      activeClass: "border-rose-500/40 bg-rose-500/10 text-rose-700 font-medium",
      iconClass: "text-rose-600",
    },
    {
      value: "onbackorder",
      label: "On Backorder",
      Icon: Hourglass,
      activeClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 font-medium",
      iconClass: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-4 pb-6">
      <div
        className={cn(
          "relative grid w-full grid-cols-1 gap-5 lg:items-start",
          previewOpen && "lg:grid-cols-[1fr_minmax(260px,360px)]",
        )}
      >
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label required>Product name</Label>
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
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <div className="space-y-1.5 shrink-0">
                  <Label className="text-xs inline-flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />Product image</Label>
                  <div className="relative group h-[140px] w-[140px]">
                    <button type="button" onClick={() => setImageOpen("main")} className="h-[140px] w-[140px] rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center bg-muted/30 overflow-hidden relative">
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
                  <Label className="text-xs inline-flex items-center gap-1.5"><Images className="h-3.5 w-3.5 text-muted-foreground" />Gallery</Label>
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
              <ProductTaxonomyFields storeId={storeId} form={form} setForm={setForm} />
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-muted-foreground" />Tags</Label>
                <TagPicker
                  storeId={storeId}
                  selected={form.tags}
                  onChange={(tags) => setForm((p) => ({ ...p, tags }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-medium">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                    <CircleDollarSign className="h-3.5 w-3.5" />
                  </span>
                  Pricing
                </div>
                {discountPct > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">-{discountPct}%</Badge>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground" required={publishing}>Regular price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.regular_price || ""}
                  onChange={(e) => setForm((p) => ({ ...p, regular_price: clampNonNegative(e.target.value) }))}
                  placeholder="0.00"
                  className={priceInvalid ? "border-destructive" : ""}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Sale price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sale_price || ""}
                  onChange={(e) => setForm((p) => ({ ...p, sale_price: clampNonNegative(e.target.value) }))}
                  placeholder="Optional"
                  aria-invalid={saleVersusRegularInvalid}
                  title={saleVersusRegularInvalid ? "Sale price must be lower than regular price." : undefined}
                  className={saleVersusRegularInvalid ? "border-destructive ring-1 ring-destructive/30" : ""}
                />
                {saleVersusRegularInvalid && (
                  <p className="text-[10px] text-destructive">Sale price must be lower than regular price.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-medium">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Boxes className="h-3.5 w-3.5" />
                </span>
                Inventory
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={form.manage_stock} onCheckedChange={(v) => setForm((p) => ({ ...p, manage_stock: !!v }))} />
                Track stock
              </label>
              {form.manage_stock && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground" required>Stock quantity</Label>
                  <Input type="number" min="0" value={form.stock_quantity ?? ""} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Stock status</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {stockPills.map((s) => {
                    const SIcon = s.Icon;
                    const active = form.stock_status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, stock_status: s.value }))}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] rounded-md border transition-colors",
                          active ? s.activeClass : "border-border bg-background hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <SIcon className={cn("h-3.5 w-3.5 shrink-0", active ? s.iconClass : "")} />
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground" required={parentSkuRequired}>SKU</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Input
                    value={form.sku || ""}
                    onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                    placeholder={parentSkuRequired ? "Required" : "Optional"}
                    className={`min-w-[220px] flex-1 ${parentSkuRequired && !form.sku.trim() ? "border-destructive" : ""}`}
                  />
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
              <div className="inline-flex items-center gap-2 text-sm font-medium">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                  <Truck className="h-3.5 w-3.5" />
                </span>
                Shipping
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Weight (kg)</Label>
                <Input type="number" min="0" step="0.01" value={form.weight || ""} onChange={(e) => setForm((p) => ({ ...p, weight: clampNonNegative(e.target.value) }))} placeholder="0.00" />
              </div>
            </CardContent>
          </Card>
        </div>

        {previewOpen && (
          <div className="min-w-0 space-y-2 lg:sticky lg:top-4 h-fit lg:self-start lg:pb-24">
            <LivePreviewCard
              storeId={storeId}
              productId={productId}
              form={form}
              setForm={setForm}
              onHidePreview={() => persistPreviewOpen(false)}
            />

            {saveBlocked && validation.errors.length > 0 && (
              <div className="hidden lg:flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs">
                <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                <ul className="text-foreground/80 space-y-1 list-disc pl-4">
                  {validation.errors.slice(0, 8).map((err, i) => (
                    <li key={`${err.field}-${i}`}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!previewOpen && (
          <Button
            type="button"
            variant="outline"
            className="fixed right-3 top-1/2 z-[85] h-14 w-14 -translate-y-1/2 overflow-hidden rounded-full border-border/70 bg-background/95 p-0 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90 hover:scale-[1.02] hover:bg-accent"
            onClick={() => persistPreviewOpen(true)}
            title="Show live preview"
            aria-label="Show live preview"
          >
            {form.images[0]?.src ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.images[0].src} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 bg-black/35" aria-hidden />
                <span className="absolute bottom-0.5 right-0.5 rounded-full bg-background/95 p-1 shadow-sm">
                  <PanelRightOpen className="h-3 w-3 text-foreground" />
                </span>
              </>
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-muted/40">
                <Eye className="h-5 w-5 text-muted-foreground" />
              </span>
            )}
          </Button>
        )}
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
    </div>
  );
}