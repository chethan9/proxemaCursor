import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

async function resolveLandingPath(userId: string): Promise<string> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("default_landing_path")
    .eq("id", userId)
    .maybeSingle();
  const pref = prof?.default_landing_path?.trim();
  if (!pref) return "/projects";
  const siteMatch = pref.match(/^\/sites\/([^/?#]+)/);
  if (siteMatch) {
    const siteId = siteMatch[1];
    const { data: site } = await supabase.from("stores").select("id").eq("id", siteId).maybeSingle();
    if (!site) {
      try { await supabase.from("profiles").update({ default_landing_path: null }).eq("id", userId); } catch {}
      return "/projects";
    }
  }
  return pref;
}

export default function LoginPage() {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      const redirect = typeof router.query.redirect === "string" ? router.query.redirect : null;
      if (redirect) {
        router.replace(redirect);
      } else {
        resolveLandingPath(user.id).then((dest) => router.replace(dest));
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={brandName} className="h-10 w-auto object-contain opacity-90" />
        ) : null}
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t("signIn.signingIn")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    localStorage.setItem("sb-remember-me", remember ? "true" : "false");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    const redirect = typeof router.query.redirect === "string" ? router.query.redirect : null;
    let dest = redirect;
    if (!dest && data.user) {
      dest = await resolveLandingPath(data.user.id);
    }
    router.replace(dest || "/projects");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2 min-h-[3rem] items-center">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-12 w-auto object-contain" />
            ) : null}
          </div>
          <CardTitle className="text-2xl">{t("signIn.title")}</CardTitle>
          <CardDescription>{t("signIn.description", { brand: brandName })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("signIn.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("signIn.password")}</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">{t("signIn.remember")}</Label>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("signIn.submit")}
            </Button>
            <div className="space-y-2 pt-1">
              <p className="text-center text-sm text-muted-foreground">
                {t("signIn.newHere")}{" "}
                <Link href="/auth/signup" className="text-primary hover:underline">{t("signIn.createAccount")}</Link>
              </p>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/auth/forgot-password" className="text-primary hover:underline">{t("signIn.forgot")}</Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  const { serverSideTranslations } = await import("next-i18next/serverSideTranslations");
  return {
    props: {
      ...(await serverSideTranslations(locale ?? "en", ["common", "auth"])),
    },
  };
}