import { useState, useEffect, useRef, FormEvent } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User as UserIcon, Globe, Camera, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Image from "next/image";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "BH", name: "Bahrain", currency: "BHD" },
  { code: "OM", name: "Oman", currency: "OMR" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "JO", name: "Jordan", currency: "JOD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "SG", name: "Singapore", currency: "SGD" },
];

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [country, setCountry] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [initial, setInitial] = useState({ fullName: "", avatarUrl: "", country: "", currency: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const name = (profile?.full_name as string) || "";
    const avatar = (profile?.avatar_url as string) || "";
    const c = (profile?.country_code as string) || "";
    const cur = (profile?.billing_currency as string) || "";
    setFullName(name);
    setAvatarUrl(avatar || null);
    setCountry(c);
    setCurrency(cur);
    setInitial({ fullName: name, avatarUrl: avatar, country: c, currency: cur });
  }, [profile]);

  const profileDirty = fullName !== initial.fullName || (avatarUrl || "") !== initial.avatarUrl;
  const regionDirty = country !== initial.country || currency !== initial.currency;
  const currencyChanging = regionDirty && initial.currency && currency && currency !== initial.currency;

  async function uploadAvatar(file: File) {
    if (!user?.id) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `avatars/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("public-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, avatar_url: avatarUrl }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setInitial((p) => ({ ...p, fullName, avatarUrl: avatarUrl || "" }));
    toast({ title: "Profile saved" });
  }

  async function doSaveRegion() {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ country_code: country || null, billing_currency: currency || null }).eq("id", user.id);
    setSaving(false);
    setConfirmOpen(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setInitial((p) => ({ ...p, country, currency }));
    toast({ title: "Region saved" });
  }

  function onCountryChange(code: string) {
    setCountry(code);
    const c = COUNTRIES.find((x) => x.code === code);
    if (c) setCurrency(c.currency);
  }

  const initials = (fullName || user?.email || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <SettingsLayout title="My Profile">
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">My Profile</h1>
        </div>

        <Card>
          <CardContent className="pt-5 pb-5">
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={cn("h-16 w-16 rounded-full overflow-hidden border bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground")}>
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="Avatar" width={64} height={64} className="object-cover h-full w-full" unoptimized />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center border-2 border-background shadow hover:scale-105 transition disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{fullName || user?.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input id="email" value={user?.email || ""} disabled className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fullname" className="text-xs">Full name</Label>
                  <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9" />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" disabled={!profileDirty || saving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Region & Currency
            </CardTitle>
            <p className="text-xs text-muted-foreground">Controls billing currency and payment gateway routing.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Select value={country} onValueChange={onCountryChange}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Billing currency</Label>
                <Input value={currency} readOnly placeholder="USD" className="h-9 bg-muted/40" />
                <p className="text-[11px] text-muted-foreground">Auto-derived from country.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!regionDirty || saving}
                onClick={() => (currencyChanging ? setConfirmOpen(true) : doSaveRegion())}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save region
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change billing currency?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching from {initial.currency} to {currency} may change your subscription pricing and payment gateway. Existing active subscriptions keep their current currency until renewal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doSaveRegion}>Confirm change</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}