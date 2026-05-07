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
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { LOCALES, type LocaleCode } from "@/lib/i18n";
import {
  ACQUISITION_SOURCE_IDS,
  STORE_TYPE_IDS,
  listTimeZones,
} from "@/lib/store-preference-options";
import { currencyLabel, listIsoCurrencyCodes, listIsoRegionCodes, regionLabel } from "@/lib/iso-locale-lists";
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
  /** When set (e.g. modal onboarding), portals Select/Popover into this node so Radix Dialog does not block pointer events. */
  overlayContainer?: HTMLElement | null;
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

type ComboOption = { value: string; label: string; searchText: string };

function SearchableCombo({
  id,
  value,
  displayLabel,
  placeholder,
  options,
  onSelect,
  disabled,
  container,
  searchPlaceholder,
  filled,
}: {
  id: string;
  value: string;
  displayLabel: string;
  placeholder: string;
  options: ComboOption[];
  onSelect: (v: string) => void;
  disabled?: boolean;
  container?: HTMLElement | null;
  searchPlaceholder: string;
  filled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverAnchor asChild>
        <div className="w-full">
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between px-3 font-normal shadow-sm",
              filled ?
                "border-input bg-background font-medium text-foreground"
              : "border-input/80 bg-muted/40 text-muted-foreground"
            )}
          >
            <span className="truncate text-left">{displayLabel || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        container={container}
        className="w-[var(--radix-popper-anchor-width)] min-w-[var(--radix-popper-anchor-width)] max-w-[min(calc(100vw-2rem),480px)] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={12}
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain">
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup className="p-1">
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.searchText}
                  onSelect={() => {
                    onSelect(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4 shrink-0", value === o.value ? "opacity-100 text-primary" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function StorePreferencesFields({
  values,
  onChange,
  showLanguage,
  enabledLocaleCodes,
  disabled,
  overlayContainer,
}: Props) {
  const { t, i18n } = useTranslation("site");
  const [tzOpen, setTzOpen] = useState(false);
  const allZones = useMemo(() => listTimeZones(), []);
  const lang = i18n.language || "en";

  const countryOptions = useMemo((): ComboOption[] => {
    return listIsoRegionCodes().map((code) => ({
      value: code,
      label: `${regionLabel(code, lang)} (${code})`,
      searchText: `${code} ${regionLabel(code, lang)}`.toLowerCase(),
    }));
  }, [lang]);

  const currencyOptions = useMemo((): ComboOption[] => {
    return listIsoCurrencyCodes().map((code) => ({
      value: code,
      label: currencyLabel(code, lang),
      searchText: `${code} ${currencyLabel(code, lang)}`.toLowerCase(),
    }));
  }, [lang]);

  const storeTypeOptions = useMemo(
    (): ComboOption[] =>
      STORE_TYPE_IDS.map((id) => ({
        value: id,
        label: t(`storePreferences.storeTypes.${id}`),
        searchText: `${id} ${t(`storePreferences.storeTypes.${id}`)}`.toLowerCase(),
      })),
    [t]
  );

  const acquisitionOptions = useMemo(
    (): ComboOption[] =>
      ACQUISITION_SOURCE_IDS.map((id) => ({
        value: id,
        label: t(`storePreferences.acquisitionSources.${id}`),
        searchText: `${id} ${t(`storePreferences.acquisitionSources.${id}`)}`.toLowerCase(),
      })),
    [t]
  );

  const visibleLocales = LOCALES.filter((l) => enabledLocaleCodes.includes(l.code));

  const countryDisplay = values.countryCode ? countryOptions.find((o) => o.value === values.countryCode)?.label || values.countryCode : "";

  return (
    <div className="space-y-2.5">
      {showLanguage && visibleLocales.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t("storePreferences.language")}</Label>
          <p className="text-[11px] leading-tight text-muted-foreground">{t("storePreferences.languageHint")}</p>
          <Select
            value={values.locale}
            onValueChange={(v) => onChange({ locale: v as LocaleCode })}
            disabled={disabled}
          >
            <SelectTrigger className={selectTriggerClass(true)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent container={overlayContainer} collisionPadding={12}>
              {visibleLocales.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground" htmlFor="tz-trigger">
          {t("storePreferences.timezone")}
        </Label>
        <Popover open={tzOpen} onOpenChange={setTzOpen} modal={false}>
          <PopoverAnchor asChild>
            <div className="w-full">
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
            </div>
          </PopoverAnchor>
          <PopoverContent
            container={overlayContainer}
            className="w-[var(--radix-popper-anchor-width)] min-w-[var(--radix-popper-anchor-width)] max-w-[min(calc(100vw-2rem),480px)] p-0"
            align="start"
            side="bottom"
            sideOffset={4}
            collisionPadding={12}
            onWheel={(e) => e.stopPropagation()}
          >
            <Command shouldFilter>
              <CommandInput placeholder={t("storePreferences.searchTimezone")} className="h-9" />
              <CommandList className="max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain">
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground" htmlFor="currency-combo">
            {t("storePreferences.currency")}
          </Label>
          <SearchableCombo
            id="currency-combo"
            value={values.currency}
            displayLabel={values.currency ? currencyLabel(values.currency, lang) : ""}
            placeholder={t("storePreferences.selectCurrency")}
            options={currencyOptions}
            onSelect={(v) => onChange({ currency: v })}
            disabled={disabled}
            container={overlayContainer}
            searchPlaceholder={t("storePreferences.searchCurrency")}
            filled={!!values.currency?.trim()}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground" htmlFor="country-combo">
            {t("storePreferences.country")}
          </Label>
          <SearchableCombo
            id="country-combo"
            value={values.countryCode}
            displayLabel={countryDisplay}
            placeholder={t("storePreferences.selectCountry")}
            options={countryOptions}
            onSelect={(v) => onChange({ countryCode: v })}
            disabled={disabled}
            container={overlayContainer}
            searchPlaceholder={t("storePreferences.searchCountry")}
            filled={!!values.countryCode}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground" htmlFor="store-type-combo">
          {t("storePreferences.storeType")}
        </Label>
        <SearchableCombo
          id="store-type-combo"
          value={values.storeType}
          displayLabel={values.storeType ? t(`storePreferences.storeTypes.${values.storeType}`) : ""}
          placeholder={t("storePreferences.selectStoreType")}
          options={storeTypeOptions}
          onSelect={(v) => onChange({ storeType: v })}
          disabled={disabled}
          container={overlayContainer}
          searchPlaceholder={t("storePreferences.searchStoreType")}
          filled={!!values.storeType}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground" htmlFor="acquisition-combo">
          {t("storePreferences.acquisition")}
        </Label>
        <SearchableCombo
          id="acquisition-combo"
          value={values.acquisitionSource}
          displayLabel={values.acquisitionSource ? t(`storePreferences.acquisitionSources.${values.acquisitionSource}`) : ""}
          placeholder={t("storePreferences.selectAcquisition")}
          options={acquisitionOptions}
          onSelect={(v) => onChange({ acquisitionSource: v })}
          disabled={disabled}
          container={overlayContainer}
          searchPlaceholder={t("storePreferences.searchAcquisition")}
          filled={!!values.acquisitionSource}
        />
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
