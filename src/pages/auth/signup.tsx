import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { resolvePostAuthLanding } from "@/lib/post-auth-landing";
import { getBrowserTimezoneCountry } from "@/lib/payments/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Loader2, Mail } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      resolvePostAuthLanding(user.id).then((dest) => router.replace(dest));
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = router.query.ref;
    const code = Array.isArray(ref) ? ref[0] : ref;
    if (typeof code === "string" && code.trim()) {
      window.localStorage.setItem("pending_referral_code", code.trim());
    }
  }, [router.query.ref]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("errors.passwordTooShort"));
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          signup_country: getBrowserTimezoneCountry(),
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm-email`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError(t("errors.emailExists"));
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>{t("signUp.checkEmailTitle")}</CardTitle>
            <CardDescription>{t("signUp.checkEmailDesc", { email })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth/login" className="block text-center text-sm text-primary hover:underline">
              {t("signUp.backToSignIn")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2 min-h-[3rem] items-center">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-12 w-auto object-contain" />
            ) : null}
          </div>
          <CardTitle className="text-2xl">{t("signUp.title")}</CardTitle>
          <CardDescription>{t("signUp.description", { brand: brandName })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleSignInButton mode="signup" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t("oauth.or")}</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("signUp.fullName")}</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("signUp.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("signUp.password")}</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
              <p className="text-xs text-muted-foreground">{t("signUp.passwordHint")}</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("signUp.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("signUp.haveAccount")}{" "}
              <Link href="/auth/login" className="text-primary hover:underline">{t("signUp.signInLink")}</Link>
            </p>
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