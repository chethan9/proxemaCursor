import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StorePreferencesFields, type StorePrefsFormValues } from "./StorePreferencesFields";
import type { Store } from "@/services/storeService";
import { updateStore } from "@/services/storeService";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { useStores } from "@/hooks/queries/useStores";
import { useBranding } from "@/contexts/BrandingProvider";
import { applyLocaleChange } from "@/lib/apply-locale-change";
import type { LocaleCode } from "@/lib/i18n";
import { REGION_COUNTRIES } from "@/lib/region-countries";
import { getBrowserTimeZone } from "@/lib/store-preference-options";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { cn } from "@/lib/utils";

function buildInitialValues(
  store: Store,
  profile: { locale?: string | null } | null,
  lang: string
): StorePrefsFormValues {
  const meta = REGION_COUNTRIES.find((c) => c.code === (store.country_code || ""));
  return {
    timezone: store.timezone || getBrowserTimeZone(),
    currency: store.currency || meta?.currency || "USD",
    countryCode: store.country_code || "",
    storeType: store.store_type || "",
    acquisitionSource: store.acquisition_source || "",
    acquisitionDetail: store.acquisition_source_detail || "",
    locale: ((profile?.locale as LocaleCode) || (lang as LocaleCode) || "en") as LocaleCode,
  };
}

export function SitePreferencesOnboardingDialog({ store }: { store: Store | null }) {
  const { t, i18n } = useTranslation("site");
  const { user, profile, refresh: refreshAuth } = useAuth();
  const qc = useQueryClient();
  const { data: storesList, isFetched: storesFetched } = useStores();
  const { enabledLocales } = useBranding();
  const [values, setValues] = useState<StorePrefsFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeCount = storesList?.length;
  const showLanguage =
    storesFetched && typeof storeCount === "number" ? storeCount <= 1 : true;

  const blocking = !!(
    store?.onboarding_completed_at &&
    !store.site_preferences_completed_at &&
    store.id
  );

  useEffect(() => {
    if (!store?.id) return;
    setValues(buildInitialValues(store, profile, i18n.language));
  }, [store?.id, store?.timezone, store?.currency, store?.country_code, store?.store_type, store?.acquisition_source, store?.acquisition_source_detail, profile?.locale, i18n.language]);

  const patch = useCallback((p: Partial<StorePrefsFormValues>) => {
    setValues((prev) => (prev ? { ...prev, ...p } : prev));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!store?.id || !values) return;
    if (!values.timezone.trim()) {
      setError(t("storePreferences.validation.timezone"));
      return;
    }
    if (!values.currency.trim()) {
      setError(t("storePreferences.validation.currency"));
      return;
    }
    if (!values.countryCode) {
      setError(t("storePreferences.validation.country"));
      return;
    }
    if (!values.storeType) {
      setError(t("storePreferences.validation.storeType"));
      return;
    }
    if (!values.acquisitionSource) {
      setError(t("storePreferences.validation.acquisition"));
      return;
    }
    if (values.acquisitionSource === "other" && !values.acquisitionDetail.trim()) {
      setError(t("storePreferences.validation.acquisitionOther"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateStore(store.id, {
        timezone: values.timezone.trim(),
        currency: values.currency.trim(),
        country_code: values.countryCode || null,
        store_type: values.storeType || null,
        acquisition_source: values.acquisitionSource || null,
        acquisition_source_detail:
          values.acquisitionSource === "other"
            ? values.acquisitionDetail.trim() || null
            : null,
        site_preferences_completed_at: new Date().toISOString(),
      });

      if (showLanguage && values.locale && values.locale !== i18n.language) {
        await applyLocaleChange(i18n, values.locale, user?.id ?? null);
        await refreshAuth();
      }

      await qc.invalidateQueries({ queryKey: queryKeys.store(store.id) });
      await qc.invalidateQueries({ queryKey: queryKeys.stores });
      await qc.invalidateQueries({ queryKey: ["site-home-stats"] });
      try {
        localStorage.removeItem("sidebar-sites-cache");
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("storePreferences.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!blocking || !store || !values) return null;

  return (
    <Dialog open={blocking} onOpenChange={() => { /* non-dismissable until saved */ }}>
      <DialogContent
        showClose={false}
        className={cn(
          "flex h-[min(92vh,680px)] w-[calc(100vw-1.25rem)] max-w-md flex-col gap-0 overflow-hidden p-0",
          "border-2 border-primary/15 bg-background shadow-xl sm:w-full sm:max-w-[420px]"
        )}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="shrink-0 border-b border-border/80 bg-muted/30 px-5 py-4">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-base font-semibold leading-snug tracking-tight">
              {t("storePreferences.wizardTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {t("storePreferences.wizardDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
            <StorePreferencesFields
              values={values}
              onChange={patch}
              showLanguage={showLanguage}
              enabledLocaleCodes={enabledLocales}
              disabled={submitting}
            />
          </div>

          <div className="shrink-0 space-y-2 border-t border-border bg-background px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {error ?
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            : null}
            <Button type="submit" disabled={submitting} className="w-full font-medium sm:min-w-[168px]">
              {submitting ?
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("storePreferences.saving")}
                </>
              : t("storePreferences.saveContinue")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
