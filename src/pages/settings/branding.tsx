import { useState, useEffect, useRef } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBranding } from "@/contexts/BrandingProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, RotateCcw, Save, Image as ImageIcon, History } from "lucide-react";

interface ActivityEntry {
  id: string;
  created_at: string;
  actor_email: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export default function BrandingPage() {
  const { t } = useTranslation("settings");
  const { isSuperAdmin } = useAuth();
  const { brandName, logoUrl, save, loading } = useBranding();
  const [draftName, setDraftName] = useState(brandName);
  const [draftLogo, setDraftLogo] = useState<string | null>(logoUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setDraftName(brandName);
    setDraftLogo(logoUrl);
  }, [brandName, logoUrl, loading]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", "app_settings")
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((data as unknown as ActivityEntry[] | null) ?? []);
    })();
  }, [isSuperAdmin]);

  const dirty = draftName !== brandName || draftLogo !== logoUrl;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `branding/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("public-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
      setDraftLogo(data.publicUrl);
    } catch (err) {
      toast({ title: t("branding.uploadFailed"), description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({ brandName: draftName.trim() || brandName, logoUrl: draftLogo });
      toast({ title: t("branding.saved") });
    } catch (err) {
      toast({ title: t("branding.saveFailed"), description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraftName(brandName);
    setDraftLogo(logoUrl);
  }

  function fmt(v: unknown): string {
    if (v == null) return "—";
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  }

  function diffLines(entry: ActivityEntry): { key: string; before: string; after: string }[] {
    const before = entry.before || {};
    const after = entry.after || {};
    const map: Record<string, string> = {
      brand_name: t("branding.diff.appName"),
      logo_url: t("branding.diff.logo"),
      theme_preset: t("branding.diff.preset"),
    };
    const keys = Object.keys(map).filter((k) => fmt(before[k]) !== fmt(after[k]));
    return keys.map((k) => ({ key: map[k], before: fmt(before[k]), after: fmt(after[k]) }));
  }

  return (
    <SettingsLayout title={t("branding.title")} requireSuperAdmin>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("branding.title")}</h1>
          {!isSuperAdmin && <p className="text-sm text-muted-foreground mt-1">{t("branding.lockMessage")}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("branding.identityTitle")}</CardTitle>
            <CardDescription>{t("branding.identitySubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="appName">{t("branding.appName")}</Label>
              <Input id="appName" value={draftName} onChange={(e) => setDraftName(e.target.value)} disabled={!isSuperAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logoUrl">{t("branding.logoUrl")}</Label>
              <div className="flex gap-2">
                <Input id="logoUrl" value={draftLogo ?? ""} onChange={(e) => setDraftLogo(e.target.value || null)} placeholder="https://…" disabled={!isSuperAdmin} className="flex-1" />
                <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={!isSuperAdmin || uploading}>
                  <Upload className="h-4 w-4 mr-1.5" />
                  {uploading ? t("branding.uploading") : t("branding.uploadFile")}
                </Button>
              </div>
              {draftLogo && (
                <div className="mt-2 flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draftLogo} alt={t("branding.logoAlt")} className="h-10 w-10 rounded object-contain bg-background border" />
                  <span className="text-xs text-muted-foreground truncate flex-1">{draftLogo}</span>
                </div>
              )}
              {!draftLogo && (
                <div className="mt-2 flex items-center gap-2 p-3 rounded-md border border-dashed text-muted-foreground text-sm">
                  <ImageIcon className="h-4 w-4" />
                  <span>{t("branding.logoAlt")}</span>
                </div>
              )}
            </div>
            {isSuperAdmin && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={reset} disabled={!dirty || saving}>
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  {t("branding.reset")}
                </Button>
                <Button onClick={handleSave} disabled={!dirty || saving}>
                  <Save className="h-4 w-4 mr-1.5" />
                  {saving ? t("branding.saving") : t("branding.save")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("branding.history")}
            </CardTitle>
            <CardDescription>{t("branding.lastChanges", { count: history.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("branding.noChanges")}</p>
            ) : (
              <ul className="space-y-3">
                {history.map((entry) => {
                  const lines = diffLines(entry);
                  return (
                    <li key={entry.id} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium">{entry.actor_email || t("branding.system")}</span>
                        <span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      {lines.length === 0 ? (
                        <p className="text-xs text-muted-foreground">—</p>
                      ) : (
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {lines.map((l) => (
                            <li key={l.key}>
                              <span className="font-medium text-foreground">{l.key}:</span> <span className="line-through opacity-60">{l.before}</span> → <span>{l.after}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});