import Link from "next/link";
import { useRouter } from "next/router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight, Sparkles, LucideIcon } from "lucide-react";

export function SitePagePlaceholder({
  title,
  description,
  icon: Icon,
  exploreLabel,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  exploreLabel?: string;
}) {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded">
            <Sparkles className="h-3 w-3" />
            Coming soon
          </div>
          <h2 className="text-lg font-medium">This page is being built</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A dedicated, polished {title.toLowerCase()} experience is on the way. For now, use the Data Explorer to view and manage this data.
          </p>
          {exploreLabel && id && (
            <div className="pt-2">
              <Link href={`/explore/${id}`}>
                <Button>
                  <Database className="h-4 w-4 mr-1.5" />
                  Open {exploreLabel} in Data Explorer
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SitePageShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SiteLayout>{children}</SiteLayout>
    </AuthGuard>
  );
}