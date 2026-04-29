import { useTranslation } from "next-i18next";
import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALES, getLocaleMeta, NAMESPACES, type LocaleCode } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { useBranding } from "@/contexts/BrandingProvider";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

async function persistLocale(code: LocaleCode, userId: string | null) {
  if (typeof document !== "undefined") {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }
  if (userId) {
    try {
      await supabase.from("profiles").update({ locale: code }).eq("id", userId);
      await logActivity({
        action: "profile.locale_changed",
        entityType: "profile",
        entityId: userId,
        metadata: { locale: code },
      });
    } catch {
      /* non-fatal */
    }
  }
}

interface Props {
  variant?: "menu" | "select" | "compact";
  align?: "start" | "end";
}

export function LocaleSwitcher({ variant = "menu", align = "end" }: Props) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { enabledLocales } = useBranding();
  const [busy, setBusy] = useState(false);
  const current = (i18n.language || "en") as LocaleCode;
  const currentMeta = getLocaleMeta(current);
  const visibleLocales = LOCALES.filter((l) => enabledLocales.includes(l.code));

  if (visibleLocales.length <= 1) return null;

  async function handleSelect(code: LocaleCode) {
    if (code === current) return;
    const startedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    setBusy(true);
    try {
      if (typeof document !== "undefined") {
        document.documentElement.dir = getLocaleMeta(code).dir;
        document.documentElement.lang = code;
      }
      await Promise.all(
        NAMESPACES.map(async (ns) => {
          if (i18n.hasResourceBundle(code, ns)) return;
          try {
            const res = await fetch(`/locales/${code}/${ns}.json`);
            if (res.ok) {
              const data = await res.json();
              i18n.addResourceBundle(code, ns, data, true, true);
            }
          } catch { /* ignore */ }
        })
      );
      await i18n.changeLanguage(code);
      await persistLocale(code, user?.id || null);
    } finally {
      setBusy(false);
    }
  }

  if (variant === "select") {
    return (
      <Select value={current} onValueChange={(v) => handleSelect(v as LocaleCode)} disabled={busy}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {visibleLocales.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              <span className="flex items-center gap-2">
                <span>{l.nativeName}</span>
                <span className="text-xs text-muted-foreground">({l.name})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "compact" ? "ghost" : "outline"}
          size={variant === "compact" ? "sm" : "default"}
          className={cn("gap-2", variant === "compact" && "h-8 px-2")}
          disabled={busy}
        >
          <Globe className="h-4 w-4" />
          <span className={cn(variant === "compact" && "text-xs")}>{currentMeta.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        {visibleLocales.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => handleSelect(l.code)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span>{l.nativeName}</span>
              <span className="text-xs text-muted-foreground">({l.name})</span>
            </span>
            {l.code === current && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}