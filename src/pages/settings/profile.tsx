import { useState, useEffect, FormEvent } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getDefaultCurrencyForCountry } from "@/lib/payments/routing";
import { Loader2, Globe } from "lucide-react";

const COUNTRIES: { code: string; name: string; currency: string; region: string }[] = [
  { code: "KW", name: "Kuwait", currency: "KWD", region: "Middle East" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", region: "Middle East" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", region: "Middle East" },
  { code: "BH", name: "Bahrain", currency: "BHD", region: "Middle East" },
  { code: "OM", name: "Oman", currency: "OMR", region: "Middle East" },
  { code: "QA", name: "Qatar", currency: "QAR", region: "Middle East" },
  { code: "JO", name: "Jordan", currency: "JOD", region: "Middle East" },
  { code: "IN", name: "India", currency: "INR", region: "Asia Pacific" },
  { code: "SG", name: "Singapore", currency: "SGD", region: "Asia Pacific" },
  { code: "MY", name: "Malaysia", currency: "MYR", region: "Asia Pacific" },
  { code: "TH", name: "Thailand", currency: "THB", region: "Asia Pacific" },
  { code: "ID", name: "Indonesia", currency: "IDR", region: "Asia Pacific" },
  { code: "PH", name: "Philippines", currency: "PHP", region: "Asia Pacific" },
  { code: "JP", name: "Japan", currency: "JPY", region: "Asia Pacific" },
  { code: "AU", name: "Australia", currency: "AUD", region: "Asia Pacific" },
  { code: "NZ", name: "New Zealand", currency: "NZD", region: "Asia Pacific" },
  { code: "GB", name: "United Kingdom", currency: "GBP", region: "Europe" },
  { code: "DE", name: "Germany", currency: "EUR", region: "Europe" },
  { code: "FR", name: "France", currency: "EUR", region: "Europe" },
  { code: "ES", name: "Spain", currency: "EUR", region: "Europe" },
  { code: "IT", name: "Italy", currency: "EUR", region: "Europe" },
  { code: "NL", name: "Netherlands", currency: "EUR", region: "Europe" },
  { code: "IE", name: "Ireland", currency: "EUR", region: "Europe" },
  { code: "CH", name: "Switzerland", currency: "CHF", region: "Europe" },
  { code: "SE", name: "Sweden", currency: "SEK", region: "Europe" },
  { code: "NO", name: "Norway", currency: "NOK", region: "Europe" },
  { code: "DK", name: "Denmark", currency: "DKK", region: "Europe" },
  { code: "PL", name: "Poland", currency: "PLN", region: "Europe" },
  { code: "US", name: "United States", currency: "USD", region: "Americas" },
  { code: "CA", name: "Canada", currency: "CAD", region: "Americas" },
  { code: "MX", name: "Mexico", currency: "MXN", region: "Americas" },
  { code: "BR", name: "Brazil", currency: "BRL", region: "Americas" },
  { code: "ZA", name: "South Africa", currency: "ZAR", region: "Africa" },
];

const REGIONS = ["Middle East", "Asia Pacific", "Europe", "Americas", "Africa"];

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [client, setClient] = useState<{ id: string; country: string | null; currency: string } | null>(null);
  const [country, setCountry] = useState("");
  const [savingRegion, setSavingRegion] = useState(false);
  const [subHasActive, setSubHasActive] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCountry, setPendingCountry] = useState("");

  useEffect(() => {
    if (!user) return;
    setFullName((user.user_metadata?.full_name as string) || "");
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof?.client_id) return;
      const { data: cl } = await supabase
        .from("clients")
        .select("id, country, currency")
        .eq("id", prof.client_id)
        .maybeSingle();
      if (cl) {
        setClient(cl);
        setCountry(cl.country || "");
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("client_id", prof.client_id)
        .in("status", ["active", "trialing", "past_due"])
        .maybeSingle();
      setSubHasActive(!!sub);
    }
    load();
  }, [user]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSavingProfile(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
  };

  const attemptSaveRegion = () => {
    if (!client || !country || country === (client.country || "")) return;
    const newCurrency = getDefaultCurrencyForCountry(country);
    if (subHasActive && newCurrency !== client.currency) {
      setPendingCountry(country);
      setConfirmOpen(true);
      return;
    }
    doSaveRegion(country);
  };

  const doSaveRegion = async (c: string) => {
    if (!client || !user) return;
    setSavingRegion(true);
    const newCurrency = getDefaultCurrencyForCountry(c);
    const before = { country: client.country, currency: client.currency };
    const after = { country: c, currency: newCurrency };
    const { error } = await supabase.from("clients").update({ country: c, currency: newCurrency }).eq("id", client.id);
    if (error) {
      setSavingRegion(false);
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("activity_log").insert({
      actor_user_id: user.id,
      actor_email: user.email || null,
      actor_type: "user",
      action: "client.region_changed",
      entity_type: "client",
      entity_id: client.id,
      client_id: client.id,
      diff: { before, after },
    });
    setClient({ ...client, country: c, currency: newCurrency });
    setSavingRegion(false);
    setConfirmOpen(false);
    toast({ title: "Region updated", description: `${c} · ${newCurrency}` });
  };

  const derivedCurrency = country ? getDefaultCurrencyForCountry(country) : client?.currency || "USD";
  const isDirty = !!client && country !== (client.country || "");

  return (
    <SettingsLayout>
      <div className="space-y-6 max-w-2xl">
        <form onSubmit={saveProfile}>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Region &amp; Currency
            </CardTitle>
            <CardDescription>
              Controls your billing currency and which payment gateway processes your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((region) => (
                    <SelectGroup key={region}>
                      <SelectLabel>{region}</SelectLabel>
                      {COUNTRIES.filter((c) => c.region === region).map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.currency})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing currency</Label>
              <Input value={derivedCurrency} disabled className="font-mono" />
              <p className="text-xs text-muted-foreground">Auto-derived from your country.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={attemptSaveRegion} disabled={savingRegion || !isDirty}>
                {savingRegion && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
              Your active subscription is billed in {client?.currency}. Changing your country to {pendingCountry} will switch your billing to{" "}
              {pendingCountry && getDefaultCurrencyForCountry(pendingCountry)} on your next renewal. The current period will not be re-billed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSaveRegion(pendingCountry)}>Confirm change</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}