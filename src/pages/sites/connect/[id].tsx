import { useEffect } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// This page shows after WooCommerce OAuth approval
// User is redirected here from their WooCommerce store
export default function ConnectSuccessPage() {
  const router = useRouter();
  const { id, success } = router.query;

  useEffect(() => {
    // Auto-redirect to site workspace after 3 seconds
    if (success === "1" && id) {
      const timer = setTimeout(() => {
        router.push(`/sites/${id}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, id, router]);

  if (!id) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {success === "1" ? (
              <>
                <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Store Connected!</h1>
                <p className="text-muted-foreground mb-6">
                  Your WooCommerce store has been successfully connected. 
                  Credentials were received automatically.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Redirecting to site workspace...
                </p>
                <Link href={`/sites/${id}`}>
                  <Button>Go to Site Workspace</Button>
                </Link>
              </>
            ) : (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground mx-auto mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Connecting Store...</h1>
                <p className="text-muted-foreground">
                  Waiting for WooCommerce authorization...
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}