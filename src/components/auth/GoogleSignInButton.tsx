"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { getBrowserTimezoneCountry } from "@/lib/payments/routing";

interface Props {
  /**
   * Used only to relabel the button ("Sign in with Google" vs "Sign up with Google").
   * The OAuth flow itself is identical; Supabase decides whether the user is new.
   */
  mode?: "signin" | "signup";
  className?: string;
}

/**
 * Single-tap Google OAuth button. Uses Supabase's PKCE flow and routes back
 * through `/auth/callback`, which finishes the handshake and lands the user
 * on the right page (pricing, onboarding, projects, …).
 *
 * Pre-redirect side effects (kept minimal because we leave the SPA):
 *   - Persists `?ref=<code>` so the callback can attribute the referral.
 *   - Persists the browser-timezone country so post-signup defaults match
 *     what the email signup form would have set via `options.data`.
 */
export function GoogleSignInButton({ mode = "signin", className }: Props) {
  const router = useRouter();
  const { t } = useTranslation("auth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      if (typeof window !== "undefined") {
        const ref = router.query.ref;
        const code = Array.isArray(ref) ? ref[0] : ref;
        if (typeof code === "string" && code.trim()) {
          window.localStorage.setItem("pending_referral_code", code.trim());
        }
        const country = getBrowserTimezoneCountry();
        if (country) window.localStorage.setItem("pending_signup_country", country);

        const redirect = typeof router.query.redirect === "string" ? router.query.redirect : null;
        if (redirect) window.localStorage.setItem("pending_post_auth_redirect", redirect);
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("oauth.failed"));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={loading}
        className={className ?? "w-full"}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo className="h-4 w-4" />}
        <span>{mode === "signup" ? t("oauth.signupWithGoogle") : t("oauth.continueWithGoogle")}</span>
      </Button>
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 7.7-11.3 7.7-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2.1 1.5-4.7 2.4-7.3 2.4-5.4 0-9.6-3.2-11.3-7.7l-6.5 5C9.6 39.7 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.5 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
