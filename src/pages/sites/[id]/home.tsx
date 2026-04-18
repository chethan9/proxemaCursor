import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "./_shared";

function HomeInner() {
  const { store, loading } = useSiteFromRoute();
  if (loading) return <SiteLoadingSkeleton />;
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{store?.name || "Site"}</h1>
        <p className="text-sm text-muted-foreground">{store?.url || ""}</p>
      </div>
      <Card>
        <CardContent className="py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The site dashboard is under construction. Use the sidebar to browse Orders, Products, Categories, and Tags.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SiteHomePage() {
  return <SitePageShell><HomeInner /></SitePageShell>;
}