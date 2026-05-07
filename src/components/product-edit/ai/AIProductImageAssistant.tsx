"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { supabase } from "@/integrations/supabase/client";
import { ProductFormState } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  Sparkles,
  Wand2,
  Undo2,
  Upload,
  Images,
  Square,
  RectangleVertical,
  Monitor,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeProductImageSrc } from "@/lib/product-image-urls";
import { ImagePickerDialog, type SelectedImage } from "@/components/product-edit/ImagePickerDialog";
import { AIFeatureCompactGlyph } from "@/components/product-edit/ai/AIFeatureCompactGlyph";
import { cn } from "@/lib/utils";
import {
  ASPECT_RATIO_OPTIONS,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CUSTOM_HEIGHT,
  DEFAULT_CUSTOM_WIDTH,
  DEFAULT_SIZE_PRESET,
  MAX_AI_IMAGE_OUTPUT_COUNT,
  SIZE_PRESET_OPTIONS,
  type AspectRatioValue,
  type SizePresetValue,
} from "@/lib/ai/image-generation-controls";

type SwatchOption = { value: string; label?: string; hex?: string };
type FieldOption = string | SwatchOption;

type AIFeature = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provider: string;
  default_output_count: number;
  credit_cost_per_output: number;
  requires_source_image?: boolean;
  user_input_schema: {
    fields?: Array<{
      key: string;
      label: string;
      type: string;
      options?: FieldOption[];
      placeholder?: string;
      default?: string;
      presets?: Array<{ hex: string; label: string }>;
    }>;
  };
};

function optionValue(o: FieldOption): string {
  return typeof o === "string" ? o : o.value;
}
function optionLabel(o: FieldOption): string {
  if (typeof o === "string") return o;
  return o.label ?? o.value;
}

type GenOutput = { path: string; signedUrl: string; index: number };

type SourceTab = "product" | "upload" | "library";

/** Max outputs per generation in product UI (aligned with controls). */

/** Blend swatch colors toward neutral so presets feel flat / less saturated in the UI */
function flatSwatchHex(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const br = 232;
  const bg = 232;
  const bb = 236;
  const t = 0.68;
  const mix = (c: number, bc: number) => Math.round(c * t + bc * (1 - t));
  const rr = mix(r, br);
  const rg = mix(g, bg);
  const rb = mix(b, bb);
  return `#${rr.toString(16).padStart(2, "0")}${rg.toString(16).padStart(2, "0")}${rb.toString(16).padStart(2, "0")}`;
}

/** Normalize to #RRGGBB for prompts and Gemini */
function normalizeHex6(raw: string): string {
  const t = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return `#${t.slice(1).toUpperCase()}`;
  if (/^[0-9A-Fa-f]{6}$/i.test(t)) return `#${t.toUpperCase()}`;
  return "#FFFFFF";
}

function hexEquals(a: string, b: string): boolean {
  return normalizeHex6(a) === normalizeHex6(b);
}

const SIZE_PRESET_SHORT: Record<Exclude<SizePresetValue, "custom">, string> = {
  sm: "S",
  md: "M",
  lg: "L",
  xl: "XL",
  hero: "Wide",
};

