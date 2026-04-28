import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Save, RotateCcw, Check, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Preset = "classic" | "modern";
const PRESET_IDS: Preset[] = ["classic", "modern"];

export default function ThemePage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("settings");
  const [preset, setPreset] = useState<Preset>("classic");
  const [initial, setInitial] = useState<Preset>("classic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("theme_preset").eq("id", "global").maybeSingle();
      const p = ((data?.theme_preset as string) === "modern" ? "modern" : "classic") as Preset;
      setPreset(p);
      setInitial(p);
      setLoading(false);
    })();
  }, []);

  const dirty = preset !== initial;

  async function save() {
    if (!isSuperAdmin) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({ theme_preset: preset }).eq("id", "global");
    setSaving(false);
    if (error) {
      toast({ title: t("theme.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    setInitial(preset);
    toast({ title: t("theme.saved"), description: t("theme.savedDescription", { preset }) });
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <SettingsLayout title={t("theme.title")}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">{t("theme.title")}</h1>
        </div>

        {!isSuperAdmin && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{t("theme.lockMessage")}</span>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{t("theme.presetTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("theme.presetSubtitle")}</p>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-40 rounded-lg bg-muted animate-pulse" />
                <div className="h-40 rounded-lg bg-muted animate-pulse" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRESET_IDS.map((id) => {
                  const selected = preset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!isSuperAdmin}
                      onClick={() => setPreset(id)}
                      className={cn(
                        "relative rounded-xl border-2 p-5 text-left transition-all",
                        selected ? "border-foreground ring-2 ring-foreground/10" : "border-border hover:border-foreground/40",
                        !isSuperAdmin && "cursor-not-allowed opacity-80"
                      )}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="h-20 rounded-md bg-muted/50 mb-3 flex items-center justify-center gap-2 p-3">
                        <div className={cn("h-10 w-16", id === "classic" ? "rounded-sm bg-foreground" : "rounded-xl bg-foreground/90")} />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2 w-3/4 rounded bg-foreground/20" />
                          <div className="h-2 w-1/2 rounded bg-foreground/15" />
                          <div className={cn("inline-block px-2 py-0.5 text-[9px] font-medium text-white", id === "classic" ? "rounded-sm bg-emerald-600" : "rounded-full bg-orange-500")}>
                            Button
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-sm">{t(`theme.presets.${id}.name`)}</div>
                      <div className="text-xs text-muted-foreground">{t(`theme.presets.${id}.tagline`)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setPreset(initial)} disabled={!dirty || saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("theme.reset")}
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t("theme.saving") : t("theme.save")}
            </Button>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});