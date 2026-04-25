import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Filter } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

type PresetValue = "all" | "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

const PRESETS: { v: PresetValue; l: string }[] = [
  { v: "all", l: "All time" },
  { v: "today", l: "Today" },
  { v: "yesterday", l: "Yesterday" },
  { v: "7d", l: "Last 7 days" },
  { v: "30d", l: "Last 30 days" },
  { v: "90d", l: "Last 90 days" },
  { v: "custom", l: "Custom range…" },
];

function triggerLabel(range: PresetValue, from?: Date, to?: Date): string {
  if (range === "all") return "Date";
  if (range === "custom") {
    if (from && to) return `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
    if (from) return `From ${format(from, "MMM d")}`;
    return "Custom";
  }
  return PRESETS.find((p) => p.v === range)?.l ?? "Date";
}

export function DateRangeFilter({
  range,
  from,
  to,
  onChange,
  disabled,
}: {
  range: PresetValue;
  from?: Date;
  to?: Date;
  onChange: (range: PresetValue, from?: Date, to?: Date) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<PresetValue>(range);
  const [draftDates, setDraftDates] = useState<DateRange | undefined>(
    from || to ? { from, to } : undefined
  );

  useEffect(() => {
    if (open) {
      setDraftRange(range);
      setDraftDates(from || to ? { from, to } : undefined);
    }
  }, [open, range, from, to]);

  const handlePresetClick = (v: PresetValue) => {
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={active ? "secondary" : "outline"} size="sm" className="h-9 text-xs gap-1.5 px-2.5" disabled={disabled} title={disabled ? "Available after initial sync completes" : undefined}>
          <Filter className="h-3.5 w-3.5" />
          <span>{triggerLabel(range, from, to)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
        <div className="flex text-xs">
          <div className="border-r border-border py-1 w-[140px]">
            {PRESETS.map((p) => {
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
                  {p.l}
                </button>
              );
            })}
          </div>
          {draftRange === "custom" && (
            <div className="flex flex-col">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {draftDates?.from && draftDates?.to
                  ? `${format(draftDates.from, "MMM d")} – ${format(draftDates.to, "MMM d, yyyy")}`
                  : draftDates?.from
                  ? `${format(draftDates.from, "MMM d, yyyy")} – pick end date`
                  : "Pick start and end dates"}
              </div>
              <Calendar
                mode="range"
                selected={draftDates}
                onSelect={setDraftDates}
                numberOfMonths={1}
              />
              <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-border">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleApply} disabled={!canApply}>
                  Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}