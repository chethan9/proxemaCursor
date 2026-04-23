import { useState, useEffect } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Save, RotateCcw, Check, Lock } from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Preset = "classic" | "modern";

const PRESETS: { id: Preset; name: string; tagline: string }[] = [
  { id: "classic", name: "Classic Shopify", tagline: "Clean Polaris-style, sharp edges" },
  { id: "modern", name: "Modern", tagline: "Soft surfaces, rounded corners" },
];

export default function ThemePage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [preset, setPreset] = useState<Preset>("classic");
  const [initial, setInitial] = useState<Preset>("classic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("style_preset").eq("id", "global").maybeSingle();
      const p = (data?.style_preset as Preset) || "classic";
      setPreset(p);
      setInitial(p);
      setLoading(false);
    })();
  }, []);

  const dirty = preset !== initial;

  async function save() {
    if (!isSuperAdmin) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ id: "global", style_preset: preset });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setInitial(preset);
    toast({ title: "Theme saved", description: `Style preset: ${preset}` });
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <SettingsLayout title="Theme" description="Visual style preset applied across the app">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Theme</h1>
        </div>

        {!isSuperAdmin && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Only super admins can change the global style. You can preview presets below.</span>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Style Preset</h2>
              <p className="text-sm text-muted-foreground">Controls colors, radius, shadows, and typography globally.</p>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-40 rounded-lg bg-muted animate-pulse" />
                <div className="h-40 rounded-lg bg-muted animate-pulse" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRESETS.map((p) => {
                  const selected = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!isSuperAdmin}
                      onClick={() => setPreset(p.id)}
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
                        <div className={cn("h-10 w-16", p.id === "classic" ? "rounded-sm bg-foreground" : "rounded-xl bg-foreground/90")} />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2 w-3/4 rounded bg-foreground/20" />
                          <div className="h-2 w-1/2 rounded bg-foreground/15" />
                          <div className={cn("inline-block px-2 py-0.5 text-[9px] font-medium text-white", p.id === "classic" ? "rounded-sm bg-emerald-600" : "rounded-full bg-orange-500")}>
                            Button
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.tagline}</div>
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
              Reset
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}