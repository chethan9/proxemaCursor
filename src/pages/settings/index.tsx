import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Palette, Settings as SettingsIcon, ChevronRight } from "lucide-react";

export default function SettingsIndex() {
  const sections = [
    {
      href: "/settings/theme",
      icon: Palette,
      title: "Theme & Branding",
      description: "Customize logo, app name, and color palette",
    },
  ];

  return (
    <AppLayout title="Settings">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your workspace</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((s) => (
            <Link key={s.href} href={s.href}>
              <Card className="hover:border-primary/40 hover:shadow-polaris-md transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <s.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{s.title}</CardTitle>
                        <CardDescription className="text-sm mt-0.5">{s.description}</CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-2" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}