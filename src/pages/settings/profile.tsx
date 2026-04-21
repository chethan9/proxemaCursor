import { useState, useEffect, useMemo, FormEvent } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MENU_REGISTRY, SITE_MENU_REGISTRY } from "@/lib/menu-registry";
import { useStores } from "@/hooks/queries/useStores";
import { User, Mail, Lock, Home } from "lucide-react";

export default function ProfileSettings() {
  const { user, profile, refresh, loading, can, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const { data: stores = [] } = useStores();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [landingPath, setLandingPath] = useState<string>("/");
  const [savingLanding, setSavingLanding] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setLandingPath(profile.default_landing_path ?? "/");
    }
    if (user?.email) setEmail(user.email);
  }, [profile, user]);

  const landingOptions = MENU_REGISTRY.filter((m) => {
    if (m.superAdminOnly && !isSuperAdmin) return false;
    if (m.permission && !can(m.permission)) return false;
    return true;
  }).map((m) => ({ value: m.href, label: m.defaultLabel }));

  const siteLandingOptions = useMemo(() => {
    return stores.flatMap((s) =>
      SITE_MENU_REGISTRY.filter((m) => !m.permission || can(m.permission)).map((m) => ({
        value: `/sites/${s.id}${m.path}`,
        label: `${s.name} · ${m.defaultLabel}`,
      }))
    );
  }, [stores, can]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() || null, default_landing_path: landingPath }).eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast({ title: "Profile saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveLanding = async () => {
    if (!user) return;
    setSavingLanding(true);
    try {
      const { error } = await supabase.from("profiles").update({ default_landing_path: landingPath }).eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast({ title: "Landing page saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setSavingLanding(false);
    }
  };

  const handleSaveEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim() || email === user.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: `${window.location.origin}/auth/confirm-email` }
      );
      if (error) throw error;
      toast({ title: "Confirmation sent", description: "Check your new email to confirm the change." });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password updated" });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <SettingsLayout title="Profile"><div className="p-6 text-sm text-muted-foreground">Loading...</div></SettingsLayout>;
  if (!user) return <SettingsLayout title="Profile"><div className="p-6 text-sm text-muted-foreground">Not signed in.</div></SettingsLayout>;

  return (
    <SettingsLayout title="Profile">
      <div className="p-6 max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">My Profile</h1>
          <p className="text-xs text-muted-foreground">Personal account information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Personal Info + Landing */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <User className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-semibold">Personal Information</h2>
              </div>
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className="text-xs">Full Name</Label>
                  <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <div className="text-xs font-medium px-2.5 py-2 rounded-md bg-muted h-9 flex items-center capitalize">{profile?.role ?? "—"}</div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="text-xs font-medium px-2.5 py-2 rounded-md bg-muted h-9 flex items-center">{profile?.is_active ? "Active" : "Inactive"}</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="landing_page" className="text-xs flex items-center gap-1.5"><Home className="h-3 w-3" /> Default Landing Page</Label>
                  <Select onValueChange={(v) => setLandingPath(v)} value={landingPath}>
                    <SelectTrigger id="landing_page" className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wide">App</SelectLabel>
                        {landingOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                      </SelectGroup>
                      {siteLandingOptions.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-wide">Sites</SelectLabel>
                          {siteLandingOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={handleSaveLanding} disabled={savingLanding}>
                    {savingLanding ? "Saving..." : "Save Landing"}
                  </Button>
                  <Button type="submit" size="sm" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Email + Password */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Mail className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-semibold">Email Address</h2>
              </div>
              <form onSubmit={handleSaveEmail} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
                  <p className="text-[10px] text-muted-foreground">A confirmation link will be sent to the new address.</p>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={savingEmail || !email.trim() || email === user.email}>
                    {savingEmail ? "Sending..." : "Update Email"}
                  </Button>
                </div>
              </form>

              <div className="flex items-center gap-2 pt-3 pb-2 border-b border-t">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-semibold">Change Password</h2>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new_password" className="text-xs">New (min 8 chars)</Label>
                    <PasswordInput id="new_password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" className="h-9" minLength={8} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password" className="text-xs">Confirm</Label>
                    <PasswordInput id="confirm_password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" className="h-9" minLength={8} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={savingPassword || !newPassword || !confirmPassword}>
                    {savingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </SettingsLayout>
  );
}