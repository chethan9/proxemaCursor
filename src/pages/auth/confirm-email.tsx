import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from "lucide-react";
import { useBranding } from "@/contexts/BrandingProvider";

type Status = "loading" | "success" | "error";
type Flow = "signup" | "email_change" | "unknown";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [status, setStatus] = useState<Status>("loading");
  const [flow, setFlow] = useState<Flow>("unknown");
  const [email, setEmail] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";

    if (hash.includes("error") || search.includes("error")) {
      const params = new URLSearchParams(hash.replace(/^#/, "") || search.replace(/^\?/, ""));
      const desc = params.get("error_description") || params.get("error") || "The confirmation link is invalid or has expired.";
      setErrorMessage(decodeURIComponent(desc.replace(/\+/g, " ")));
      setStatus("error");
      return;
    }

    const detectedType = new URLSearchParams(hash.replace(/^#/, "")).get("type")
      || new URLSearchParams(search.replace(/^\?/, "")).get("type")
      || "";

    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      setEmail(user?.email || "");

      const isEmailChange = detectedType === "email_change" || detectedType === "email"
        || (user?.email_change === null && !!user?.email);

      if (user && (isEmailChange || detectedType === "")) {
        setFlow(isEmailChange ? "email_change" : "signup");
        setStatus("success");
        return;
      }

      if (!user) {
        setFlow("signup");
        setStatus("success");
      } else {
        setFlow("signup");
        setStatus("success");
      }
    })();
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      const dest = flow === "email_change" ? "/settings/profile" : "/auth/login";
      router.replace(dest);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, flow, router]);

  const destLabel = flow === "email_change" ? "Profile settings" : "Sign in";
  const destHref = flow === "email_change" ? "/settings/profile" : "/auth/login";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center transition-colors ${
              status === "success" ? "bg-success/10" : status === "error" ? "bg-destructive/10" : "bg-primary/10"
            }`}>
              {status === "loading" && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
              {status === "success" && <CheckCircle2 className="h-8 w-8 text-success" />}
              {status === "error" && <XCircle className="h-8 w-8 text-destructive" />}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {status === "loading" && "Confirming your email..."}
            {status === "success" && (flow === "email_change" ? "Email updated" : "Email confirmed")}
            {status === "error" && "Confirmation failed"}
          </CardTitle>
          <CardDescription className="mt-2">
            {status === "loading" && "Hang tight, this only takes a moment."}
            {status === "success" && flow === "email_change" && (
              <>Your email address has been successfully changed{email ? ` to ` : "."}{email && <span className="font-medium text-foreground">{email}</span>}{email && "."}</>
            )}
            {status === "success" && flow !== "email_change" && "Your email address has been verified. You can now sign in to your account."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "success" && (
            <>
              <div className="rounded-lg bg-muted/50 border border-border/60 px-4 py-3 flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="text-sm text-muted-foreground flex-1">
                  Redirecting to {destLabel.toLowerCase()} in <span className="font-medium text-foreground">{countdown}s</span>
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href={destHref}>
                  Go to {destLabel} now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/auth/login">Back to sign in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/forgot-password">Request a new link</Link>
              </Button>
            </div>
          )}

          {status === "loading" && (
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full w-1/3 bg-primary animate-pulse rounded-full" />
            </div>
          )}

          {branding?.appName && (
            <p className="text-center text-[11px] text-muted-foreground pt-2">
              {branding.appName}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}