"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { supabase } from "@/integrations/supabase/client";
import { ProductFormState } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type AIFeature = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  default_output_count: number;
  credit_cost_per_output: number;
  user_input_schema: { fields?: Array<{ key: string; label: string; type: string; options?: string[] }> };
};

type GenOutput = { path: string; signedUrl: string; index: number };

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
  const [sourceMode, setSourceMode] = useState<"main" | "gallery">("main");
  const [gallerySlot, setGallerySlot] = useState(0);

  const selected = features.find((f) => f.slug === featureSlug);

  const loadFeatures = useCallback(async () => {
    setLoadingFeatures(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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

  const sourceUrls = (): string[] => {
    if (sourceMode === "main") {
      const m = form.images[0];
      return m?.src ? [m.src] : [];
    }
    const g = form.images[gallerySlot + 1];
    return g?.src ? [g.src] : [];
  };

  const runGenerate = async () => {
    const sources = sourceUrls().map((url) => ({ url, role: "source" }));
    if (sources.length === 0) {
      toast({ title: t("products.ai.noImage"), variant: "destructive" });
      return;
    }
    if (!featureSlug) return;
    setGenerating(true);
    setOutputs([]);
    setGenerationId(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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

  const applyPlacements = async (
    placements: Array<{ outputIndex: number; applyAs: "main" | "gallery_append" | "gallery_replace"; galleryIndex?: number }>
  ) => {
    if (!generationId) return;
    const { data: { session } } = await supabase.auth.getSession();
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
      const { data: { session } } = await supabase.auth.getSession();
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
              <Label className="text-xs">{t("products.ai.source")}</Label>
              <RadioGroup value={sourceMode} onValueChange={(v) => setSourceMode(v as "main" | "gallery")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="main" id="ai-src-main" />
                  <label htmlFor="ai-src-main" className="text-sm">{t("products.ai.sourceMain")}</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="gallery" id="ai-src-gal" disabled={galleryLen === 0} />
                  <label htmlFor="ai-src-gal" className="text-sm">{t("products.ai.sourceGallery")}</label>
                </div>
              </RadioGroup>
              {sourceMode === "gallery" && galleryLen > 0 && (
                <Select value={String(gallerySlot)} onValueChange={(v) => setGallerySlot(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: galleryLen }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{t("products.ai.gallerySlot", { n: i + 1 })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("products.ai.feature")}</Label>
              <Select value={featureSlug} onValueChange={setFeatureSlug}>
                <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                <SelectContent>
                  {features.map((f) => (
                    <SelectItem key={f.id} value={f.slug}>{f.name} ({f.credit_cost_per_output} cr)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (selected.user_input_schema?.fields || []).map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                {f.type === "select" && f.options ? (
                  <Select value={userValues[f.key] ?? ""} onValueChange={(v) => setUserValues((p) => ({ ...p, [f.key]: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={userValues[f.key] ?? ""} onChange={(e) => setUserValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}

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
                    <div key={o.index} className="relative rounded-md border overflow-hidden aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.signedUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void applyPlacements([{
                      outputIndex: outputs[0].index,
                      applyAs: sourceMode === "main" ? "main" : "gallery_replace",
                      galleryIndex: sourceMode === "gallery" ? gallerySlot : undefined,
                    }])}
                  >
                    {t("products.ai.applyBest")}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void applyPlacements(outputs.map((o) => ({ outputIndex: o.index, applyAs: "gallery_append" as const })))}>
                    {t("products.ai.appendAllGallery")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void runGenerate()}>
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
            <Button type="button" variant="outline" onClick={() => void rejectStaging()}>{t("products.ai.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
