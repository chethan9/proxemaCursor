import { useState, useEffect, useRef } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Save, RotateCcw, Upload, History, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

interface AuditRow {
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

export default function BrandingPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [initial, setInitial] = useState({ brandName: "", logoUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("brand_name,logo_url").eq("id", "global").maybeSingle();
      const name = (data?.brand_name as string) || "";
      const logo = (data?.logo_url as string) || "";
      setBrandName(name);
      setLogoUrl(logo);
      setInitial({ brandName: name, logoUrl: logo });

      const { data: logs } = await supabase
        .from("branding_audit_log")
        .select("id,changed_at,changed_by_email,previous_brand_name,new_brand_name,previous_logo_url,new_logo_url,previous_theme_preset,new_theme_preset")
        .order("changed_at", { ascending: false })
        .limit(20);
      setAudit((logs as unknown as AuditRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const dirty = brandName !== initial.brandName || logoUrl !== initial.logoUrl;

  async function save() {
    if (!isSuperAdmin) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({ brand_name: brandName, logo_url: logoUrl || null }).eq("id", "global");
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setInitial({ brandName, logoUrl });
    toast({ title: "Branding saved" });
    if (typeof window !== "undefined") window.location.reload();
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `branding/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("public-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
  }

  function renderDiff(r: AuditRow) {
    const rows: { label: string; before: string | null; after: string | null }[] = [];
    if (r.previous_brand_name !== r.new_brand_name) rows.push({ label: "App name", before: r.previous_brand_name, after: r.new_brand_name });
    if (r.previous_logo_url !== r.new_logo_url) rows.push({ label: "Logo", before: r.previous_logo_url, after: r.new_logo_url });
    if (r.previous_theme_preset !== r.new_theme_preset) rows.push({ label: "Preset", before: r.previous_theme_preset, after: r.new_theme_preset });
    if (rows.length === 0) return null;
    return (
      <div className="space-y-1 mt-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground min-w-[80px]">{row.label}:</span>
            <span className="line-through text-muted-foreground/70 truncate max-w-[30ch]">{row.before || "—"}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium truncate max-w-[30ch]">{row.after || "—"}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <SettingsLayout title="Branding">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        </div>

        {!isSuperAdmin && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Only super admins can change branding.</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Brand Identity</CardTitle>
            <p className="text-sm text-muted-foreground">Sidebar app name and logo.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="space-y-3">
                <div className="h-10 rounded-md bg-muted animate-pulse" />
                <div className="h-10 rounded-md bg-muted animate-pulse" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="app-name">App Name</Label>
                  <Input id="app-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} disabled={!isSuperAdmin} placeholder="Proxima" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input id="logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!isSuperAdmin} placeholder="https://…" />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!isSuperAdmin || uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Uploading…" : "Upload File"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLogo(f);
                      }}
                    />
                    {logoUrl && (
                      <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <Image src={logoUrl} alt="Logo" fill className="object-contain" unoptimized />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setBrandName(initial.brandName); setLogoUrl(initial.logoUrl); }} disabled={!dirty || saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Change History</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">Last {audit.length} changes</span>
            </div>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No changes recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {audit.map((r) => (
                  <div key={r.id} className="rounded-md border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.changed_by_email || "System"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.changed_at).toLocaleString()}</span>
                    </div>
                    {renderDiff(r)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}