import { useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LOCALES, type LocaleCode } from "@/lib/i18n";
import { REGION_COUNTRIES, REGION_CURRENCY_CODES } from "@/lib/region-countries";
import {
  ACQUISITION_SOURCE_IDS,
  STORE_TYPE_IDS,
  listTimeZones,
} from "@/lib/store-preference-options";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

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

/** Stronger visual signal when a select has a real value vs placeholder. */
function selectTriggerClass(filled: boolean) {
  return cn(
    "h-9 w-full transition-colors",
    filled ?
      "border-input bg-background font-medium text-foreground shadow-sm"
    : "border-input/80 bg-muted/40 text-muted-foreground font-normal"
  );
}

export function StorePreferencesFields({
  values,
  onChange,
  showLanguage,
  enabledLocaleCodes,
  disabled,
}: Props) {
  const { t } = useTranslation("site");
  const [tzOpen, setTzOpen] = useState(false);
  const allZones = useMemo(() => listTimeZones(), []);

  const visibleLocales = LOCALES.filter((l) => enabledLocaleCodes.includes(l.code));

  return (
    <div className="space-y-3">
      {showLanguage && visibleLocales.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{t("storePreferences.language")}</Label>
          <p className="text-[11px] leading-snug text-muted-foreground">{t("storePreferences.languageHint")}</p>
          <Select
            value={values.locale}
            onValueChange={(v) => onChange({ locale: v as LocaleCode })}
            disabled={disabled}
          >
            <SelectTrigger className={selectTriggerClass(true)}>
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

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground" htmlFor="tz-trigger">
          {t("storePreferences.timezone")}
        </Label>
        <Popover
          open={tzOpen}
          onOpenChange={setTzOpen}
          modal={false}
        >
          <PopoverTrigger asChild>
            <Button
              id="tz-trigger"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={tzOpen}
              disabled={disabled}
              className={cn(
                "h-9 w-full justify-between px-3 font-normal shadow-sm",
                values.timezone ?
                  "border-input bg-background font-medium text-foreground"
                : "border-input/80 bg-muted/40 text-muted-foreground"
              )}
            >
              <span className="truncate text-left">{values.timezone || t("storePreferences.selectTimezone")}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(calc(100vw-2rem),400px)] p-0 sm:w-[400px]"
            align="start"
            sideOffset={4}
            collisionPadding={16}
          >
            <Command shouldFilter>
              <CommandInput placeholder={t("storePreferences.searchTimezone")} className="h-9" />
              <CommandList className="max-h-[min(220px,40vh)]">
                <CommandEmpty>{t("storePreferences.noTzMatches")}</CommandEmpty>
                <CommandGroup className="p-1">
                  {allZones.map((z) => (
                    <CommandItem
                      key={z}
                      value={z}
                      onSelect={() => {
                        onChange({ timezone: z });
                        setTzOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          values.timezone === z ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{z}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{t("storePreferences.currency")}</Label>
          <Select
            value={values.currency}
            onValueChange={(v) => onChange({ currency: v })}
            disabled={disabled}
          >
            <SelectTrigger className={selectTriggerClass(!!values.currency?.trim())}>
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
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{t("storePreferences.country")}</Label>
          <Select
            value={values.countryCode || "__none__"}
            onValueChange={(v) => onChange({ countryCode: v === "__none__" ? "" : v })}
            disabled={disabled}
          >
            <SelectTrigger className={selectTriggerClass(!!values.countryCode)}>
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

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{t("storePreferences.storeType")}</Label>
        <Select
          value={values.storeType || "__none__"}
          onValueChange={(v) => onChange({ storeType: v === "__none__" ? "" : v })}
          disabled={disabled}
        >
          <SelectTrigger className={selectTriggerClass(!!values.storeType)}>
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

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{t("storePreferences.acquisition")}</Label>
        <Select
          value={values.acquisitionSource || "__none__"}
          onValueChange={(v) => onChange({ acquisitionSource: v === "__none__" ? "" : v })}
          disabled={disabled}
        >
          <SelectTrigger className={selectTriggerClass(!!values.acquisitionSource)}>
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
          <div className="space-y-1 pt-0.5">
            <Label className="text-xs text-muted-foreground">{t("storePreferences.acquisitionOtherDetail")}</Label>
            <Input
              value={values.acquisitionDetail}
              onChange={(e) => onChange({ acquisitionDetail: e.target.value })}
              disabled={disabled}
              placeholder={t("storePreferences.acquisitionOtherPlaceholder")}
              className="h-9"
            />
          </div>
        )}
      </div>
    </div>
  );
}
