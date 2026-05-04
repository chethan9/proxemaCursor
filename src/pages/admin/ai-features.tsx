import { useEffect, useMemo, useState } from "react";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AiFeaturePreviewArt } from "@/components/admin/AiFeaturePreviewArt";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FlaskConical, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/helpers";

type Feature = Tables<"ai_features">;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

function isClearlyWrongProvider(provider: "google_gemini" | "openai_image", model: string): boolean {
  const m = model.trim().toLowerCase();
  if (!m) return false;
  if (provider === "openai_image") return m.includes("gemini") || m.startsWith("models/");
  return /^(dall-e|gpt-image)/i.test(model.trim());
}

const emptyForm: Partial<Feature> = {
  slug: "",
  name: "",
  description: "",
  provider: "google_gemini",
  model: "gemini-2.5-flash-image-preview",
  prompt_template: "",
  default_output_count: 1,
  supports_main: true,
  supports_gallery: true,
  requires_source_image: true,
  credit_cost_per_output: 1,
  user_input_schema: { fields: [] } as Feature["user_input_schema"],
  is_active: true,
  sort_order: 0,
};

function Inner() {
  const { t } = useTranslation("admin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Feature | null>(null);
  const [form, setForm] = useState<Partial<Feature>>(emptyForm);
  const [schemaText, setSchemaText] = useState("{}");

  const providerId = (form.provider || "google_gemini") as "google_gemini" | "openai_image";

  const {
    data: modelsPayload,
    isLoading: modelsLoading,
    isFetching: modelsFetching,
    error: modelsQueryError,
  } = useQuery({
    queryKey: ["admin-ai-provider-models", providerId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-provider-models?provider=${encodeURIComponent(providerId)}`, {
        headers: await authHeaders(),
      });
      const j = (await res.json()) as { models?: Array<{ id: string }>; error?: string | null };
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to load models");
      return j as { models: Array<{ id: string }>; error: string | null };
    },
    enabled: dialogOpen,
    staleTime: 60_000,
  });

  const modelIdsFromApi = useMemo(() => modelsPayload?.models?.map((m) => m.id) ?? [], [modelsPayload?.models]);
  const modelsApiMessage = modelsPayload?.error ?? null;

  const modelSelectIds = useMemo(() => {
    const ids = [...modelIdsFromApi];
    const cur = form.model?.trim();
    if (cur && !ids.includes(cur)) ids.unshift(cur);
    return ids;
  }, [modelIdsFromApi, form.model]);

  useEffect(() => {
    if (!dialogOpen || modelsLoading) return;
    if (modelIdsFromApi.length === 0) return;
    const cur = form.model?.trim() ?? "";

    if (cur && modelIdsFromApi.includes(cur)) return;

    if (cur && isClearlyWrongProvider(providerId, cur)) {
      setForm((p) => ({ ...p, model: modelIdsFromApi[0] }));
      return;
    }

    if (!cur) {
      setForm((p) => ({ ...p, model: modelIdsFromApi[0] }));
    }
  }, [dialogOpen, modelsLoading, providerId, modelIdsFromApi, form.model]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-ai-features"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai-features", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed");
      const j = await res.json();
      return (j.features || []) as Feature[];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSchemaText(JSON.stringify({ fields: [] }, null, 2));
    setDialogOpen(true);
  };

  const openEdit = (f: Feature) => {
    setEditing(f);
    setForm(f);
    setSchemaText(JSON.stringify(f.user_input_schema ?? { fields: [] }, null, 2));
    setDialogOpen(true);
  };

  const saveFeature = useMutation({
    mutationFn: async () => {
      let schema: Feature["user_input_schema"];
      try {
        schema = JSON.parse(schemaText) as Feature["user_input_schema"];
      } catch {
        throw new Error("Invalid user_input_schema JSON");
      }
      const payload = { ...form, user_input_schema: schema };
      if (editing) {
        const res = await fetch(`/api/admin/ai-features/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || "Update failed");
        }
      } else {
        const res = await fetch("/api/admin/ai-features", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || "Create failed");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ai-features"] });
      setDialogOpen(false);
      toast({ title: "Saved" });
    },
    onError: (e) => toast({ title: "Error", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/ai-features/${id}`, { method: "DELETE", headers: await authHeaders() });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ai-features"] });
      toast({ title: "Deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const testFeature = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/ai-features/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Test failed");
      return j as { previewUrl?: string };
    },
    onSuccess: (j) => {
      if (j.previewUrl) window.open(j.previewUrl, "_blank", "noopener,noreferrer");
      toast({ title: "Test completed", description: j.previewUrl ? "Opened preview in new tab." : "No preview URL." });
    },
    onError: (e) => toast({ title: "Test failed", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const features = data ?? [];

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("ai.featuresTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("ai.featuresSubtitle")}</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          {t("ai.addFeature")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Illustrations are stylized hints (not real model output). Slug must stay stable for stored generations.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!isLoading && features.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No features yet. Add one to get started.</CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-6">
        {features.map((f) => {
          const requiresSrc = (f as { requires_source_image?: boolean }).requires_source_image !== false;
          return (
            <article
              key={f.id}
              className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row">
                <div className="relative shrink-0 border-b bg-gradient-to-br from-muted/40 to-muted/15 p-4 md:w-[min(100%,400px)] md:border-b-0 md:border-r">
                  <AiFeaturePreviewArt slug={f.slug} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 md:py-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-lg font-semibold tracking-tight">{f.name}</h2>
                      <p className="font-mono text-xs text-muted-foreground break-all">{f.slug}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={f.is_active ? "success" : "secondary"}>{f.is_active ? "Active" : "Inactive"}</Badge>
                      <Badge variant="outline">
                        {f.credit_cost_per_output} {t("ai.credits")}
                      </Badge>
                      <Badge variant={requiresSrc ? "info" : "outline"}>{requiresSrc ? "Needs image" : "Image optional"}</Badge>
                    </div>
                  </div>
                  {f.description ? <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p> : null}
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("ai.provider")}</dt>
                      <dd className="mt-0.5 font-mono text-xs">{f.provider}</dd>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("ai.model")}</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs leading-snug">{f.model}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2 border-t pt-4 mt-auto">
                    <Button variant="outline" size="sm" onClick={() => testFeature.mutate(f.id)} disabled={testFeature.isPending}>
                      <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> {t("ai.test")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(f)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => del.mutate(f.id)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit feature" : "New feature"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Slug</Label>
                <Input value={form.slug || ""} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} disabled={Boolean(editing)} />
              </div>
              <div>
                <Label>Sort</Label>
                <Input
                  type="number"
                  value={form.sort_order ?? 0}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 sm:col-span-1">
                <Label>{t("ai.provider")}</Label>
                <Select
                  value={form.provider || "google_gemini"}
                  onValueChange={(v) => setForm((p) => ({ ...p, provider: v as Feature["provider"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_gemini">google_gemini</SelectItem>
                    <SelectItem value="openai_image">openai_image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("ai.model")}</Label>
              {modelsLoading || (modelsFetching && modelIdsFromApi.length === 0) ? (
                <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Loading models for this provider…
                </div>
              ) : modelsQueryError ? (
                <div className="space-y-1">
                  <p className="text-xs text-destructive">
                    {modelsQueryError instanceof Error ? modelsQueryError.message : "Could not load models"}
                  </p>
                  <Input value={form.model || ""} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} placeholder="Enter model id" />
                </div>
              ) : modelSelectIds.length === 0 ? (
                <div className="space-y-1">
                  {modelsApiMessage && (
                    <p className="text-xs text-muted-foreground">{modelsApiMessage}</p>
                  )}
                  <Input value={form.model || ""} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} placeholder="Enter model id" />
                </div>
              ) : (
                <div className="space-y-1">
                  <Select
                    value={form.model && modelSelectIds.includes(form.model) ? form.model : modelSelectIds[0]}
                    onValueChange={(v) => setForm((p) => ({ ...p, model: v }))}
                  >
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(280px,50vh)]">
                      {modelSelectIds.map((id) => (
                        <SelectItem key={id} value={id} className="font-mono text-xs">
                          {id}
                          {modelIdsFromApi.includes(id) ? "" : " (saved)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {modelsApiMessage && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">{modelsApiMessage}</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>Prompt template</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.prompt_template || ""}
                onChange={(e) => setForm((p) => ({ ...p, prompt_template: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Default outputs</Label>
                <Input
                  type="number"
                  value={form.default_output_count ?? 1}
                  onChange={(e) => setForm((p) => ({ ...p, default_output_count: parseInt(e.target.value, 10) || 1 }))}
                />
              </div>
              <div>
                <Label>{t("ai.credits")}</Label>
                <Input
                  type="number"
                  value={form.credit_cost_per_output ?? 1}
                  onChange={(e) => setForm((p) => ({ ...p, credit_cost_per_output: parseInt(e.target.value, 10) || 1 }))}
                />
              </div>
              <div className="flex flex-wrap items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={Boolean(form.supports_main)} onCheckedChange={(c) => setForm((p) => ({ ...p, supports_main: c }))} />
                  Main
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={Boolean(form.supports_gallery)} onCheckedChange={(c) => setForm((p) => ({ ...p, supports_gallery: c }))} />
                  Gallery
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={(form as { requires_source_image?: boolean }).requires_source_image !== false}
                    onCheckedChange={(c) => setForm((p) => ({ ...p, requires_source_image: c }))}
                  />
                  Require source image
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2">
                When off, Gemini may run without a reference image; OpenAI image edits still need one.
              </p>
            </div>
            <div>
              <Label>user_input_schema (JSON)</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={Boolean(form.is_active)} onCheckedChange={(c) => setForm((p) => ({ ...p, is_active: c }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveFeature.mutate()} disabled={saveFeature.isPending}>
              {saveFeature.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminAiFeaturesPage() {
  return (
    <AppLayout title="AI features" requireSuperAdmin bypassBillingGate>
      <Inner />
    </AppLayout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "admin"])),
  },
});
