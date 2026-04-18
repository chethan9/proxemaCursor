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

const COLOR_PRESETS = [
  { name: "Polaris Green", primary: "#008060", sidebar: "#1a1a1a" },
  { name: "Ocean Blue", primary: "#2563eb", sidebar: "#0f172a" },
  { name: "Royal Purple", primary: "#7c3aed", sidebar: "#1e1b2e" },
  { name: "Crimson", primary: "#dc2626", sidebar: "#1a0a0a" },
  { name: "Amber", primary: "#d97706", sidebar: "#1a1205" },
  { name: "Slate", primary: "#475569", sidebar: "#0f172a" },
];

const THEME_PRESETS: { id: ThemePreset; name: string; description: string; preview: { bg: string; surface: string; accent: string; radius: string } }[] = [
  {
    id: "classic",
    name: "Classic Shopify",
    description: "Clean Polaris-style with sharp edges and minimal shadows",
    preview: { bg: "#FFFFFF", surface: "#F6F6F7", accent: "#008060", radius: "6px" },
  },
  {
    id: "modern",
    name: "Modern",
    description: "Soft gray surfaces, rounded corners, elevated cards",
    preview: { bg: "#F7F7F8", surface: "#FFFFFF", accent: "#FF6A00", radius: "12px" },
  },
];

export default function ThemeSettings() {
  const { brandName, logoUrl, primaryColor, sidebarColor, accentColor, themePreset, save, loading } = useBranding();
  const { toast } = useToast();

  const [form, setForm] = useState({
    brandName: "",
    logoUrl: "",
    primaryColor: "#008060",
    sidebarColor: "#1a1a1a",
    accentColor: "#008060",
    themePreset: "classic" as ThemePreset,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      setForm({
        brandName,
        logoUrl: logoUrl || "",
        primaryColor,
        sidebarColor,
        accentColor,
        themePreset,
      });
    }
  }, [loading, brandName, logoUrl, primaryColor, sidebarColor, accentColor, themePreset]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        brandName: form.brandName.trim() || "WooSync",
        logoUrl: form.logoUrl.trim() || null,
        primaryColor: form.primaryColor,
        sidebarColor: form.sidebarColor,
        accentColor: form.accentColor,
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
    setForm({
      brandName: "WooSync",
      logoUrl: "",
      primaryColor: "#008060",
      sidebarColor: "#1a1a1a",
      accentColor: "#008060",
      themePreset: "classic",
    });
  };

  const applyPreset = (p: typeof COLOR_PRESETS[0]) => {
    setForm({ ...form, primaryColor: p.primary, sidebarColor: p.sidebar, accentColor: p.primary });
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
          <p className="text-sm text-muted-foreground mt-1">Choose your style and customize your theme</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Style Preset</CardTitle>
            <CardDescription>Pick a base design language. Affects radius, shadows, spacing, and surface tones.</CardDescription>
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
                    <div
                      className="h-32 rounded-md mb-3 p-3 flex gap-2"
                      style={{ background: p.preview.bg, borderRadius: p.preview.radius }}
                    >
                      <div className="w-20 rounded space-y-1.5 p-2" style={{ background: p.preview.surface, borderRadius: p.preview.radius }}>
                        <div className="h-1.5 w-10 rounded-full bg-foreground/20" />
                        <div className="h-1.5 w-8 rounded-full bg-foreground/10" />
                        <div className="h-1.5 w-12 rounded-full bg-foreground/10" />
                      </div>
                      <div className="flex-1 rounded p-2 space-y-2" style={{ background: p.preview.surface, borderRadius: p.preview.radius }}>
                        <div className="h-2 w-16 rounded-full bg-foreground/20" />
                        <div className="h-8 rounded flex items-center px-2 gap-1.5" style={{ background: p.preview.bg, borderRadius: p.preview.radius }}>
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

        <Card>
          <CardHeader>
            <CardTitle>Accent Colors</CardTitle>
            <CardDescription>Pick a preset or customize individually</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Color Presets</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button key={p.name} onClick={() => applyPreset(p)} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors text-left">
                    <div className="flex gap-1">
                      <div className="h-8 w-4 rounded-l" style={{ background: p.primary }} />
                      <div className="h-8 w-4 rounded-r" style={{ background: p.sidebar }} />
                    </div>
                    <span className="text-sm font-medium">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Primary</Label>
                <div className="flex gap-2">
                  <Input type="color" id="primary-color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value, accentColor: e.target.value })} className="h-10 w-14 p-1 cursor-pointer" />
                  <Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidebar-color">Sidebar</Label>
                <div className="flex gap-2">
                  <Input type="color" id="sidebar-color" value={form.sidebarColor} onChange={(e) => setForm({ ...form, sidebarColor: e.target.value })} className="h-10 w-14 p-1 cursor-pointer" />
                  <Input value={form.sidebarColor} onChange={(e) => setForm({ ...form, sidebarColor: e.target.value })} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Accent</Label>
                <div className="flex gap-2">
                  <Input type="color" id="accent-color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-10 w-14 p-1 cursor-pointer" />
                  <Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="font-mono text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Live Preview</p>
              <div className="flex items-center gap-3">
                <Button style={{ background: form.primaryColor }}>Primary Button</Button>
                <Button variant="outline">Outline</Button>
                <span className="text-sm" style={{ color: form.primaryColor }}>Sample link</span>
              </div>
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