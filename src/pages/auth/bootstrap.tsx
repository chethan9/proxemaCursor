import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";

export default function BootstrapPage() {
  const router = useRouter();
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
            <CardTitle>Already provisioned</CardTitle>
            <CardDescription>A super admin has already been created. This page is permanently disabled.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/auth/login" className="text-sm text-primary hover:underline">Go to sign in</Link>
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
            <CardTitle>Bootstrap super admin</CardTitle>
            <CardDescription>Sign up or sign in first, then return here to claim super admin access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-center">
            <Link href="/auth/signup" className="block"><Button className="w-full">Create account</Button></Link>
            <Link href="/auth/login" className="block text-sm text-primary hover:underline">I already have an account</Link>
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
          <CardTitle>{done ? "You are now super admin" : "Claim super admin"}</CardTitle>
          <CardDescription>
            {done ? "Redirecting..." : `Grant super admin privileges to ${user.email}. This is a one-time action.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {!done && (
            <Button onClick={handleBootstrap} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Make me super admin
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}