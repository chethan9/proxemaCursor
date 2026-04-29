import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_LOCALE_CODES, type LocaleCode } from "@/lib/i18n";
import { DEFAULT_BRAND_NAME } from "@/lib/brand-constants";

export type ThemePreset = "classic" | "modern";

export interface BrandingSettings {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  themePreset: ThemePreset;
  enabledLocales: LocaleCode[];
}

interface BrandingContextValue extends BrandingSettings {
  loading: boolean;
  save: (updates: Partial<BrandingSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

const DEFAULTS: BrandingSettings = {
  brandName: DEFAULT_BRAND_NAME,
  logoUrl: null,
  primaryColor: "#008060",
  sidebarColor: "#1a1a1a",
  accentColor: "#008060",
  themePreset: "modern",
  enabledLocales: [...ALL_LOCALE_CODES],
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function applyTheme(settings: BrandingSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  try { localStorage.setItem("woosync-theme-preset", settings.themePreset); } catch { /* ignore */ }
  if (settings.themePreset === "classic") {
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
  ["--primary","--primary-foreground","--ring","--sidebar","--sidebar-foreground","--sidebar-primary","--sidebar-accent","--background","--card","--muted","--border","--radius"].forEach((v) => root.style.removeProperty(v));
  root.dataset.themePreset = "modern";
}

function sanitizeLocales(input: unknown): LocaleCode[] {
  if (!Array.isArray(input)) return [...ALL_LOCALE_CODES];
  const filtered = input.filter((c): c is LocaleCode => (ALL_LOCALE_CODES as string[]).includes(c as string));
  if (filtered.length === 0) return ["en"]; // never allow empty — at minimum English
  if (!filtered.includes("en")) filtered.unshift("en");
  return filtered as LocaleCode[];
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandingSettings>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const cached = localStorage.getItem("woosync-theme-preset");
      if (cached === "modern" || cached === "classic") {
        return { ...DEFAULTS, themePreset: cached };
      }
    } catch { /* ignore */ }
    return DEFAULTS;
  });
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
        enabledLocales: sanitizeLocales((data as { enabled_locales?: unknown }).enabled_locales),
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
    if (updates.enabledLocales) next.enabledLocales = sanitizeLocales(updates.enabledLocales);
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
      enabled_locales: next.enabledLocales,
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