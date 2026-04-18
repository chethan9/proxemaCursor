import { useState, useEffect, useRef } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding, type ThemePreset } from "@/contexts/BrandingProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RotateCcw, Palette, Upload, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_PRESETS: { id: ThemePreset; name: string; description: string; preview: { bg: string; surface: string; accent: string; sidebar: string; sidebarFg: string; radius: string } }[] = [
  {
    id: "classic",
    name: "Classic Shopify",
    description: "Clean Polaris-style with sharp edges and minimal shadows",
    preview: { bg: "#F6F6F7", surface: "#FFFFFF", accent: "#008060", sidebar: "#1A1D21", sidebarFg: "#FFFFFF", radius: "6px" },
  },
  {
    id: "modern",
    name: "Modern",
    description: "Soft gray surfaces, elevated cards, orange accent, rounded corners",
    preview: { bg: "#F7F7F8", surface: "#FFFFFF", accent: "#FF6A00", sidebar: "#FFFFFF", sidebarFg: "#111827", radius: "12px" },
  },
];

export default function ThemeSettings() {
  const { brandName, logoUrl, themePreset, save, loading } = useBranding();
  const { toast } = useToast();

  const [form, setForm] = useState({
    brandName: "",
    logoUrl: "",
    themePreset: "classic" as ThemePreset,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      setForm({ brandName, logoUrl: logoUrl || "", themePreset });
    }
  }, [loading, brandName, logoUrl, themePreset]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        brandName: form.brandName.trim() || "WooSync",
        logoUrl: form.logoUrl.trim() || null,
        themePreset: form.themePreset,
      });
      toast({ title: "Theme saved", description: "Your theme has been updated." });
    } catch (err) {
      console.error(err);
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setForm({ brandName: "WooSync", logoUrl: "", themePreset: "classic" });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { cacheControl: "3600", upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("branding").getPublicUrl(path);
      setForm((prev) => ({ ...prev, logoUrl: publicUrl }));
      toast({ title: "Logo uploaded", description: "Click Save to apply." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <SettingsLayout title="Theme">
      <div className="p-8 space-y-8 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" /> Theme
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Choose your style preset</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Style Preset</CardTitle>
            <CardDescription>Each preset controls colors, radius, shadows, spacing, and typography.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {THEME_PRESETS.map((p) => {
                const active = form.themePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm({ ...form, themePreset: p.id })}
                    className={cn(
                      "relative text-left rounded-lg border-2 p-4 transition-all",
                      active ? "border-primary shadow-md" : "border-border hover:border-primary/40"
                    )}
                  >
                    {active && (
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="h-32 rounded-md mb-3 p-2 flex gap-2" style={{ background: p.preview.bg, borderRadius: p.preview.radius }}>
                      <div className="w-16 rounded p-2 space-y-1.5" style={{ background: p.preview.sidebar, borderRadius: p.preview.radius }}>
                        <div className="h-1.5 w-8 rounded-full" style={{ background: p.preview.sidebarFg, opacity: 0.6 }} />
                        <div className="h-1.5 w-6 rounded-full" style={{ background: p.preview.sidebarFg, opacity: 0.3 }} />
                        <div className="h-1.5 w-10 rounded-full" style={{ background: p.preview.sidebarFg, opacity: 0.3 }} />
                      </div>
                      <div className="flex-1 rounded p-2 space-y-2" style={{ background: p.preview.surface, borderRadius: p.preview.radius }}>
                        <div className="h-2 w-20 rounded-full bg-foreground/20" />
                        <div className="h-6 rounded flex items-center px-2" style={{ background: p.preview.bg, borderRadius: p.preview.radius }}>
                          <div className="h-1.5 w-12 rounded-full bg-foreground/15" />
                        </div>
                        <div className="h-5 w-16 rounded flex items-center justify-center text-[10px] text-white font-medium" style={{ background: p.preview.accent, borderRadius: p.preview.radius }}>
                          Button
                        </div>
                      </div>
                    </div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Identity</CardTitle>
            <CardDescription>App name and logo shown in the sidebar and browser tab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">App Name</Label>
              <Input id="brand-name" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder="WooSync" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo</Label>
              <div className="flex gap-2">
                <Input id="logo-url" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://example.com/logo.png" className="flex-1" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              {form.logoUrl && (
                <div className="mt-2 flex items-center gap-3 p-3 rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="Logo preview" className="h-10 w-10 rounded object-contain bg-white" />
                  <span className="text-sm text-muted-foreground">Preview</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between sticky bottom-4 bg-background/90 backdrop-blur rounded-lg border border-border p-3 shadow-lg">
          <Button variant="outline" onClick={resetDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}