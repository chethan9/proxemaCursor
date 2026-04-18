import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemePreset = "classic" | "modern";

export interface BrandingSettings {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  themePreset: ThemePreset;
}

interface BrandingContextValue extends BrandingSettings {
  loading: boolean;
  save: (updates: Partial<BrandingSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

const DEFAULTS: BrandingSettings = {
  brandName: "WooSync",
  logoUrl: null,
  primaryColor: "#008060",
  sidebarColor: "#1a1a1a",
  accentColor: "#008060",
  themePreset: "classic",
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function hexToHsl(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      case b: hue = (r - g) / d + 4; break;
    }
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTheme(settings: BrandingSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (settings.themePreset === "classic") {
    // FROZEN Classic baseline — do not modify. Any redesign must go through "modern" preset.
    root.style.setProperty("--primary", "166 100% 25%");
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--ring", "166 100% 25%");
    root.style.setProperty("--sidebar", "210 14% 18%");
    root.style.setProperty("--sidebar-foreground", "0 0% 98%");
    root.style.setProperty("--sidebar-primary", "166 100% 35%");
    root.style.setProperty("--sidebar-accent", "210 11% 24%");
    root.style.setProperty("--background", "220 14% 96%");
    root.style.setProperty("--card", "0 0% 100%");
    root.style.setProperty("--muted", "220 14% 96%");
    root.style.setProperty("--border", "220 13% 87%");
    root.style.setProperty("--radius", "0.5rem");
    root.dataset.themePreset = "classic";
    return;
  }

  // Modern preset — applies live brand color overrides + tags root for scoped CSS
  root.style.setProperty("--primary", hexToHsl(settings.primaryColor));
  root.style.setProperty("--sidebar-primary", hexToHsl(settings.primaryColor));
  root.style.setProperty("--ring", hexToHsl(settings.primaryColor));
  root.style.setProperty("--sidebar", hexToHsl(settings.sidebarColor));
  root.style.setProperty("--sidebar-accent", hexToHsl(settings.sidebarColor));
  root.style.setProperty("--background", "220 13% 97%");
  root.style.setProperty("--card", "0 0% 100%");
  root.style.setProperty("--muted", "220 14% 95%");
  root.style.setProperty("--border", "220 13% 91%");
  root.style.setProperty("--radius", "0.75rem");
  root.dataset.themePreset = "modern";
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
    if (data) {
      const next: BrandingSettings = {
        brandName: data.brand_name || DEFAULTS.brandName,
        logoUrl: data.logo_url || null,
        primaryColor: data.primary_color || DEFAULTS.primaryColor,
        sidebarColor: data.sidebar_color || DEFAULTS.sidebarColor,
        accentColor: data.accent_color || DEFAULTS.accentColor,
        themePreset: ((data as { theme_preset?: string }).theme_preset as ThemePreset) || DEFAULTS.themePreset,
      };
      setSettings(next);
      applyTheme(next);
    } else {
      applyTheme(DEFAULTS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updates: Partial<BrandingSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    applyTheme(next);
    await supabase.from("app_settings").upsert({
      id: "global",
      brand_name: next.brandName,
      logo_url: next.logoUrl,
      primary_color: next.primaryColor,
      sidebar_color: next.sidebarColor,
      accent_color: next.accentColor,
      theme_preset: next.themePreset,
      updated_at: new Date().toISOString(),
    });
  }, [settings]);

  return (
    <BrandingContext.Provider value={{ ...settings, loading, save, reload: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) return { ...DEFAULTS, loading: false, save: async () => {}, reload: async () => {} };
  return ctx;
}