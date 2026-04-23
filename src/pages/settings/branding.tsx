import { useState, useEffect, useRef } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding, type ThemePreset } from "@/contexts/BrandingProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RotateCcw, Sparkles, Upload, Loader2, Check, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface AuditEntry {
  id: string;
  changed_at: string;
  changed_by_email: string | null;
  previous_brand_name: string | null;
  new_brand_name: string | null;
  previous_logo_url: string | null;
  new_logo_url: string | null;
  previous_theme_preset: string | null;
  new_theme_preset: string | null;
}

function AuditLogSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["branding-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branding_audit_log" as never)
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as AuditEntry[];
    },
    staleTime: 30_000,
  });

  const diffRow = (label: string, before: string | null, after: string | null) => {
    if (before === after) return null;
    return (
      <div key={label} className="flex items-start gap-2 text-[11px]">
        <span className="text-muted-foreground font-medium min-w-[80px]">{label}:</span>
        <span className="text-muted-foreground line-through truncate max-w-[200px]">{before || "—"}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium text-foreground truncate max-w-[200px]">{after || "—"}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="pb-2 border-b flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Change History</h2>
          <span className="text-[11px] text-muted-foreground ml-auto">Last 20 changes</span>
        </div>
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Loading history…</div>
        ) : !data || data.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No changes recorded yet.</div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {data.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-foreground truncate">{entry.changed_by_email || "Unknown"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground" title={new Date(entry.changed_at).toLocaleString()}>
                    {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {diffRow("Brand", entry.previous_brand_name, entry.new_brand_name)}
                  {diffRow("Logo", entry.previous_logo_url, entry.new_logo_url)}
                  {diffRow("Preset", entry.previous_theme_preset, entry.new_theme_preset)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const THEME_PRESETS: { id: ThemePreset; name: string; description: string; preview: { bg: string; surface: string; accent: string; sidebar: string; sidebarFg: string; radius: string } }[] = [
  {
    id: "classic",
    name: "Classic Shopify",
    description: "Clean Polaris-style, sharp edges",
    preview: { bg: "#F6F6F7", surface: "#FFFFFF", accent: "#008060", sidebar: "#1A1D21", sidebarFg: "#FFFFFF", radius: "6px" },
  },
  {
    id: "modern",
    name: "Modern",
    description: "Soft surfaces, rounded corners",
    preview: { bg: "#F7F7F8", surface: "#FFFFFF", accent: "#FF6A00", sidebar: "#FFFFFF", sidebarFg: "#111827", radius: "12px" },
  },
];

export default function BrandingSettings() {
  const { brandName, logoUrl, themePreset, save, loading } = useBranding();
  const { toast } = useToast();

  const [form, setForm] = useState({ brandName: "", logoUrl: "", themePreset: "classic" as ThemePreset });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) setForm({ brandName, logoUrl: logoUrl || "", themePreset });
  }, [loading, brandName, logoUrl, themePreset]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ brandName: form.brandName.trim() || "Proxima", logoUrl: form.logoUrl.trim() || null, themePreset: form.themePreset });
      toast({ title: "Branding saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const resetDefaults = () => setForm({ brandName: "Proxima", logoUrl: "", themePreset: "classic" });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file", variant: "destructive" }); return; }
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Max 2MB", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { cacheControl: "3600", upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("branding").getPublicUrl(path);
      setForm((prev) => ({ ...prev, logoUrl: publicUrl }));
      toast({ title: "Uploaded", description: "Click Save to apply." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <SettingsLayout title="Branding" requireSuperAdmin>
      <div className="p-6 max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Branding</h1>
          <p className="text-xs text-muted-foreground">White-label identity applied globally to all users</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="p-4 space-y-3">
              <div className="pb-2 border-b">
                <h2 className="text-sm font-semibold">Style Preset</h2>
                <p className="text-[11px] text-muted-foreground">Controls colors, radius, shadows, typography</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {THEME_PRESETS.map((p) => {
                  const active = form.themePreset === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setForm({ ...form, themePreset: p.id })}
                      className={cn("relative text-left rounded-lg border-2 p-3 transition-all", active ? "border-primary shadow-sm" : "border-border hover:border-primary/40")}>
                      {active && (<div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center"><Check className="h-2.5 w-2.5 text-primary-foreground" /></div>)}
                      <div className="h-20 rounded-md mb-2 p-1.5 flex gap-1.5" style={{ background: p.preview.bg, borderRadius: p.preview.radius }}>
                        <div className="w-12 rounded p-1.5 space-y-1" style={{ background: p.preview.sidebar, borderRadius: p.preview.radius }}>
                          <div className="h-1 w-6 rounded-full" style={{ background: p.preview.sidebarFg, opacity: 0.6 }} />
                          <div className="h-1 w-4 rounded-full" style={{ background: p.preview.sidebarFg, opacity: 0.3 }} />
                          <div className="h-1 w-7 rounded-full" style={{ background: p.preview.sidebarFg, opacity: 0.3 }} />
                        </div>
                        <div className="flex-1 rounded p-1.5 space-y-1.5" style={{ background: p.preview.surface, borderRadius: p.preview.radius }}>
                          <div className="h-1.5 w-14 rounded-full bg-foreground/20" />
                          <div className="h-4 rounded flex items-center px-1.5" style={{ background: p.preview.bg, borderRadius: p.preview.radius }}>
                            <div className="h-1 w-8 rounded-full bg-foreground/15" />
                          </div>
                          <div className="h-3.5 w-12 rounded flex items-center justify-center text-[8px] text-white font-medium" style={{ background: p.preview.accent, borderRadius: p.preview.radius }}>Button</div>
                        </div>
                      </div>
                      <div className="font-medium text-xs">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{p.description}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="pb-2 border-b">
                <h2 className="text-sm font-semibold">Brand Identity</h2>
                <p className="text-[11px] text-muted-foreground">Sidebar app name & logo</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-name" className="text-xs">App Name</Label>
                <Input id="brand-name" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder="Proxima" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logo-url" className="text-xs">Logo URL</Label>
                <Input id="logo-url" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." className="h-9" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                  {uploading ? "Uploading..." : "Upload File"}
                </Button>
              </div>
              {form.logoUrl && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="Preview" className="h-8 w-8 rounded object-contain bg-white" />
                  <span className="text-[11px] text-muted-foreground">Logo preview</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={resetDefaults}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="mt-6">
          <AuditLogSection />
        </div>
      </div>
    </SettingsLayout>
  );
}