/** Single entry point: AI-assisted images for main + gallery. */
export function AIProductImageAssistant({
  storeId,
  productId,
  form,
  setForm,
  compact = false,
  tone = "default",
  label,
  triggerIcon = "sparkles",
}: {
  storeId: string;
  productId?: string | null;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
  compact?: boolean;
  tone?: "default" | "orange" | "white" | "overlay";
  label?: string;
  /** Icon on the open trigger — wand reads as “generate”, sparkles as “AI”. */
  triggerIcon?: "wand" | "sparkles";
}) {
  const { t } = useTranslation("site");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [features, setFeatures] = useState<AIFeature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [featureSlug, setFeatureSlug] = useState<string>("");
  const [userValues, setUserValues] = useState<Record<string, string>>({});
  const [outCount, setOutCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<GenOutput[]>([]);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const snapshotRef = useRef(form.images);

  const [sourceTab, setSourceTab] = useState<SourceTab>("product");
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  /** Signed URL from staging upload or WP media — used when tab is upload/library */
  const [externalSourceUrl, setExternalSourceUrl] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  /** Which generated output is focused in the right-hand preview column */
  const [sidebarPreviewIdx, setSidebarPreviewIdx] = useState(0);

  const [sourceMode, setSourceMode] = useState<"main" | "gallery">("main");
  const [gallerySlot, setGallerySlot] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>(DEFAULT_ASPECT_RATIO);
  const [sizePreset, setSizePreset] = useState<SizePresetValue>(DEFAULT_SIZE_PRESET);
  const [customWidth, setCustomWidth] = useState(String(DEFAULT_CUSTOM_WIDTH));
  const [customHeight, setCustomHeight] = useState(String(DEFAULT_CUSTOM_HEIGHT));

  const selected = features.find((f) => f.slug === featureSlug);
  const estimatedGenerateCredits =
    selected && Number.isFinite(Number(selected.credit_cost_per_output))
      ? Math.max(0, Math.round(Number(selected.credit_cost_per_output))) * outCount
      : 0;

  const loadFeatures = useCallback(async () => {
    setLoadingFeatures(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const r = await fetch("/api/ai/features", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (r.ok && Array.isArray(j.features)) {
        setFeatures(j.features);
        if (j.features[0]) setFeatureSlug((s) => s || j.features[0].slug);
      }
    } finally {
      setLoadingFeatures(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    snapshotRef.current = form.images;
    void loadFeatures();
    setSourceTab("product");
    setSelectedImageIdx(0);
    setExternalSourceUrl(null);
    setUploadPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAspectRatio(DEFAULT_ASPECT_RATIO);
    setSizePreset(DEFAULT_SIZE_PRESET);
    setCustomWidth(String(DEFAULT_CUSTOM_WIDTH));
    setCustomHeight(String(DEFAULT_CUSTOM_HEIGHT));
    setAdditionalPrompt("");
    setLightboxIndex(null);
    setSidebarPreviewIdx(0);
    setOutCount((c) => Math.min(MAX_AI_IMAGE_OUTPUT_COUNT, Math.max(1, c)));
  }, [open, loadFeatures]);

  useEffect(() => {
    if (outputs.length === 0) return;
    setSidebarPreviewIdx((i) => Math.min(Math.max(0, i), outputs.length - 1));
  }, [outputs]);

  useEffect(() => {
    if (lightboxIndex == null) return;
    if (outputs.length === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex >= outputs.length) {
      setLightboxIndex(outputs.length - 1);
    }
  }, [outputs, lightboxIndex]);

  useEffect(() => {
    if (!selected || !open) return;
    const n = Number(selected.default_output_count);
    setOutCount(Number.isFinite(n) ? Math.min(MAX_AI_IMAGE_OUTPUT_COUNT, Math.max(1, Math.round(n))) : 1);
    const next: Record<string, string> = {};
    (selected.user_input_schema?.fields || []).forEach((f) => {
      if (f.type === "textarea") {
        next[f.key] = "";
        return;
      }
      if (f.type === "hex_color") {
        const defRaw = typeof f.default === "string" ? f.default : "";
        const fromDefault = /^#[0-9A-Fa-f]{6}$/i.test(defRaw.trim()) ? normalizeHex6(defRaw) : null;
        const fromPreset = f.presets?.[0]?.hex ? normalizeHex6(f.presets[0].hex) : null;
        next[f.key] = fromDefault ?? fromPreset ?? "#FFFFFF";
        return;
      }
      const first = f.options?.[0];
      next[f.key] = first === undefined ? "" : optionValue(first);
    });
    setUserValues(next);
  }, [selected?.slug, open]);

  useEffect(() => {
    const n = form.images.length;
    if (n === 0) return;
    if (selectedImageIdx >= n) setSelectedImageIdx(0);
  }, [form.images.length, selectedImageIdx]);

  const resolvedInputUrl = (): string | null => {
    if (sourceTab === "product") {
      const img = form.images[selectedImageIdx];
      return img?.src ? normalizeProductImageSrc(img.src) : null;
    }
    return externalSourceUrl;
  };

  const buildSources = (): Array<{ url: string; role: string }> => {
    const u = resolvedInputUrl();
    if (!u) return [];
    return [{ url: u, role: "source" }];
  };

  const runGenerate = async () => {
    const sources = buildSources();
    const reqSrc = selected?.requires_source_image !== false;
    if (reqSrc && sources.length === 0) {
      toast({ title: t("products.ai.noImage"), variant: "destructive" });
      return;
    }
    if (selected?.provider === "openai_image" && sources.length === 0) {
      toast({
        title: t("products.ai.openaiNeedsSource"),
        variant: "destructive",
      });
      return;
    }
    if (!featureSlug) return;
    if (featureSlug === "custom_prompt" && !userValues.prompt?.trim()) {
      toast({ title: t("products.ai.customPromptRequired"), variant: "destructive" });
      return;
    }
    const generationUserInput: Record<string, string> = {
      ...userValues,
      aspect_ratio: aspectRatio,
      output_size_preset: sizePreset,
    };
    for (const fld of selected?.user_input_schema?.fields ?? []) {
      if (fld.type === "hex_color" && typeof generationUserInput[fld.key] === "string") {
        generationUserInput[fld.key] = normalizeHex6(generationUserInput[fld.key]);
      }
    }
    if (sizePreset === "custom") {
      generationUserInput.custom_width = customWidth || String(DEFAULT_CUSTOM_WIDTH);
      generationUserInput.custom_height = customHeight || String(DEFAULT_CUSTOM_HEIGHT);
    }

    setGenerating(true);
    setOutputs([]);
    setGenerationId(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast({ title: t("products.export.signIn"), variant: "destructive" });
        return;
      }
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: productId ?? undefined,
          featureSlug,
          sources,
          userInput: generationUserInput,
          outputCount: Math.min(MAX_AI_IMAGE_OUTPUT_COUNT, Math.max(1, outCount)),
          additionalPrompt: additionalPrompt.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setGenerationId(j.generationId);
      setOutputs(j.outputs || []);
      setCreditsSpent(j.creditsSpent ?? 0);
    } catch (e) {
      toast({
        title: t("products.ai.failed"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const runRegenerate = async () => {
    if (!generationId || outputs.length === 0) return;
    setGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/ai/generate/${generationId}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          outputIndices: outputs.map((o) => o.index),
          additionalPrompt: additionalPrompt.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setOutputs(j.outputs || []);
      setCreditsSpent((c) => c + (Number(j.creditsSpent) || 0));
    } catch (e) {
      toast({
        title: t("products.ai.failed"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const onPickFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setSourceTab("upload");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("storeId", storeId);
      const r = await fetch("/api/ai/source-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed");
      setExternalSourceUrl(j.url as string);
    } catch (e) {
      toast({
        title: t("products.ai.uploadFailed"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setUploadPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  };

  const onLibraryConfirm = (imgs: SelectedImage[]) => {
    const first = imgs[0];
    if (!first?.src) return;
    setExternalSourceUrl(normalizeProductImageSrc(first.src));
    setSourceTab("library");
    setLibraryOpen(false);
  };

  const applyPlacements = async (
    placements: Array<{ outputIndex: number; applyAs: "main" | "gallery_append" | "gallery_replace"; galleryIndex?: number }>
  ) => {
    if (!generationId) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const r = await fetch(`/api/ai/generate/${generationId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, placements }),
    });
    const j = await r.json();
    if (!r.ok) {
      toast({ title: t("products.ai.failed"), description: j.error, variant: "destructive" });
      return;
    }
    const results = j.results as Array<{
      outputIndex: number;
      applyAs: string;
      galleryIndex?: number;
      media: { id: number; source_url: string; thumbnail_url: string; alt: string };
    }>;
    for (const res of results) {
      const img = { id: res.media.id, src: res.media.source_url, alt: res.media.alt || "" };
      if (res.applyAs === "main") {
        setForm((p) => ({ ...p, images: [img, ...p.images.slice(1)] }));
      } else if (res.applyAs === "gallery_append") {
        setForm((p) => ({ ...p, images: [...p.images, img] }));
      } else if (res.applyAs === "gallery_replace" && typeof res.galleryIndex === "number") {
        setForm((p) => {
          const next = [...p.images];
          const idx = res.galleryIndex! + 1;
          if (idx > 0 && idx < next.length) next[idx] = img;
          return { ...p, images: next };
        });
      }
    }
    toast({ title: t("products.ai.applied") });
    setOpen(false);
    setOutputs([]);
    setGenerationId(null);
  };

  const rejectStaging = async () => {
    if (generationId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch(`/api/ai/generate/${generationId}/reject`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
    setOutputs([]);
    setGenerationId(null);
    setOpen(false);
  };

  const revertLocal = () => {
    const snap = snapshotRef.current;
    setForm((p) => ({ ...p, images: snap }));
    toast({ title: t("products.ai.reverted") });
  };

  const galleryLen = Math.max(0, form.images.length - 1);
  const thumbCount = form.images.length;
  const aspectRatioIconMap: Record<AspectRatioValue, typeof Square> = {
    "1:1": Square,
    "4:5": RectangleVertical,
    "3:4": RectangleVertical,
    "16:9": Monitor,
    "9:16": Smartphone,
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "rounded-full text-xs font-medium shadow-sm",
          tone === "orange"
            ? "border-orange-300 bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
            : tone === "overlay"
              ? "border-white/25 bg-white/12 text-white shadow-none backdrop-blur-sm hover:bg-white/20 hover:text-white"
              : tone === "white"
                ? "border border-border/80 bg-white text-foreground shadow-md hover:bg-white hover:text-foreground"
                : "border-border/70 bg-background/80 hover:bg-accent",
          compact ? "h-8 w-8 p-0" : "h-8 gap-1.5 px-3"
        )}
        onClick={() => setOpen(true)}
        title={label || t("products.ai.open")}
        aria-label={label || t("products.ai.open")}
      >
        {loadingFeatures && open ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : triggerIcon === "wand" ? (
          <Wand2 className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {!compact && <span>{label || t("products.ai.open")}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "flex max-h-[min(92vh,780px)] flex-col gap-0 overflow-hidden bg-[#ffffff] p-0",
            outputs.length > 0
              ? "w-[calc(100vw-1rem)] max-w-[min(1240px,calc(100vw-1rem))]"
              : "w-[calc(100vw-1.5rem)] max-w-[min(100vw-1.5rem,920px)] sm:max-w-[920px]",
          )}
        >
          <DialogHeader className="relative shrink-0 space-y-0 border-b border-border bg-[#ffffff] px-4 py-2.5 pr-11">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute left-3 top-1/2 z-10 h-7 -translate-y-1/2 gap-1 px-2 text-[11px]"
              onClick={revertLocal}
            >
              <Undo2 className="h-3 w-3" />
              {t("products.ai.revert")}
            </Button>
            <div className="flex w-full items-center justify-center gap-2 px-10">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-[#ffffff] text-muted-foreground shadow-sm">
                <Wand2 className="h-4 w-4" aria-hidden />
              </span>
              <DialogTitle className="text-center text-base font-semibold leading-tight">{t("products.ai.title")}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#ffffff] lg:flex-row">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 sm:px-4 sm:py-3 lg:min-w-0">
            <div className="grid gap-3 md:grid-cols-2 md:gap-x-5 md:gap-y-3 md:items-start">
              {/* Source column */}
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground">{t("products.ai.referenceImage")}</Label>
                <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as SourceTab)}>
                  <TabsList className="grid h-8 w-full grid-cols-3 gap-0 p-0.5">
                    <TabsTrigger value="product" className="px-1.5 py-1 text-[11px]">
                      {t("products.ai.tabProduct")}
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="gap-0.5 px-1.5 py-1 text-[11px]">
                      <Upload className="h-3 w-3 shrink-0" />
                      {t("products.ai.tabUpload")}
                    </TabsTrigger>
                    <TabsTrigger value="library" className="gap-0.5 px-1.5 py-1 text-[11px]">
                      <Images className="h-3 w-3 shrink-0" />
                      {t("products.ai.tabLibrary")}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="product" className="mt-2 space-y-1.5">
                    {thumbCount === 0 ? (
                      <p className="text-[11px] text-muted-foreground">{t("products.ai.noProductImages")}</p>
                    ) : (
                      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
                        {form.images.map((img, i) => (
                          <button
                            key={`${img.src}-${i}`}
                            type="button"
                            onClick={() => setSelectedImageIdx(i)}
                            className={cn(
                              "relative h-11 w-11 shrink-0 overflow-hidden rounded border-2 transition-colors",
                              selectedImageIdx === i ? "border-primary ring-1 ring-primary/25" : "border-border hover:border-muted-foreground/40",
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.src} alt="" className="h-full w-full object-cover" />
                            {i === 0 && (
                              <span className="absolute bottom-0 left-0 right-0 bg-background/90 py-px text-center text-[8px]">{t("products.ai.mainBadge")}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{t("products.ai.hintOriginalUrl")}</p>
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2 space-y-1.5">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickFile(e.target.files)} />
                    <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-1.5 h-3 w-3" />
                      {t("products.ai.chooseFile")}
                    </Button>
                    {uploadPreview && (
                      <div className="aspect-video max-h-28 overflow-hidden rounded border border-border/80 bg-[#ffffff]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uploadPreview} alt="" className="h-full w-full object-contain" />
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="library" className="mt-2 space-y-1.5">
                    <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => setLibraryOpen(true)}>
                      {t("products.ai.openMediaLibrary")}
                    </Button>
                    {sourceTab === "library" && externalSourceUrl && (
                      <p className="text-[10px] text-muted-foreground">{t("products.ai.librarySelected")}</p>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="space-y-0.5 border-t border-border pt-2">
                  <Label className="text-[11px] font-medium text-muted-foreground">{t("products.ai.additionalPrompt")}</Label>
                  <Textarea
                    value={additionalPrompt}
                    onChange={(e) => setAdditionalPrompt(e.target.value)}
                    placeholder={t("products.ai.additionalPromptPlaceholder")}
                    rows={2}
                    className="min-h-[3.25rem] resize-y text-xs leading-snug"
                  />
                </div>

                <div className="space-y-1.5 rounded-lg border border-border/70 bg-[#ffffff] p-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Aspect ratio</Label>
                    <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
                      {ASPECT_RATIO_OPTIONS.map((option) => {
                        const Icon = aspectRatioIconMap[option.value];
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAspectRatio(option.value)}
                            className={cn(
                              "h-7 min-w-0 bg-[#ffffff] px-1 text-[10px] font-medium sm:px-1.5 sm:text-[11px]",
                              aspectRatio === option.value && "border-primary bg-primary/10 text-primary",
                            )}
                            title={`${option.label} (${option.value})`}
                            aria-label={`${option.label} (${option.value})`}
                          >
                            <Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                            <span className="ml-0.5 sm:ml-1">{option.value}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Output size</Label>
                    <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
                      {SIZE_PRESET_OPTIONS.map((preset) => {
                        const active = sizePreset === preset.value;
                        return (
                          <Button
                            key={preset.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSizePreset(preset.value)}
                            className={cn(
                              "h-7 min-w-0 flex-col gap-0 bg-[#ffffff] px-0.5 py-0.5 text-[9px] font-semibold leading-none sm:px-1 sm:text-[10px]",
                              active && "border-primary bg-primary/10 text-primary",
                            )}
                            title={preset.label}
                            aria-pressed={active}
                          >
                            <span>{SIZE_PRESET_SHORT[preset.value]}</span>
                            <span className="mt-0.5 hidden font-normal text-[8px] text-muted-foreground tabular-nums sm:inline sm:text-[9px]">
                              {preset.width}×{preset.height}
                            </span>
                          </Button>
                        );
                      })}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSizePreset("custom")}
                        className={cn(
                          "h-7 min-w-0 flex-col gap-0 bg-[#ffffff] px-0.5 py-0.5 text-[9px] font-semibold leading-none sm:px-1 sm:text-[10px]",
                          sizePreset === "custom" && "border-primary bg-primary/10 text-primary",
                        )}
                        title="Custom width and height"
                        aria-pressed={sizePreset === "custom"}
                      >
                        <SlidersHorizontal className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="mt-0.5 text-[8px] font-normal sm:text-[9px]">Custom</span>
                      </Button>
                    </div>
                    {sizePreset === "custom" && (
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <Input
                          type="number"
                          min={256}
                          max={4096}
                          step={1}
                          className="h-8 bg-[#ffffff] text-xs"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(e.target.value)}
                          placeholder="Width"
                        />
                        <Input
                          type="number"
                          min={256}
                          max={4096}
                          step={1}
                          className="h-8 bg-[#ffffff] text-xs"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(e.target.value)}
                          placeholder="Height"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-[11px] font-medium text-muted-foreground">{t("products.ai.applyTarget")}</Label>
                  <RadioGroup value={sourceMode} onValueChange={(v) => setSourceMode(v as "main" | "gallery")} className="flex flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="main" id="ai-src-main" className="h-3.5 w-3.5" />
                      <label htmlFor="ai-src-main" className="cursor-pointer text-xs">
                        {t("products.ai.sourceMain")}
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="gallery" id="ai-src-gal" className="h-3.5 w-3.5" disabled={galleryLen === 0} />
                      <label htmlFor="ai-src-gal" className={cn("cursor-pointer text-xs", galleryLen === 0 && "opacity-50")}>
                        {t("products.ai.sourceGallery")}
                      </label>
                    </div>
                  </RadioGroup>
                  {sourceMode === "gallery" && galleryLen > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5" role="group" aria-label={t("products.ai.applyTarget")}>
                      {Array.from({ length: galleryLen }, (_, i) => {
                        const active = gallerySlot === i;
                        return (
                          <Button
                            key={i}
                            type="button"
                            variant={active ? "default" : "outline"}
                            size="sm"
                            className="h-7 min-w-[4.5rem] px-2 text-[11px] font-medium"
                            onClick={() => setGallerySlot(i)}
                            aria-pressed={active}
                          >
                            {t("products.ai.gallerySlot", { n: i + 1 })}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                  <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                    {sourceMode === "main" ? t("products.ai.hintApplyMain") : t("products.ai.hintApplyGallery", { n: gallerySlot + 1 })}
                  </p>
                </div>
              </div>

              {/* Options column */}
              <div className="space-y-2 md:border-l md:border-border/80 md:pl-4">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">{t("products.ai.feature")}</Label>
                  {loadingFeatures ? (
                    <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      …
                    </div>
                  ) : features.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-2 py-3 text-[11px] text-muted-foreground">
                      {t("products.ai.noFeatures")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {features.map((f) => {
                        const active = featureSlug === f.slug;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setFeatureSlug(f.slug)}
                            aria-pressed={active}
                            className={cn(
                              "flex w-full min-w-0 items-start gap-2 rounded-md border bg-[#ffffff] px-2 py-1.5 text-left transition-colors",
                              active
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-border/80 hover:border-orange-200 hover:bg-orange-50/20",
                            )}
                          >
                            <AIFeatureCompactGlyph slug={f.slug} />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="line-clamp-2 text-[10px] font-semibold leading-snug">{f.name}</div>
                              {f.requires_source_image === false && (
                                <span className="inline-block rounded border border-slate-200/90 bg-slate-50 px-1 py-px text-[8px] font-medium text-muted-foreground">
                                  {t("products.ai.optionalRef")}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selected &&
                  (selected.user_input_schema?.fields || []).length > 0 && (
                    <div className="grid gap-1.5 sm:grid-cols-1">
                      {(selected.user_input_schema?.fields || []).map((f) => (
                        <div key={f.key} className="space-y-0.5">
                          <Label className="text-[11px] font-medium text-muted-foreground">{f.label}</Label>
                          {f.type === "hex_color" && Array.isArray(f.presets) ? (
                            <div className="flex flex-wrap items-center gap-2 pt-0.5" role="group" aria-label={f.label}>
                              {(() => {
                                const current = normalizeHex6(userValues[f.key] ?? "#FFFFFF");
                                const presetHexes = f.presets!.map((p) => normalizeHex6(p.hex));
                                const customActive = !presetHexes.some((h) => hexEquals(h, current));
                                return (
                                  <>
                                    {f.presets!.map((p) => {
                                      const hex = normalizeHex6(p.hex);
                                      const active = hexEquals(current, hex);
                                      return (
                                        <button
                                          key={hex}
                                          type="button"
                                          title={p.label}
                                          aria-label={p.label}
                                          aria-pressed={active}
                                          onClick={() => setUserValues((prev) => ({ ...prev, [f.key]: hex }))}
                                          className={cn(
                                            "relative h-7 w-7 shrink-0 rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-ring",
                                            hexEquals(hex, "#FFFFFF")
                                              ? "border-neutral-400 ring-1 ring-neutral-300"
                                              : "border-transparent",
                                            active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "hover:opacity-95",
                                          )}
                                          style={{ backgroundColor: hex }}
                                        >
                                          <span className="sr-only">{p.label}</span>
                                        </button>
                                      );
                                    })}
                                    <label
                                      className={cn(
                                        "relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-all focus-within:ring-2 focus-within:ring-ring",
                                        customActive
                                          ? "border-primary ring-2 ring-primary ring-offset-1 ring-offset-background"
                                          : "border-muted-foreground/45 hover:border-muted-foreground/70",
                                      )}
                                      title={t("products.ai.customColor")}
                                    >
                                      <input
                                        type="color"
                                        className="absolute inset-0 h-[200%] w-[200%] cursor-pointer -translate-x-1/4 -translate-y-1/4 border-0 p-0 opacity-0"
                                        value={current}
                                        onChange={(e) =>
                                          setUserValues((prev) => ({ ...prev, [f.key]: normalizeHex6(e.target.value) }))
                                        }
                                        aria-label={t("products.ai.customColor")}
                                      />
                                      <span
                                        className="pointer-events-none absolute inset-0 rounded-full"
                                        style={{ backgroundColor: customActive ? current : undefined }}
                                        aria-hidden
                                      />
                                      {!customActive && (
                                        <Palette className="relative z-[1] h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                      )}
                                    </label>
                                  </>
                                );
                              })()}
                            </div>
                          ) : f.type === "color_swatch" && f.options ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {f.options.map((o) => {
                                const value = optionValue(o);
                                const label = optionLabel(o);
                                const hex = typeof o === "string" ? undefined : o.hex;
                                const active = (userValues[f.key] ?? "") === value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setUserValues((p) => ({ ...p, [f.key]: value }))}
                                    title={label}
                                    aria-label={label}
                                    aria-pressed={active}
                                    className={cn(
                                      "group relative h-7 w-7 shrink-0 rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-ring",
                                      active
                                        ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
                                        : "border-border hover:border-muted-foreground/60"
                                    )}
                                    style={hex ? { backgroundColor: flatSwatchHex(hex) } : undefined}
                                  >
                                    <span className="sr-only">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : f.type === "select" && f.options ? (
                            f.options.length > 8 ? (
                              <Select value={userValues[f.key] ?? ""} onValueChange={(v) => setUserValues((p) => ({ ...p, [f.key]: v }))}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {f.options.map((o) => {
                                    const value = optionValue(o);
                                    const label = optionLabel(o);
                                    return (
                                      <SelectItem key={value} value={value} className="text-xs">
                                        {label}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex flex-wrap gap-1 pt-0.5" role="group" aria-label={f.label}>
                                {f.options.map((o) => {
                                  const value = optionValue(o);
                                  const label = optionLabel(o);
                                  const active = (userValues[f.key] ?? "") === value;
                                  return (
                                    <Button
                                      key={value}
                                      type="button"
                                      variant={active ? "default" : "outline"}
                                      size="sm"
                                      className="h-7 max-w-full truncate px-2.5 text-[11px] font-normal"
                                      title={label}
                                      onClick={() => setUserValues((p) => ({ ...p, [f.key]: value }))}
                                      aria-pressed={active}
                                    >
                                      {label}
                                    </Button>
                                  );
                                })}
                              </div>
                            )
                          ) : f.type === "textarea" ? (
                            <Textarea
                              value={userValues[f.key] ?? ""}
                              onChange={(e) => setUserValues((p) => ({ ...p, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              rows={2}
                              className="min-h-[3.25rem] resize-y text-xs leading-snug"
                            />
                          ) : (
                            <Input className="h-8 text-xs" value={userValues[f.key] ?? ""} onChange={(e) => setUserValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                <div className="space-y-0.5 pt-0.5">
                  <Label className="text-[11px] font-medium text-muted-foreground">{t("products.ai.outputCount")}</Label>
                  <div className="flex flex-wrap gap-1" role="group" aria-label={t("products.ai.outputCount")}>
                    {Array.from({ length: MAX_AI_IMAGE_OUTPUT_COUNT }, (_, i) => i + 1).map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant={outCount === n ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-[11px] font-medium tabular-nums"
                        onClick={() => setOutCount(n)}
                        aria-pressed={outCount === n}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {outputs.length > 0 && (
              <aside
                className={cn(
                  "flex shrink-0 flex-col gap-2 border-border bg-[#ffffff]",
                  "max-h-[min(42vh,400px)] overflow-y-auto border-t px-3 py-3",
                  "lg:h-full lg:max-h-none lg:min-h-0 lg:w-[min(340px,34vw)] lg:min-w-[260px] lg:max-w-[360px] lg:overflow-hidden lg:border-l lg:border-t-0 lg:px-4 lg:py-3",
                )}
              >
                <div className="text-[11px] font-medium text-muted-foreground">{t("products.ai.creditsUsed", { count: creditsSpent })}</div>

                <div className="relative flex min-h-[140px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-muted/10 lg:min-h-[200px] lg:flex-[1_1_auto]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={outputs[sidebarPreviewIdx]?.signedUrl}
                    alt=""
                    className="max-h-[min(38vh,360px)] max-w-full cursor-zoom-in object-contain lg:max-h-[min(52vh,520px)]"
                    onClick={() => setLightboxIndex(sidebarPreviewIdx)}
                    title={t("products.ai.previewOutput")}
                  />
                  {outputs.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute left-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-border/80 bg-background/95 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSidebarPreviewIdx((i) => (i - 1 + outputs.length) % outputs.length);
                        }}
                        aria-label="Previous output"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-border/80 bg-background/95 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSidebarPreviewIdx((i) => (i + 1) % outputs.length);
                        }}
                        aria-label="Next output"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground shadow-sm">
                        {sidebarPreviewIdx + 1} / {outputs.length}
                      </div>
                    </>
                  )}
                </div>

                {outputs.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
                    {outputs.map((o, i) => (
                      <button
                        key={`${o.path}-${o.index}-${i}`}
                        type="button"
                        onClick={() => setSidebarPreviewIdx(i)}
                        className={cn(
                          "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                          i === sidebarPreviewIdx ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-muted-foreground/50",
                        )}
                        aria-label={`Output ${i + 1}`}
                        aria-current={i === sidebarPreviewIdx}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={o.signedUrl} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <p className="line-clamp-3 text-[10px] leading-snug text-muted-foreground">{t("products.ai.hintRegenerateActions")}</p>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() =>
                      void applyPlacements([
                        {
                          outputIndex: outputs[sidebarPreviewIdx]?.index ?? outputs[0].index,
                          applyAs: sourceMode === "main" ? "main" : "gallery_replace",
                          galleryIndex: sourceMode === "gallery" ? gallerySlot : undefined,
                        },
                      ])
                    }
                  >
                    {t("products.ai.applyBest")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[11px]"
                    onClick={() => void applyPlacements(outputs.map((o) => ({ outputIndex: o.index, applyAs: "gallery_append" as const })))}
                  >
                    {t("products.ai.appendAllGallery")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void runRegenerate()}>
                    {t("products.ai.regenerate")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => void rejectStaging()}>
                    {t("products.ai.discard")}
                  </Button>
                </div>
              </aside>
            )}
          </div>

          <DialogFooter className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2 border-t border-border bg-[#ffffff] px-4 py-2.5 sm:justify-end">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => void rejectStaging()}>
              {t("products.ai.close")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 min-w-[10.5rem] gap-1.5 px-4 text-xs font-medium"
              disabled={generating || !featureSlug}
              onClick={() => void runGenerate()}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="inline-flex flex-wrap items-center gap-x-1">
                <span>{generating ? t("products.ai.generating") : t("products.ai.generate")}</span>
                {!generating && selected && estimatedGenerateCredits > 0 && (
                  <span className="tabular-nums opacity-95">· {estimatedGenerateCredits} cr</span>
                )}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lightboxIndex !== null} onOpenChange={(o) => !o && setLightboxIndex(null)}>
        <DialogContent className="max-w-[min(96vw,900px)] bg-[#ffffff] p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("products.ai.previewOutput")}</DialogTitle>
          </DialogHeader>
          {lightboxIndex !== null && outputs[lightboxIndex] && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outputs[lightboxIndex].signedUrl} alt="" className="w-full max-h-[85vh] object-contain rounded-md bg-[#ffffff]" />
              {outputs.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full shadow-sm"
                    onClick={() => setLightboxIndex((i) => (i == null ? 0 : (i - 1 + outputs.length) % outputs.length))}
                    aria-label="Previous output image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full shadow-sm"
                    onClick={() => setLightboxIndex((i) => (i == null ? 0 : (i + 1) % outputs.length))}
                    aria-label="Next output image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImagePickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        storeId={storeId}
        mode="single"
        title={t("products.ai.pickFromLibrary")}
        onConfirm={onLibraryConfirm}
      />
    </>
  );
}
