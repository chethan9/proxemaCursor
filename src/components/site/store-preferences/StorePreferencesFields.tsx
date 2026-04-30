import { useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LOCALES, type LocaleCode } from "@/lib/i18n";
import { REGION_COUNTRIES, REGION_CURRENCY_CODES } from "@/lib/region-countries";
import {
  ACQUISITION_SOURCE_IDS,
  STORE_TYPE_IDS,
  listTimeZones,
} from "@/lib/store-preference-options";
import { cn } from "@/lib/utils";

export interface StorePrefsFormValues {
  timezone: string;
  currency: string;
  countryCode: string;
  storeType: string;
  acquisitionSource: string;
  acquisitionDetail: string;
  locale: LocaleCode;
}

interface Props {
  values: StorePrefsFormValues;
  onChange: (patch: Partial<StorePrefsFormValues>) => void;
  showLanguage: boolean;
  enabledLocaleCodes: string[];
  disabled?: boolean;
}

export function StorePreferencesFields({
  values,
  onChange,
  showLanguage,
  enabledLocaleCodes,
  disabled,
}: Props) {
  const { t } = useTranslation("site");
  const [tzSearch, setTzSearch] = useState("");
  const allZones = useMemo(() => listTimeZones(), []);
  const filteredTz = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return allZones.slice(0, 400);
    return allZones.filter((z) => z.toLowerCase().includes(q)).slice(0, 400);
  }, [allZones, tzSearch]);

  const visibleLocales = LOCALES.filter((l) => enabledLocaleCodes.includes(l.code));

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      {showLanguage && visibleLocales.length > 1 && (
        <div className="space-y-2">
          <Label>{t("storePreferences.language")}</Label>
          <p className="text-xs text-muted-foreground">{t("storePreferences.languageHint")}</p>
          <Select
            value={values.locale}
            onValueChange={(v) => onChange({ locale: v as LocaleCode })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleLocales.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t("storePreferences.timezone")}</Label>
        <Input
          placeholder={t("storePreferences.searchTimezone")}
          value={tzSearch}
          onChange={(e) => setTzSearch(e.target.value)}
          disabled={disabled}
          className="h-9"
        />
        <ScrollArea className="h-[160px] rounded-md border border-border">
          <div className="p-2 space-y-0.5">
            {filteredTz.map((z) => (
              <button
                key={z}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ timezone: z })}
                className={cn(
                  "w-full text-start rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                  values.timezone === z && "bg-muted font-medium"
                )}
              >
                {z}
              </button>
            ))}
            {filteredTz.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4">{t("storePreferences.noTzMatches")}</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("storePreferences.currency")}</Label>
          <Select
            value={values.currency}
            onValueChange={(v) => onChange({ currency: v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGION_CURRENCY_CODES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("storePreferences.country")}</Label>
          <Select
            value={values.countryCode || "__none__"}
            onValueChange={(v) => onChange({ countryCode: v === "__none__" ? "" : v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("storePreferences.selectCountry")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("storePreferences.selectCountry")}</SelectItem>
              {REGION_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("storePreferences.storeType")}</Label>
        <Select
          value={values.storeType || "__none__"}
          onValueChange={(v) => onChange({ storeType: v === "__none__" ? "" : v })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("storePreferences.selectStoreType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("storePreferences.selectStoreType")}</SelectItem>
            {STORE_TYPE_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {t(`storePreferences.storeTypes.${id}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("storePreferences.acquisition")}</Label>
        <Select
          value={values.acquisitionSource || "__none__"}
          onValueChange={(v) => onChange({ acquisitionSource: v === "__none__" ? "" : v })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("storePreferences.selectAcquisition")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("storePreferences.selectAcquisition")}</SelectItem>
            {ACQUISITION_SOURCE_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {t(`storePreferences.acquisitionSources.${id}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {values.acquisitionSource === "other" && (
          <div className="space-y-1 pt-1">
            <Label className="text-xs">{t("storePreferences.acquisitionOtherDetail")}</Label>
            <Input
              value={values.acquisitionDetail}
              onChange={(e) => onChange({ acquisitionDetail: e.target.value })}
              disabled={disabled}
              placeholder={t("storePreferences.acquisitionOtherPlaceholder")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
