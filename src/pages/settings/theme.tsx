import { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/contexts/BrandingProvider";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, RotateCcw, Palette } from "lucide-react";

const PRESETS = [
  { name: "Polaris Green", primary: "#008060", sidebar: "#1a1a1a" },
  { name: "Ocean Blue", primary: "#2563eb", sidebar: "#0f172a" },
  { name: "Royal Purple", primary: "#7c3aed", sidebar: "#1e1b2e" },
  { name: "Crimson", primary: "#dc2626", sidebar: "#1a0a0a" },
  { name: "Amber", primary: "#d97706", sidebar: "#1a1205" },
  { name: "Slate", primary: "#475569", sidebar: "#0f172a" },
];

export default function ThemeSettings() {
  const { brandName, logoUrl, primaryColor, sidebarColor, accentColor, save, loading } = useBranding();
  const { toast } = useToast();

  const [form, setForm] = useState({
    brandName: "",
    logoUrl: "",
    primaryColor: "#008060",
    sidebarColor: "#1a1a1a",
    accentColor: "#008060",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setForm({
        brandName,
        logoUrl: logoUrl || "",
        primaryColor,
        sidebarColor,
        accentColor,
      });
    }
  }, [loading, brandName, logoUrl, primaryColor, sidebarColor, accentColor]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        brandName: form.brandName.trim() || "WooSync",
        logoUrl: form.logoUrl.trim() || null,
        primaryColor: form.primaryColor,
        sidebarColor: form.sidebarColor,
        accentColor: form.accentColor,
      });
      toast({ title: "Theme saved", description: "Your branding has been updated." });
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
    });
  };

  const applyPreset = (p: typeof PRESETS[0]) => {
    setForm({ ...form, primaryColor: p.primary, sidebarColor: p.sidebar, accentColor: p.primary });
  };

  return (
    <AppLayout title="Theme & Branding">
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Palette className="h-6 w-6 text-primary" /> Theme & Branding
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Customize how the app looks for everyone on your team</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Brand Identity</CardTitle>
            <CardDescription>Your app name and logo shown in the sidebar and browser tab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">App Name</Label>
              <Input
                id="brand-name"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                placeholder="WooSync"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">Paste a public image URL (PNG/SVG). Leave empty for the default lightning icon.</p>
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
            <CardTitle>Color Palette</CardTitle>
            <CardDescription>Pick a preset or customize colors individually. Changes apply instantly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Presets</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
                  >
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
                  <Input
                    type="color"
                    id="primary-color"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value, accentColor: e.target.value })}
                    className="h-10 w-14 p-1 cursor-pointer"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Buttons, links, accents</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidebar-color">Sidebar</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="sidebar-color"
                    value={form.sidebarColor}
                    onChange={(e) => setForm({ ...form, sidebarColor: e.target.value })}
                    className="h-10 w-14 p-1 cursor-pointer"
                  />
                  <Input
                    value={form.sidebarColor}
                    onChange={(e) => setForm({ ...form, sidebarColor: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Navigation background</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Accent</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="accent-color"
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    className="h-10 w-14 p-1 cursor-pointer"
                  />
                  <Input
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Secondary highlights</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Live Preview</p>
              <div className="flex items-center gap-3">
                <Button style={{ background: form.primaryColor }}>Primary Button</Button>
                <Button variant="outline">Outline</Button>
                <span className="text-sm" style={{ color: form.primaryColor }}>Sample link text</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between sticky bottom-4 bg-background/80 backdrop-blur-sm rounded-lg border p-3 shadow-polaris-md">
          <Button variant="outline" onClick={resetDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}