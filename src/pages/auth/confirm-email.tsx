import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("error")) {
      setStatus("error");
      return;
    }
    setStatus("success");
    const t = setTimeout(() => router.push("/"), 2000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              {status === "loading" && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
              {status === "success" && <CheckCircle2 className="h-6 w-6 text-success" />}
              {status === "error" && <XCircle className="h-6 w-6 text-destructive" />}
            </div>
          </div>
          <CardTitle>
            {status === "loading" && "Confirming..."}
            {status === "success" && "Email confirmed"}
            {status === "error" && "Confirmation failed"}
          </CardTitle>
          <CardDescription>
            {status === "success" && "Redirecting to dashboard..."}
            {status === "error" && "The link is invalid or expired."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/login" className="text-sm text-primary hover:underline">Go to sign in</Link>
        </CardContent>
      </Card>
    </div>
  );
}