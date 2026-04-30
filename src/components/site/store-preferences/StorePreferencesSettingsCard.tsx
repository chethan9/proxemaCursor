import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StorePreferencesFields, type StorePrefsFormValues } from "./StorePreferencesFields";
import type { Store } from "@/services/storeService";
import { updateStore } from "@/services/storeService";
import { useBranding } from "@/contexts/BrandingProvider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Globe } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { REGION_COUNTRIES } from "@/lib/region-countries";
import { getBrowserTimeZone } from "@/lib/store-preference-options";
import type { LocaleCode } from "@/lib/i18n";

function buildValues(store: Store): StorePrefsFormValues {
  const meta = REGION_COUNTRIES.find((c) => c.code === (store.country_code || ""));
  return {
    timezone: store.timezone || getBrowserTimeZone(),
    currency: store.currency || meta?.currency || "USD",
    countryCode: store.country_code || "",
    storeType: store.store_type || "",
    acquisitionSource: store.acquisition_source || "",
    acquisitionDetail: store.acquisition_source_detail || "",
    locale: "en" as LocaleCode,
  };
}

export function StorePreferencesSettingsCard({
  store,
  onUpdated,
}: {
  store: Store;
  onUpdated: (s: Store) => void;
}) {
  const { t } = useTranslation("site");
  const { enabledLocales } = useBranding();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState<StorePrefsFormValues>(() => buildValues(store));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(buildValues(store));
  }, [store]);

  const patch = useCallback((p: Partial<StorePrefsFormValues>) => {
    setValues((prev) => ({ ...prev, ...p }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    setSaving(true);
    try {
      const updated = await updateStore(store.id, {
        timezone: values.timezone.trim(),
        currency: values.currency.trim(),
        country_code: values.countryCode || null,
        store_type: values.storeType || null,
        acquisition_source: values.acquisitionSource || null,
        acquisition_source_detail:
          values.acquisitionSource === "other"
            ? values.acquisitionDetail.trim() || null
            : null,
      });
      onUpdated(updated);
      await qc.invalidateQueries({ queryKey: queryKeys.store(store.id) });
      await qc.invalidateQueries({ queryKey: queryKeys.stores });
      await qc.invalidateQueries({ queryKey: ["site-home-stats"] });
      try {
        localStorage.removeItem("sidebar-sites-cache");
      } catch {
        /* ignore */
      }
      toast({ title: t("storePreferences.settingsSaved") });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("storePreferences.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          {t("storePreferences.cardTitle")}
        </CardTitle>
        <CardDescription>{t("storePreferences.cardDescription")}</CardDescription>
        <p className="text-xs text-muted-foreground pt-1">
          {t("storePreferences.languageNote")}{" "}
          <Link href="/settings/profile" className="text-primary underline underline-offset-2 font-medium">
            {t("storePreferences.languageLink")}
          </Link>
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <StorePreferencesFields
            values={values}
            onChange={patch}
            showLanguage={false}
            enabledLocaleCodes={enabledLocales}
            disabled={saving}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("storePreferences.saving")}
              </>
            ) : (
              t("storePreferences.saveSettings")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
