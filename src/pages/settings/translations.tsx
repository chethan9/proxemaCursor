import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileJson, Globe } from "lucide-react";

const NAMESPACES = ["common", "auth", "site", "pricing", "billing", "admin", "settings"];
const LOCALES = ["en", "ar", "es", "fr", "de", "pt", "hi", "zh", "ja", "ru"];
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ar: "العربية",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  hi: "हिन्दी",
  zh: "中文",
  ja: "日本語",
  ru: "Русский",
};

type KeyMap = Record<string, string[]>;

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function TranslationsContent() {
  const { t } = useTranslation("settings");
  const [enKeys, setEnKeys] = useState<KeyMap>({});
  const [localeKeys, setLocaleKeys] = useState<Record<string, KeyMap>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enResult: KeyMap = {};
      const allLocales: Record<string, KeyMap> = {};
      for (const loc of LOCALES) {
        allLocales[loc] = {};
        for (const ns of NAMESPACES) {
          try {
            const res = await fetch(`/locales/${loc}/${ns}.json`, { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            allLocales[loc][ns] = flattenKeys(json);
            if (loc === "en") enResult[ns] = allLocales[loc][ns];
          } catch {
            // skip missing
          }
        }
      }
      if (!cancelled) {
        setEnKeys(enResult);
        setLocaleKeys(allLocales);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleDownload(ns: string) {
    const res = await fetch(`/locales/en/${ns}.json`, { cache: "no-store" });
    const text = await res.text();
    downloadJson(`${ns}.en.json`, text);
  }

  async function handleDownloadAll() {
    const bundle: Record<string, unknown> = {};
    for (const ns of NAMESPACES) {
      try {
        const res = await fetch(`/locales/en/${ns}.json`, { cache: "no-store" });
        if (res.ok) bundle[ns] = await res.json();
      } catch { /* skip */ }
    }
    downloadJson("translations.en.json", JSON.stringify(bundle, null, 2));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("translations.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("translations.subtitle", { locale: "{locale}" })}</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{t("translations.howToTitle")}</div>
          <p className="text-sm leading-relaxed">{t("translations.howToBody")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{t("translations.namespacesTitle")}</div>
            <Button size="sm" variant="outline" onClick={handleDownloadAll}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("translations.downloadAll")}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {NAMESPACES.map((ns) => {
              const count = enKeys[ns]?.length ?? 0;
              return (
                <div key={ns} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{ns}.json</span>
                    <Badge variant="secondary" className="text-[10px]">{t("translations.keysCount", { count })}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(ns)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {t("translations.downloadEn")}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">{t("translations.localesTitle")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("translations.localesSubtitle")}</p>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">{t("translations.loading")}</div>
          ) : (
            <div className="space-y-2">
              {LOCALES.filter((l) => l !== "en").map((loc) => {
                const totals = NAMESPACES.reduce(
                  (acc, ns) => {
                    const en = new Set(enKeys[ns] ?? []);
                    const cur = new Set(localeKeys[loc]?.[ns] ?? []);
                    let missing = 0;
                    let extra = 0;
                    for (const k of en) if (!cur.has(k)) missing++;
                    for (const k of cur) if (!en.has(k)) extra++;
                    acc.total += en.size;
                    acc.matched += en.size - missing;
                    acc.missing += missing;
                    acc.extra += extra;
                    return acc;
                  },
                  { total: 0, matched: 0, missing: 0, extra: 0 }
                );
                const pct = totals.total === 0 ? 0 : Math.round((totals.matched / totals.total) * 100);
                return (
                  <div key={loc} className="flex items-center gap-3 border rounded-md p-3">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="w-24 shrink-0">
                      <div className="text-sm font-medium">{LOCALE_LABELS[loc]}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{loc}</div>
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs tabular-nums w-12 text-right">{pct}%</div>
                    <div className="flex gap-1 shrink-0">
                      {totals.missing > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {t("translations.missing", { count: totals.missing })}
                        </Badge>
                      )}
                      {totals.extra > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("translations.extra", { count: totals.extra })}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TranslationsPage() {
  return (
    <AuthGuard requireSuperAdmin>
      <AppLayout>
        <SettingsLayout>
          <TranslationsContent />
        </SettingsLayout>
      </AppLayout>
    </AuthGuard>
  );
}

export const getStaticProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});