import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MENU_REGISTRY } from "@/lib/menu-registry";
import { User, Mail, Lock, Home } from "lucide-react";

export default function ProfileSettings() {
  const { user, profile, refresh, loading, can, isSuperAdmin } = useAuth();
  const { toast } = useToast();

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
  }).map((m) => ({ value: m.href, label: `${m.defaultLabel} (${m.href})` }));

  const handleSaveLanding = async () => {
    if (!user) return;
    setSavingLanding(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ default_landing_path: landingPath })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast({ title: "Default landing page saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSavingLanding(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim() || email === user.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
      toast({
        title: "Email change requested",
        description: "Check your new email address for a confirmation link.",
      });
    } catch (err) {
      toast({
        title: "Email update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated" });
    } catch (err) {
      toast({
        title: "Password update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <SettingsLayout title="Profile">
        <div className="p-8 text-sm text-muted-foreground">Loading...</div>
      </SettingsLayout>
    );
  }

  if (!user) {
    return (
      <SettingsLayout title="Profile">
        <div className="p-8 text-sm text-muted-foreground">Not signed in.</div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Profile">
      <div className="p-8 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your personal account information</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Personal Information</CardTitle>
            </div>
            <CardDescription>Update your display name. Role and client assignment are managed by admins.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <div className="text-sm font-medium px-3 py-2 rounded-md bg-muted">{profile?.role ?? "—"}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="text-sm font-medium px-3 py-2 rounded-md bg-muted">
                    {profile?.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile || fullName === (profile?.full_name ?? "")}>
                  {savingProfile ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Email Address</CardTitle>
            </div>
            <CardDescription>
              Changing your email will send a confirmation link to the new address. You must click it to complete the change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingEmail || !email.trim() || email === user.email}>
                  {savingEmail ? "Sending..." : "Update Email"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Change Password</CardTitle>
            </div>
            <CardDescription>Use a strong password with at least 6 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={savingPassword || !newPassword || !confirmPassword}
                >
                  {savingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Default Landing Page</CardTitle>
            </div>
            <CardDescription>Choose where you land after logging in.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="landing_page">Landing Page</Label>
                <Select onValueChange={(v) => setLandingPath(v)} value={landingPath}>
                  <SelectTrigger id="landing_page">
                    <SelectValue placeholder="Select a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {landingOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveLanding} disabled={savingLanding}>
                  {savingLanding ? "Saving..." : "Save Landing Page"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}