import { ReactNode } from "react";
import { useBranding } from "@/contexts/BrandingProvider";
import { Lock } from "lucide-react";

export function ConnectLayout({ children }: { children: ReactNode }) {
  const { settings } = useBranding();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.brandName} className="h-7 w-7 rounded" />
            ) : (
              <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {settings.brandName.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-foreground">{settings.brandName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Setup in progress
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}