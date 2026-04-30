import type { i18n as I18n } from "i18next";
import { getLocaleMeta, NAMESPACES, type LocaleCode } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

async function persistLocaleToProfile(code: LocaleCode, userId: string | null) {
  if (typeof document !== "undefined") {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }
  if (!userId) return;
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

/** Apply runtime locale: bundles, i18n, cookie, optional profile + audit. */
export async function applyLocaleChange(i18n: I18n, code: LocaleCode, userId: string | null): Promise<void> {
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
      } catch {
        /* ignore */
      }
    })
  );
  await i18n.changeLanguage(code);
  await persistLocaleToProfile(code, userId);
}
