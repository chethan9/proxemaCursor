import { useEffect, useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingProvider";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Languages, Edit3, Star } from "lucide-react";

type Locale = {
  code: string;
  name: string;
  native_name: string;
  dir: "ltr" | "rtl";
  enabled: boolean;
  is_default: boolean;
  updated_at: string;
  translation_count?: number;
  needs_review_count?: number;
};

export default function AdminLanguagesPage() {
  const { toast } = useToast();
  const { reload: reloadBranding } = useBranding();
  const [locales, setLocales] = useState<Locale[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/locales", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setLocales(json.locales || []);
    } catch (e) {
      toast({ title: "Failed to load", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateLocale = async (code: string, patch: Partial<Pick<Locale, "enabled" | "is_default">>) => {
    setSavingCode(code);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/locales/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      await load();
      await reloadBranding();
      toast({ title: "Updated" });
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Languages className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Languages</h1>
            <p className="text-sm text-muted-foreground">Manage available locales and translations</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Language</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direction</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Translations</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enabled</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Default</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locales.map((l) => (
                    <tr key={l.code} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs uppercase">{l.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground" dir={l.dir}>{l.native_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] uppercase">{l.dir}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{l.translation_count ?? 0} keys</Badge>
                          {(l.needs_review_count ?? 0) > 0 && (
                            <Badge variant="outline" className="text-[10px] text-warning border-warning">
                              {l.needs_review_count} need review
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Switch
                          checked={l.enabled}
                          disabled={savingCode === l.code || l.is_default}
                          onCheckedChange={(v) => updateLocale(l.code, { enabled: v })}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {l.is_default ? (
                          <Badge className="gap-1"><Star className="h-3 w-3" />Default</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={savingCode === l.code || !l.enabled}
                            onClick={() => updateLocale(l.code, { is_default: true })}
                            className="h-7 text-xs"
                          >
                            Set default
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm" className="h-7 gap-1.5">
                          <Link href={`/admin/languages/${l.code}`}>
                            <Edit3 className="h-3 w-3" />
                            <span className="text-xs">Edit translations</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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