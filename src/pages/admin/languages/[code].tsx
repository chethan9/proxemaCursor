import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NAMESPACES, type Namespace, getLocaleMeta } from "@/lib/i18n";
import { Loader2, ArrowLeft, Search, Save, Check, AlertCircle, Download, Upload } from "lucide-react";

type Translation = { id: string; locale: string; namespace: string; key: string; value: string; needs_review: boolean; updated_at: string };

export default function EditTranslationsPage() {
  const router = useRouter();
  const code = String(router.query.code || "");
  const meta = getLocaleMeta(code);
  const { toast } = useToast();

  const [activeNs, setActiveNs] = useState<Namespace>("common");
  const [search, setSearch] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [source, setSource] = useState<Record<string, Record<string, string>>>({});
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token}` };
      const [srcRes, transRes] = await Promise.all([
        fetch(`/api/admin/translations/source?locale=en`, { headers }),
        fetch(`/api/admin/translations?locale=${code}`, { headers }),
      ]);
      const srcJson = await srcRes.json();
      const transJson = await transRes.json();
      if (!srcRes.ok) throw new Error(srcJson.error || "Failed to load source");
      if (!transRes.ok) throw new Error(transJson.error || "Failed to load translations");
      setSource(srcJson.source || {});
      const map: Record<string, Translation> = {};
      for (const t of transJson.translations || []) {
        map[`${t.namespace}::${t.key}`] = t;
      }
      setTranslations(map);
    } catch (e) {
      toast({ title: "Failed to load", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (code) void loadAll(); }, [code]);

  const sourceKeys = useMemo(() => source[activeNs] || {}, [source, activeNs]);
  const filteredKeys = useMemo(() => {
    let entries = Object.entries(sourceKeys);
    if (needsReviewOnly) {
      entries = entries.filter(([k]) => translations[`${activeNs}::${k}`]?.needs_review);
    }
    const q = search.trim().toLowerCase();
    if (q) entries = entries.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q));
    return entries;
  }, [sourceKeys, search, needsReviewOnly, translations, activeNs]);

  const needsReviewCount = useMemo(() => {
    let n = 0;
    for (const t of Object.values(translations)) if (t.needs_review) n++;
    return n;
  }, [translations]);

  const completeness = useMemo(() => {
    const result: Record<string, { translated: number; total: number }> = {};
    for (const ns of NAMESPACES) {
      const keys = Object.keys(source[ns] || {});
      const total = keys.length;
      const translated = keys.filter((k) => translations[`${ns}::${k}`]?.value).length;
      result[ns] = { translated, total };
    }
    return result;
  }, [source, translations]);

  const totalComplete = useMemo(() => {
    let t = 0, total = 0;
    for (const v of Object.values(completeness)) { t += v.translated; total += v.total; }
    return total > 0 ? Math.round((t / total) * 100) : 0;
  }, [completeness]);

  const saveTranslation = async (key: string, value: string, opts?: { needs_review?: boolean }) => {
    const composite = `${activeNs}::${key}`;
    setSavingKey(composite);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/translations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          locale: code,
          namespace: activeNs,
          key,
          value,
          needs_review: opts?.needs_review ?? translations[composite]?.needs_review ?? false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setTranslations((prev) => ({ ...prev, [composite]: json.translation }));
      setDrafts((prev) => { const next = { ...prev }; delete next[composite]; return next; });
      toast({ title: "Saved" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const toggleReviewed = async (key: string) => {
    const composite = `${activeNs}::${key}`;
    const t = translations[composite];
    if (!t) return;
    await saveTranslation(key, t.value, { needs_review: !t.needs_review });
  };

  const handleExport = async () => {
    setBusy("export");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/translations/export?locale=${code}&namespace=${activeNs}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "Export failed");
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${code}-${activeNs}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `${code}-${activeNs}.json downloaded` });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy("import");
    try {
      const text = await file.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON");
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/translations/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ locale: code, namespace: activeNs, json: parsed }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Import failed");
      toast({ title: "Imported", description: `${out.count} keys upserted into ${activeNs}` });
      await loadAll();
    } catch (e) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/languages"><ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />Back</Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              {meta.name}
              <Badge variant="outline" className="font-mono text-xs">{code}</Badge>
              <span className="text-sm text-muted-foreground" dir={meta.dir}>{meta.nativeName}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalComplete}% translated overall
              {needsReviewCount > 0 && <> · <span className="text-warning">{needsReviewCount} needs review</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={handleExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export {activeNs}.json</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="text-xs">Import {activeNs}.json</span>
            </Button>
          </div>
        </div>

        <Tabs value={activeNs} onValueChange={(v) => setActiveNs(v as Namespace)}>
          <TabsList className="flex-wrap h-auto">
            {NAMESPACES.map((ns) => {
              const c = completeness[ns];
              const pct = c?.total ? Math.round((c.translated / c.total) * 100) : 0;
              return (
                <TabsTrigger key={ns} value={ns} className="gap-2">
                  <span>{ns}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search keys or English text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Button
            variant={needsReviewOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setNeedsReviewOnly((v) => !v)}
            className="gap-1.5"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs">Needs review only</span>
            {needsReviewCount > 0 && (
              <Badge variant={needsReviewOnly ? "secondary" : "outline"} className="ms-1 text-[10px] h-5">
                {needsReviewCount}
              </Badge>
            )}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filteredKeys.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No keys in this namespace</div>
            ) : (
              <div className="divide-y divide-border">
                {filteredKeys.map(([key, srcValue]) => {
                  const composite = `${activeNs}::${key}`;
                  const existing = translations[composite];
                  const draft = drafts[composite];
                  const currentValue = draft !== undefined ? draft : (existing?.value ?? "");
                  const isDirty = draft !== undefined && draft !== (existing?.value ?? "");
                  const isMissing = !existing?.value;
                  const isReviewed = existing && !existing.needs_review;
                  return (
                    <div key={key} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 hover:bg-muted/20">
                      <div className="space-y-1">
                        <div className="font-mono text-[11px] text-muted-foreground break-all">{key}</div>
                        <div className="text-sm whitespace-pre-wrap">{srcValue}</div>
                      </div>
                      <div className="space-y-2">
                        <Textarea
                          value={currentValue}
                          dir={meta.dir}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [composite]: e.target.value }))}
                          placeholder={isMissing ? "Not translated" : ""}
                          className="min-h-[60px] text-sm"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            disabled={!isDirty || savingKey === composite}
                            onClick={() => saveTranslation(key, currentValue)}
                            className="h-7 gap-1.5"
                          >
                            {savingKey === composite ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            <span className="text-xs">Save</span>
                          </Button>
                          {existing && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleReviewed(key)}
                              disabled={savingKey === composite}
                              className="h-7 gap-1.5"
                            >
                              {isReviewed ? (
                                <><Check className="h-3 w-3 text-success" /><span className="text-xs">Reviewed</span></>
                              ) : (
                                <><AlertCircle className="h-3 w-3 text-warning" /><span className="text-xs">Mark reviewed</span></>
                              )}
                            </Button>
                          )}
                          {isMissing && <Badge variant="outline" className="text-[10px] text-muted-foreground">Missing</Badge>}
                          {existing?.needs_review && <Badge variant="outline" className="text-[10px] text-warning border-warning">Needs review</Badge>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale || "en", ["common", "admin"])) },
});