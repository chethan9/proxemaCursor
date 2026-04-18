import { Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SitePageShell } from "./_shared";

export default function SiteSettingsPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  return (
    <SitePageShell>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Site settings</h1>
            <p className="text-sm text-muted-foreground">Credentials, sync schedule and preferences</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm">Site-scoped settings are being rebuilt. Use the global Sites page for now.</p>
            <Link href={`/sites?focus=${id}`}><Button variant="outline" size="sm">Manage on Sites page</Button></Link>
          </CardContent>
        </Card>
      </div>
    </SitePageShell>
  );
}