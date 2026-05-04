import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, BarChart3, ExternalLink } from "lucide-react";

/** Row shape returned by GET /api/admin/standard-reports (typed locally; API module may be absent in some branches). */
export type StandardReportRow = {
  id: string;
  title: string;
  description: string | null;
  provider: string;
  dashboard_url: string | null;
  metabase_site_url: string | null;
  embed_resource_type: "dashboard" | "question" | null;
  embed_resource_id: number | null;
  locked_params: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
  report_group: string | null;
  icon: string | null;
};

async function fetchReports(): Promise<StandardReportRow[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch("/api/admin/standard-reports", {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as StandardReportRow[];
}

type Provider = "metabase" | "link";

export default function AdminStandardReportsPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { profile, isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<StandardReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StandardReportRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formProvider, setFormProvider] = useState<Provider>("metabase");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formMetabaseSite, setFormMetabaseSite] = useState("");
  const [formEmbedType, setFormEmbedType] = useState<"dashboard" | "question">("dashboard");
  const [formEmbedId, setFormEmbedId] = useState("");
  const [formLockedJson, setFormLockedJson] = useState("{\n}\n");
  const [formSort, setFormSort] = useState("0");
  const [formActive, setFormActive] = useState(true);
  const [formGroup, setFormGroup] = useState("");
  const [formIcon, setFormIcon] = useState("");

  useEffect(() => {
    if (profile && !isSuperAdmin) {
      void router.replace("/");
    }
  }, [profile, isSuperAdmin, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchReports());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin]);

  function openCreate() {
    setEditing(null);
    setFormProvider("metabase");
    setFormTitle("");
    setFormDescription("");
    setFormUrl("");
    setFormMetabaseSite("");
    setFormEmbedType("dashboard");
    setFormEmbedId("");
    setFormLockedJson("{\n}\n");
    setFormSort("0");
    setFormActive(true);
    setFormGroup("");
    setFormIcon("");
    setDialogOpen(true);
  }

  function openEdit(row: StandardReportRow) {
    setEditing(row);
    setFormProvider((row.provider as Provider) || "link");
    setFormTitle(row.title);
    setFormDescription(row.description ?? "");
    setFormUrl(row.dashboard_url ?? "");
    setFormMetabaseSite(row.metabase_site_url ?? "");
    setFormEmbedType(
      row.embed_resource_type === "question" ? "question" : "dashboard"
    );
    setFormEmbedId(row.embed_resource_id != null ? String(row.embed_resource_id) : "");
    try {
      setFormLockedJson(JSON.stringify(row.locked_params ?? {}, null, 2));
    } catch {
      setFormLockedJson("{\n}\n");
    }
    setFormSort(String(row.sort_order));
    setFormActive(row.is_active);
    setFormGroup(row.report_group ?? "");
    setFormIcon(row.icon ?? "");
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    let locked: Record<string, unknown> = {};
    if (formProvider === "metabase" && formLockedJson.trim()) {
      try {
        locked = JSON.parse(formLockedJson) as Record<string, unknown>;
        if (typeof locked !== "object" || locked === null) throw new Error("locked_params must be a JSON object");
      } catch {
        setError("Locked params must be valid JSON object");
        setSaving(false);
        return;
      }
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const sortNum = Number.parseInt(formSort, 10);

      const base = {
        title: formTitle,
        description: formDescription || null,
        sort_order: Number.isFinite(sortNum) ? sortNum : 0,
        is_active: formActive,
        report_group: formGroup || null,
        icon: formIcon || null,
      };

      const payload =
        formProvider === "link"
          ? {
              ...base,
              provider: "link" as const,
              dashboard_url: formUrl.trim(),
              metabase_site_url: null,
              embed_resource_type: null,
              embed_resource_id: null,
              locked_params: {},
            }
          : {
              ...base,
              provider: "metabase" as const,
              dashboard_url: formUrl.trim() || null,
              metabase_site_url: formMetabaseSite.trim(),
              embed_resource_type: formEmbedType,
              embed_resource_id: Number.parseInt(formEmbedId, 10),
              locked_params: locked,
            };

      if (formProvider === "metabase" && !Number.isFinite(payload.embed_resource_id as number)) {
        setError("Resource id must be a number");
        setSaving(false);
        return;
      }

      const body =
        editing === null
          ? payload
          : {
              id: editing.id,
              ...payload,
            };

      const res = await fetch("/api/admin/standard-reports", {
        method: editing ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("admin.standardReports.confirmDelete", "Remove this report from the catalog?"))) return;
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/standard-reports?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (profile && !isSuperAdmin) {
    return null;
  }

  const canSave =
    formTitle.trim() &&
    (formProvider === "link"
      ? formUrl.trim()
      : formMetabaseSite.trim() && formEmbedId.trim() && Number.isFinite(Number.parseInt(formEmbedId, 10)));

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-7 w-7" aria-hidden />
              {t("admin.standardReports.title", "Standard reports")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              {t(
                "admin.standardReports.subtitle",
                "Curate Metabase embeds or external HTTPS links for each store’s Reports page. Set ALLOWED_STANDARD_REPORT_HOSTS on the server (comma-separated hostnames)."
              )}
            </p>
          </div>
          <Button type="button" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            {t("admin.standardReports.add", "Add report")}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.standardReports.catalog", "Catalog")}</CardTitle>
            <CardDescription>
              {t(
                "admin.standardReports.catalogHint",
                "Inactive reports are hidden from stores. Metabase reports require METABASE_EMBEDDING_SECRET in the app environment."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                {t("common.loading", "Loading…")}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("admin.standardReports.empty", "No standard reports yet.")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.standardReports.colTitle", "Title")}</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>{t("admin.standardReports.colGroup", "Group")}</TableHead>
                    <TableHead>{t("admin.standardReports.colSort", "Sort")}</TableHead>
                    <TableHead>{t("admin.standardReports.colActive", "Active")}</TableHead>
                    <TableHead className="text-right">{t("admin.standardReports.colActions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span>{r.title}</span>
                          {r.dashboard_url ? (
                            <a
                              href={r.dashboard_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 w-fit"
                            >
                              {t("admin.standardReports.openLink", "Open link")}
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : r.provider === "metabase" ? (
                            <span className="text-xs text-muted-foreground">
                              Metabase · {r.embed_resource_type} {r.embed_resource_id}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">{r.provider}</TableCell>
                      <TableCell className="text-muted-foreground">{r.report_group || "—"}</TableCell>
                      <TableCell className="tabular-nums">{r.sort_order}</TableCell>
                      <TableCell>{r.is_active ? "✓" : "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" type="button" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
                          {t("common.edit", "Edit")}
                        </Button>
                        <Button variant="ghost" size="sm" type="button" onClick={() => void remove(r.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" aria-hidden />
                          {t("common.delete", "Delete")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? t("admin.standardReports.editTitle", "Edit standard report")
                  : t("admin.standardReports.createTitle", "New standard report")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="sr-provider">Provider</Label>
                <select
                  id="sr-provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value as Provider)}
                >
                  <option value="metabase">Metabase (embedded)</option>
                  <option value="link">External HTTPS link</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sr-title">{t("admin.standardReports.fieldTitle", "Title")}</Label>
                <Input
                  id="sr-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t("admin.standardReports.titlePlaceholder", "Sales overview")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sr-desc">{t("admin.standardReports.fieldDescription", "Description")}</Label>
                <Input
                  id="sr-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t("admin.standardReports.descPlaceholder", "Optional")}
                />
              </div>

              {formProvider === "metabase" ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="sr-msite">Metabase site URL</Label>
                    <Input
                      id="sr-msite"
                      value={formMetabaseSite}
                      onChange={(e) => setFormMetabaseSite(e.target.value)}
                      placeholder="https://your-metabase.onrender.com"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sr-etype">Resource type</Label>
                      <select
                        id="sr-etype"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={formEmbedType}
                        onChange={(e) => setFormEmbedType(e.target.value as "dashboard" | "question")}
                      >
                        <option value="dashboard">dashboard</option>
                        <option value="question">question</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sr-eid">Resource id</Label>
                      <Input
                        id="sr-eid"
                        type="number"
                        value={formEmbedId}
                        onChange={(e) => setFormEmbedId(e.target.value)}
                        placeholder="e.g. 12"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sr-locked">Locked params (JSON, optional)</Label>
                    <Textarea
                      id="sr-locked"
                      value={formLockedJson}
                      onChange={(e) => setFormLockedJson(e.target.value)}
                      rows={5}
                      className="font-mono text-xs"
                      placeholder='{\n  "region": "US"\n}'
                    />
                    <p className="text-xs text-muted-foreground">
                      Store scope uses METABASE_STORE_PARAM_SLUG (default store_id) automatically.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sr-ref">Optional reference URL (open in Metabase UI)</Label>
                    <Input
                      id="sr-ref"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://…/dashboard/…"
                      className="font-mono text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="sr-url">{t("admin.standardReports.fieldUrl", "Dashboard URL")}</Label>
                  <Input
                    id="sr-url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://…"
                    className="font-mono text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sr-sort">{t("admin.standardReports.fieldSort", "Sort order")}</Label>
                  <Input
                    id="sr-sort"
                    type="number"
                    value={formSort}
                    onChange={(e) => setFormSort(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <Switch id="sr-active" checked={formActive} onCheckedChange={setFormActive} />
                  <Label htmlFor="sr-active">{t("admin.standardReports.fieldActive", "Active")}</Label>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sr-group">{t("admin.standardReports.fieldGroup", "Group label")}</Label>
                <Input
                  id="sr-group"
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  placeholder={t("admin.standardReports.groupPlaceholder", "Overview")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sr-icon">{t("admin.standardReports.fieldIcon", "Icon (optional)")}</Label>
                <Input
                  id="sr-icon"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder={t("admin.standardReports.iconPlaceholder", "Lucide name, e.g. LineChart")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving || !canSave}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("common.save", "Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
