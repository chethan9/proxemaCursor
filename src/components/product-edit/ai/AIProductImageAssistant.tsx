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
  Undo2,
  Upload,
  Images,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  Monitor,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeProductImageSrc } from "@/lib/product-image-urls";
import { ImagePickerDialog, type SelectedImage } from "@/components/product-edit/ImagePickerDialog";
import { cn } from "@/lib/utils";
import {
  ASPECT_RATIO_OPTIONS,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CUSTOM_HEIGHT,
  DEFAULT_CUSTOM_WIDTH,
  DEFAULT_SIZE_PRESET,
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
    fields?: Array<{ key: string; label: string; type: string; options?: FieldOption[]; placeholder?: string }>;
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

/** Single entry point: AI-assisted images for main + gallery. */
export function AIProductImageAssistant({
  storeId,
  productId,
  form,
  setForm,
  compact = false,
  tone = "default",
  label,
}: {
  storeId: string;
  productId?: string | null;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
  compact?: boolean;
  tone?: "default" | "orange";
  label?: string;
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

  const [sourceMode, setSourceMode] = useState<"main" | "gallery">("main");
  const [gallerySlot, setGallerySlot] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>(DEFAULT_ASPECT_RATIO);
  const [sizePreset, setSizePreset] = useState<SizePresetValue>(DEFAULT_SIZE_PRESET);
  const [customWidth, setCustomWidth] = useState(String(DEFAULT_CUSTOM_WIDTH));
  const [customHeight, setCustomHeight] = useState(String(DEFAULT_CUSTOM_HEIGHT));

  const selected = features.find((f) => f.slug === featureSlug);

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
  }, [open, loadFeatures]);

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
    setOutCount(selected.default_output_count || 1);
    const next: Record<string, string> = {};
    (selected.user_input_schema?.fields || []).forEach((f) => {
      if (f.type === "textarea") {
        next[f.key] = "";
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
          outputCount: outCount,
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
            : "border-border/70 bg-background/80 hover:bg-accent",
          compact ? "h-8 w-8 p-0" : "h-8 gap-1.5 px-3"
        )}
        onClick={() => setOpen(true)}
        title={label || t("products.ai.open")}
        aria-label={label || t("products.ai.open")}
      >
        {loadingFeatures && open ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {!compact && <span>{label || t("products.ai.open")}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(92vh,820px)] w-[calc(100vw-1.5rem)] max-w-[min(100vw-1.5rem,940px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[940px]">
          <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 py-2.5 pr-11 text-left">
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-base font-semibold leading-tight">{t("products.ai.title")}</DialogTitle>
              <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-[11px]" onClick={revertLocal}>
                <Undo2 className="h-3 w-3" />
                {t("products.ai.revert")}
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2 md:gap-x-4 md:items-start">
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
                              "relative h-14 w-14 shrink-0 overflow-hidden rounded border-2 transition-colors",
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
                      <div className="aspect-video max-h-28 overflow-hidden rounded border bg-muted">
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
                    rows={3}
                    className="min-h-[5.5rem] resize-y text-xs leading-snug"
                  />
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
                    <Select value={String(gallerySlot)} onValueChange={(v) => setGallerySlot(Number(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: galleryLen }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {t("products.ai.gallerySlot", { n: i + 1 })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                    {sourceMode === "main" ? t("products.ai.hintApplyMain") : t("products.ai.hintApplyGallery", { n: gallerySlot + 1 })}
                  </p>
                </div>
              </div>

              {/* Options column */}
              <div className="space-y-2 md:border-l md:border-border md:pl-4">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">{t("products.ai.feature")}</Label>
                  <Select value={featureSlug} onValueChange={setFeatureSlug}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="…" />
                    </SelectTrigger>
                    <SelectContent>
                      {features.map((f) => (
                        <SelectItem key={f.id} value={f.slug} className="text-xs">
                          {f.name} ({f.credit_cost_per_output} cr)
                          {f.requires_source_image === false ? ` · ${t("products.ai.optionalRef")}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selected &&
                  (selected.user_input_schema?.fields || []).length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-1">
                      {(selected.user_input_schema?.fields || []).map((f) => (
                        <div key={f.key} className="space-y-0.5">
                          <Label className="text-[11px] font-medium text-muted-foreground">{f.label}</Label>
                          {f.type === "color_swatch" && f.options ? (
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
                                    style={hex ? { backgroundColor: hex } : undefined}
                                  >
                                    <span className="sr-only">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : f.type === "select" && f.options ? (
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
                          ) : f.type === "textarea" ? (
                            <Textarea
                              value={userValues[f.key] ?? ""}
                              onChange={(e) => setUserValues((p) => ({ ...p, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              rows={4}
                              className="min-h-[4.5rem] resize-y text-xs leading-snug"
                            />
                          ) : (
                            <Input className="h-8 text-xs" value={userValues[f.key] ?? ""} onChange={(e) => setUserValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Aspect ratio</Label>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
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
                              "h-9 min-w-0 px-2 text-[11px] font-medium",
                              aspectRatio === option.value && "border-primary bg-primary/10 text-primary"
                            )}
                            title={`${option.label} (${option.value})`}
                            aria-label={`${option.label} (${option.value})`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="ml-1">{option.value}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Output size</Label>
                    <Select value={sizePreset} onValueChange={(v) => setSizePreset(v as SizePresetValue)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_PRESET_OPTIONS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value} className="text-xs">
                            {preset.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-xs">
                          Custom size
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {sizePreset === "custom" && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input
                          type="number"
                          min={256}
                          max={4096}
                          step={1}
                          className="h-8 text-xs"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(e.target.value)}
                          placeholder="Width"
                        />
                        <Input
                          type="number"
                          min={256}
                          max={4096}
                          step={1}
                          className="h-8 text-xs"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(e.target.value)}
                          placeholder="Height"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">{t("products.ai.outputCount")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      className="h-8 w-full max-w-[5rem] text-xs"
                      value={outCount}
                      onChange={(e) => setOutCount(Number(e.target.value) || 1)}
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 w-full shrink-0 gap-1.5 px-4 text-xs sm:w-auto"
                    disabled={generating || !featureSlug}
                    onClick={() => void runGenerate()}
                  >
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? t("products.ai.generating") : t("products.ai.generate")}
                  </Button>
                </div>
              </div>
            </div>

            {outputs.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="text-[11px] text-muted-foreground">{t("products.ai.creditsUsed", { count: creditsSpent })}</div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {outputs.map((o) => (
                    <button
                      key={o.index}
                      type="button"
                      className="relative aspect-square overflow-hidden rounded border focus:outline-none focus:ring-2 focus:ring-ring"
                      onClick={() => {
                        const idx = outputs.findIndex((item) => item.index === o.index);
                        setLightboxIndex(idx >= 0 ? idx : 0);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.signedUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <p className="line-clamp-2 text-[10px] text-muted-foreground">{t("products.ai.hintRegenerateActions")}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() =>
                      void applyPlacements([
                        {
                          outputIndex: outputs[0].index,
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
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void rejectStaging()}>
              {t("products.ai.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lightboxIndex !== null} onOpenChange={(o) => !o && setLightboxIndex(null)}>
        <DialogContent className="max-w-[min(96vw,900px)] p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("products.ai.previewOutput")}</DialogTitle>
          </DialogHeader>
          {lightboxIndex !== null && outputs[lightboxIndex] && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outputs[lightboxIndex].signedUrl} alt="" className="w-full max-h-[85vh] object-contain rounded-md bg-muted/30" />
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
