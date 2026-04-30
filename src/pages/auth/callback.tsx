import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthLanding } from "@/lib/post-auth-landing";
import { useBranding } from "@/contexts/BrandingProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, XCircle } from "lucide-react";

const REF_KEY = "pending_referral_code";
const COUNTRY_KEY = "pending_signup_country";
const REDIRECT_KEY = "pending_post_auth_redirect";

type CallbackState =
  | { kind: "loading" }
  | { kind: "error"; message: string };

/**
 * OAuth redirect target. supabase-js's `detectSessionInUrl` finishes the PKCE
 * exchange automatically; this page waits for the resulting session, applies
 * the pending referral / signup-country side effects we stashed before the
 * redirect, then routes via the same `resolvePostAuthLanding` used by the
 * email-password flow.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();
  const { t } = useTranslation("auth");
  const [state, setState] = useState<CallbackState>({ kind: "loading" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorDescription =
        params.get("error_description") ||
        hashParams.get("error_description") ||
        params.get("error") ||
        hashParams.get("error");
      if (errorDescription) {
        setState({ kind: "error", message: decodeURIComponent(errorDescription.replace(/\+/g, " ")) });
        return;
      }

      // detectSessionInUrl runs on supabase-js init; poll briefly so we don't race it.
      const start = Date.now();
      let user = null as null | { id: string };
      while (Date.now() - start < 8000) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          user = data.session.user;
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (cancelled) return;
      if (!user) {
        setState({ kind: "error", message: t("oauth.failed") });
        return;
      }

      // Apply pending side effects (best-effort; failures don't block sign-in).
      try {
        const country = window.localStorage.getItem(COUNTRY_KEY);
        if (country) {
          await supabase
            .from("profiles")
            .update({ country_code: country })
            .eq("id", user.id)
            .is("country_code", null);
          window.localStorage.removeItem(COUNTRY_KEY);
        }
      } catch { /* non-fatal */ }

      try {
        const code = window.localStorage.getItem(REF_KEY);
        if (code) {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch("/api/referrals/attribute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({ code }),
          });
          window.localStorage.removeItem(REF_KEY);
        }
      } catch { /* non-fatal */ }

      const stashedRedirect = window.localStorage.getItem(REDIRECT_KEY);
      if (stashedRedirect) window.localStorage.removeItem(REDIRECT_KEY);
      const queryRedirect =
        typeof router.query.redirect === "string" ? router.query.redirect : null;
      const redirect = queryRedirect || stashedRedirect || null;

      const dest = await resolvePostAuthLanding(user.id, { redirect });
      if (cancelled) return;
      router.replace(dest);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, t]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={brandName} className="h-10 w-auto object-contain opacity-90" />
        ) : null}
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t("oauth.signingIn")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <CardTitle>{t("oauth.errorTitle")}</CardTitle>
          <CardDescription>{t("oauth.errorDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/auth/login">{t("oauth.backToSignIn")}</Link>
          </Button>
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
