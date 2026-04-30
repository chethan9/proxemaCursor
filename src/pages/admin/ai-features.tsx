import { useState } from "react";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("ai.featuresTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("ai.featuresSubtitle")}</p>
        </div>
        <Button onClick={openCreate}>{t("ai.addFeature")}</Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>Slug must stay stable for stored generations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ai.slug")}</TableHead>
                  <TableHead>{t("ai.name")}</TableHead>
                  <TableHead>{t("ai.provider")}</TableHead>
                  <TableHead>{t("ai.model")}</TableHead>
                  <TableHead>{t("ai.credits")}</TableHead>
                  <TableHead>{t("ai.active")}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.slug}</TableCell>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{f.provider}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">{f.model}</TableCell>
                    <TableCell>{f.credit_cost_per_output}</TableCell>
                    <TableCell>{f.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => testFeature.mutate(f.id)} disabled={testFeature.isPending}>
                        <FlaskConical className="h-3.5 w-3.5 mr-1" /> {t("ai.test")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(f)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del.mutate(f.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
              <div>
                <Label>{t("ai.provider")}</Label>
                <Select value={form.provider || "google_gemini"} onValueChange={(v) => setForm((p) => ({ ...p, provider: v as Feature["provider"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_gemini">google_gemini</SelectItem>
                    <SelectItem value="openai_image">openai_image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("ai.model")}</Label>
                <Input value={form.model || ""} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} />
              </div>
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
              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={Boolean(form.supports_main)} onCheckedChange={(c) => setForm((p) => ({ ...p, supports_main: c }))} />
                  Main
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={Boolean(form.supports_gallery)} onCheckedChange={(c) => setForm((p) => ({ ...p, supports_gallery: c }))} />
                  Gallery
                </label>
              </div>
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
