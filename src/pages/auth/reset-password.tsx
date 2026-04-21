import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type Status = "checking" | "valid" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("error")) { setStatus("invalid"); return; }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("valid");
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) { setStatus("valid"); return; }
      setTimeout(async () => {
        const { data: d2 } = await supabase.auth.getSession();
        setStatus(d2.session ? "valid" : "invalid");
      }, 600);
    })();

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStatus("done");
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.push("/auth/login");
    }, 1500);
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <CardTitle>Invalid or expired link</CardTitle>
            <CardDescription>This reset link is no longer valid. Request a new one to continue.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <Link href="/auth/forgot-password" className="block"><Button className="w-full">Request new link</Button></Link>
            <Link href="/auth/login" className="text-sm text-primary hover:underline">Back to sign in</Link>
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
              {status === "done" ? <CheckCircle2 className="h-6 w-6 text-success" /> : null}
            </div>
          </div>
          <CardTitle>{status === "done" ? "Password updated" : "Set new password"}</CardTitle>
          <CardDescription>{status === "done" ? "Redirecting to sign in..." : "Enter your new password (min 8 characters)"}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "valid" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}