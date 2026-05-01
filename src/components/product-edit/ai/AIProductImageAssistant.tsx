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
import { Loader2, Sparkles, Undo2, Upload, Images } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeProductImageSrc } from "@/lib/product-image-urls";
import { ImagePickerDialog, type SelectedImage } from "@/components/product-edit/ImagePickerDialog";
import { cn } from "@/lib/utils";

type AIFeature = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provider: string;
  default_output_count: number;
  credit_cost_per_output: number;
  requires_source_image?: boolean;
  user_input_schema: { fields?: Array<{ key: string; label: string; type: string; options?: string[] }> };
};

type GenOutput = { path: string; signedUrl: string; index: number };

type SourceTab = "product" | "upload" | "library";

/** Single entry point: AI-assisted images for main + gallery. */
export function AIProductImageAssistant({
  storeId,
  productId,
  form,
  setForm,
}: {
  storeId: string;
  productId?: string | null;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [sourceMode, setSourceMode] = useState<"main" | "gallery">("main");
  const [gallerySlot, setGallerySlot] = useState(0);

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
    setAdditionalPrompt("");
    setLightboxUrl(null);
  }, [open, loadFeatures]);

  useEffect(() => {
    if (!selected || !open) return;
    setOutCount(selected.default_output_count || 1);
    const next: Record<string, string> = {};
    (selected.user_input_schema?.fields || []).forEach((f) => {
      next[f.key] = f.options?.[0] ?? "";
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
          userInput: userValues,
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

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setOpen(true)}>
        {loadingFeatures && open ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        <span className="text-xs">{t("products.ai.open")}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("products.ai.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Button type="button" variant="ghost" size="sm" className="gap-1 h-8 -mt-1" onClick={revertLocal}>
              <Undo2 className="h-3.5 w-3.5" />
              {t("products.ai.revert")}
            </Button>

            <div className="space-y-2">
              <Label className="text-xs">{t("products.ai.referenceImage")}</Label>
              <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as SourceTab)}>
                <TabsList className="grid w-full grid-cols-3 h-9">
                  <TabsTrigger value="product" className="text-xs">
                    {t("products.ai.tabProduct")}
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs gap-1">
                    <Upload className="h-3 w-3 shrink-0" />
                    {t("products.ai.tabUpload")}
                  </TabsTrigger>
                  <TabsTrigger value="library" className="text-xs gap-1">
                    <Images className="h-3 w-3 shrink-0" />
                    {t("products.ai.tabLibrary")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="product" className="mt-3 space-y-2">
                  {thumbCount === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("products.ai.noProductImages")}</p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {form.images.map((img, i) => (
                        <button
                          key={`${img.src}-${i}`}
                          type="button"
                          onClick={() => setSelectedImageIdx(i)}
                          className={cn(
                            "relative h-16 w-16 shrink-0 rounded-md border-2 overflow-hidden transition-colors",
                            selectedImageIdx === i ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-muted-foreground/40"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.src} alt="" className="h-full w-full object-cover" />
                          {i === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-background/90 text-[9px] py-0.5 text-center">{t("products.ai.mainBadge")}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground leading-snug">{t("products.ai.hintOriginalUrl")}</p>
                </TabsContent>
                <TabsContent value="upload" className="mt-3 space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickFile(e.target.files)} />
                  <Button type="button" variant="outline" size="sm" className="w-full h-9" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-2" />
                    {t("products.ai.chooseFile")}
                  </Button>
                  {uploadPreview && (
                    <div className="rounded-md border overflow-hidden aspect-video max-h-40 bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={uploadPreview} alt="" className="h-full w-full object-contain" />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="library" className="mt-3 space-y-2">
                  <Button type="button" variant="outline" size="sm" className="w-full h-9" onClick={() => setLibraryOpen(true)}>
                    {t("products.ai.openMediaLibrary")}
                  </Button>
                  {sourceTab === "library" && externalSourceUrl && (
                    <p className="text-[11px] text-muted-foreground">{t("products.ai.librarySelected")}</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t("products.ai.applyTarget")}</Label>
              <RadioGroup value={sourceMode} onValueChange={(v) => setSourceMode(v as "main" | "gallery")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="main" id="ai-src-main" />
                  <label htmlFor="ai-src-main" className="text-sm">
                    {t("products.ai.sourceMain")}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="gallery" id="ai-src-gal" disabled={galleryLen === 0} />
                  <label htmlFor="ai-src-gal" className="text-sm">
                    {t("products.ai.sourceGallery")}
                  </label>
                </div>
              </RadioGroup>
              {sourceMode === "gallery" && galleryLen > 0 && (
                <Select value={String(gallerySlot)} onValueChange={(v) => setGallerySlot(Number(v))}>
                  <SelectTrigger>
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
              <p className="text-[11px] text-muted-foreground leading-snug">
                {sourceMode === "main" ? t("products.ai.hintApplyMain") : t("products.ai.hintApplyGallery", { n: gallerySlot + 1 })}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("products.ai.feature")}</Label>
              <Select value={featureSlug} onValueChange={setFeatureSlug}>
                <SelectTrigger>
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  {features.map((f) => (
                    <SelectItem key={f.id} value={f.slug}>
                      {f.name} ({f.credit_cost_per_output} cr)
                      {f.requires_source_image === false ? ` · ${t("products.ai.optionalRef")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (selected.user_input_schema?.fields || []).map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                {f.type === "select" && f.options ? (
                  <Select value={userValues[f.key] ?? ""} onValueChange={(v) => setUserValues((p) => ({ ...p, [f.key]: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={userValues[f.key] ?? ""} onChange={(e) => setUserValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}

            <div className="space-y-1">
              <Label className="text-xs">{t("products.ai.additionalPrompt")}</Label>
              <Textarea
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                placeholder={t("products.ai.additionalPromptPlaceholder")}
                className="min-h-[72px] text-sm resize-y"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t("products.ai.outputCount")}</Label>
              <Input type="number" min={1} max={8} value={outCount} onChange={(e) => setOutCount(Number(e.target.value) || 1)} />
            </div>

            <Button type="button" className="w-full gap-2" disabled={generating || !featureSlug} onClick={() => void runGenerate()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? t("products.ai.generating") : t("products.ai.generate")}
            </Button>

            {outputs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground">{t("products.ai.creditsUsed", { count: creditsSpent })}</div>
                <div className="grid grid-cols-2 gap-2">
                  {outputs.map((o) => (
                    <button
                      key={o.index}
                      type="button"
                      className="relative rounded-md border overflow-hidden aspect-square focus:outline-none focus:ring-2 focus:ring-ring"
                      onClick={() => setLightboxUrl(o.signedUrl)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.signedUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">{t("products.ai.hintRegenerateActions")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
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
                  <Button type="button" size="sm" variant="secondary" onClick={() => void applyPlacements(outputs.map((o) => ({ outputIndex: o.index, applyAs: "gallery_append" as const })))}>
                    {t("products.ai.appendAllGallery")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void runRegenerate()}>
                    {t("products.ai.regenerate")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void rejectStaging()}>
                    {t("products.ai.discard")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void rejectStaging()}>
              {t("products.ai.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-w-[min(96vw,900px)] p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("products.ai.previewOutput")}</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={lightboxUrl} alt="" className="w-full max-h-[85vh] object-contain rounded-md bg-muted/30" />
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
