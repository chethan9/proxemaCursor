import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";

export default function BootstrapPage() {
  const router = useRouter();
  const { t } = useTranslation(["auth", "common"]);
  const { user, profile, refresh, loading: authLoading } = useAuth();
  const [canBootstrap, setCanBootstrap] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("can_bootstrap_super_admin");
      if (error) { setError(error.message); return; }
      setCanBootstrap(!!data);
    })();
  }, []);

  const handleBootstrap = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.rpc("bootstrap_super_admin");
    if (error) { setError(error.message); setSubmitting(false); return; }
    await refresh();
    setDone(true);
    setSubmitting(false);
    setTimeout(() => router.push("/"), 1500);
  };

  if (authLoading || canBootstrap === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canBootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Lock className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <CardTitle>{t("auth:bootstrap.alreadyTitle")}</CardTitle>
            <CardDescription>{t("auth:bootstrap.alreadyDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/auth/login" className="text-sm text-primary hover:underline">{t("auth:bootstrap.goToSignIn")}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>{t("auth:bootstrap.needAccountTitle")}</CardTitle>
            <CardDescription>{t("auth:bootstrap.needAccountDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-center">
            <Link href="/auth/signup" className="block"><Button className="w-full">{t("auth:bootstrap.createAccount")}</Button></Link>
            <Link href="/auth/login" className="block text-sm text-primary hover:underline">{t("auth:bootstrap.haveAccount")}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              {done ? <CheckCircle2 className="h-6 w-6 text-success" /> : <Shield className="h-6 w-6 text-primary" />}
            </div>
          </div>
          <CardTitle>{done ? t("auth:bootstrap.doneTitle") : t("auth:bootstrap.claimTitle")}</CardTitle>
          <CardDescription>
            {done ? t("auth:bootstrap.redirecting") : t("auth:bootstrap.claimDesc", { email: user.email })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {!done && (
            <Button onClick={handleBootstrap} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("auth:bootstrap.submit")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "auth"])),
  },
});
