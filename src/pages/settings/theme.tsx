import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "light", label: "Light", icon: Sun, description: "Bright and clear" },
  { id: "dark", label: "Dark", icon: Moon, description: "Easy on the eyes" },
  { id: "system", label: "System", icon: Monitor, description: "Follow OS setting" },
] as const;

export default function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const current = mounted ? (theme || "system") : "system";

  return (
    <SettingsLayout title="Theme">
      <div className="p-6 max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-semibold flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Theme</h1>
          <p className="text-xs text-muted-foreground">Personal appearance preferences — only affects your account</p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="pb-2 border-b">
              <h2 className="text-sm font-semibold">Color Mode</h2>
              <p className="text-[11px] text-muted-foreground">Choose how the interface looks for you</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = current === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTheme(m.id)}
                    className={cn(
                      "relative text-left rounded-lg border-2 p-4 transition-all",
                      active ? "border-primary shadow-sm" : "border-border hover:border-primary/40"
                    )}
                  >
                    {active && (
                      <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    <Icon className="h-5 w-5 mb-2 text-foreground/70" />
                    <div className="font-medium text-sm">{m.label}</div>
                    <div className="text-[11px] text-muted-foreground">{m.description}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground mt-4">
          Looking for logo, app name, or brand colors? Those are white-label settings managed by administrators under <span className="font-medium">Branding</span>.
        </p>
      </div>
    </SettingsLayout>
  );
}