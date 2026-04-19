import { useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/contexts/BrandingProvider";
import { Zap, ArrowRight } from "lucide-react";

const REDIRECT_SECONDS = 5;
const REDIRECT_TO = "/projects";

export default function NotFound() {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(REDIRECT_TO);
    }, REDIRECT_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <>
      <Head>
        <title>404 — Page not found</title>
        <meta name="description" content="Page not found" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <Link href="/projects" className="inline-flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandName} className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
            )}
            <span className="text-lg font-semibold">{brandName}</span>
          </Link>

          <div className="space-y-2">
            <h1 className="text-6xl font-bold tracking-tight">404</h1>
            <p className="text-lg font-medium text-foreground">Page not found</p>
            <p className="text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              Redirecting to Projects in {REDIRECT_SECONDS} seconds…
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button asChild>
              <Link href="/projects">
                Go to Projects
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}