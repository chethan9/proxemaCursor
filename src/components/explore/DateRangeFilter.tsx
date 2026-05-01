import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Filter } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "next-i18next";

export type DateRangePresetValue = "all" | "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

const PRESET_KEYS: { v: DateRangePresetValue; i18nKey: string }[] = [
  { v: "all", i18nKey: "orders.dateRange.presets.all" },
  { v: "today", i18nKey: "orders.dateRange.presets.today" },
  { v: "yesterday", i18nKey: "orders.dateRange.presets.yesterday" },
  { v: "7d", i18nKey: "orders.dateRange.presets.7d" },
  { v: "30d", i18nKey: "orders.dateRange.presets.30d" },
  { v: "90d", i18nKey: "orders.dateRange.presets.90d" },
  { v: "custom", i18nKey: "orders.dateRange.presets.custom" },
];

export function DateRangeFilter({
  range,
  from,
  to,
  onChange,
  disabled,
}: {
  range: DateRangePresetValue;
  from?: Date;
  to?: Date;
  onChange: (range: DateRangePresetValue, from?: Date, to?: Date) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("site");
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRangePresetValue>(range);
  const [draftDates, setDraftDates] = useState<DateRange | undefined>(
    from || to ? { from, to } : undefined
  );

  const presetLabel = useMemo(() => {
    const map = Object.fromEntries(PRESET_KEYS.map((p) => [p.v, t(p.i18nKey)])) as Record<DateRangePresetValue, string>;
    return map;
  }, [t]);

  const triggerText = useMemo(() => {
    if (range === "all") return t("orders.dateRange.trigger");
    if (range === "custom") {
      if (from && to) return `${format(from, "MMM d")} ${t("orders.dateRange.rangeSeparator")} ${format(to, "MMM d")}`;
      if (from) return t("orders.dateRange.fromPrefix", { date: format(from, "MMM d") });
      return t("orders.dateRange.custom");
    }
    return presetLabel[range] ?? t("orders.dateRange.trigger");
  }, [range, from, to, t, presetLabel]);

  useEffect(() => {
    if (open) {
      setDraftRange(range);
      setDraftDates(from || to ? { from, to } : undefined);
    }
  }, [open, range, from, to]);

  const handlePresetClick = (v: DateRangePresetValue) => {
    if (v === "custom") {
      setDraftRange("custom");
      return;
    }
    onChange(v, undefined, undefined);
    setOpen(false);
  };

  const handleApply = () => {
    onChange("custom", draftDates?.from, draftDates?.to);
    setOpen(false);
  };

  const active = range !== "all";
  const canApply = !!(draftDates?.from && draftDates?.to);

  const customSummary = (() => {
    if (draftDates?.from && draftDates?.to) {
      return `${format(draftDates.from, "MMM d")} ${t("orders.dateRange.rangeSeparator")} ${format(draftDates.to, "MMM d, yyyy")}`;
    }
    if (draftDates?.from) {
      return t("orders.dateRange.pickEndDate", { start: format(draftDates.from, "MMM d, yyyy") });
    }
    return t("orders.dateRange.pickStartEnd");
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={active ? "secondary" : "outline"}
          size="sm"
          className="h-9 text-xs gap-1.5 px-2.5"
          disabled={disabled}
          title={disabled ? t("orders.toolbar.lockedHint") : undefined}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>{triggerText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
        <div className="flex text-xs">
          <div className="border-r border-border py-1 w-[140px]">
            {PRESET_KEYS.map((p) => {
              const isActive = draftRange === p.v;
              return (
                <button
                  key={p.v}
                  onClick={() => handlePresetClick(p.v)}
                  className={`w-full text-left px-2.5 py-1.5 transition-colors border-l-2 ${
                    isActive
                      ? "bg-accent border-primary font-medium"
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  {presetLabel[p.v]}
                </button>
              );
            })}
          </div>
          {draftRange === "custom" && (
            <div className="flex flex-col">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {customSummary}
              </div>
              <Calendar
                mode="range"
                selected={draftDates}
                onSelect={setDraftDates}
                numberOfMonths={1}
              />
              <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-border">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                  {t("orders.dateRange.cancel")}
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleApply} disabled={!canApply}>
                  {t("orders.dateRange.apply")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
