import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Filter, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

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
}: {
  range: PresetValue;
  from?: Date;
  to?: Date;
  onChange: (range: PresetValue, from?: Date, to?: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<PresetValue>(range);
  const [draftFrom, setDraftFrom] = useState<Date | undefined>(from);
  const [draftTo, setDraftTo] = useState<Date | undefined>(to);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftRange(range);
      setDraftFrom(from);
      setDraftTo(to);
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
    onChange("custom", draftFrom, draftTo);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraftRange(range);
    setDraftFrom(from);
    setDraftTo(to);
    setOpen(false);
  };

  const active = range !== "all";
  const canApply = !!(draftFrom && draftTo);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={active ? "secondary" : "outline"} size="sm" className="h-9 text-xs gap-1.5 px-2.5">
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
                  className={`w-full text-left px-2.5 py-1.5 transition-colors ${
                    isActive
                      ? "bg-accent border-l-2 border-primary font-medium pl-[8px]"
                      : "border-l-2 border-transparent hover:bg-muted pl-[8px]"
                  }`}
                >
                  {p.l}
                </button>
              );
            })}
          </div>
          {draftRange === "custom" && (
            <div className="w-[220px] flex flex-col">
              <div className="p-3 space-y-2.5 flex-1">
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    From date
                  </label>
                  <Popover open={fromOpen} onOpenChange={setFromOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative cursor-pointer">
                        <Input
                          readOnly
                          value={draftFrom ? format(draftFrom, "dd/MM/yyyy") : ""}
                          placeholder="dd/mm/yyyy"
                          className="h-8 pr-7 text-xs cursor-pointer"
                        />
                        <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={draftFrom}
                        onSelect={(d) => {
                          setDraftFrom(d ?? undefined);
                          setFromOpen(false);
                        }}
                        disabled={(date) => (draftTo ? date > draftTo : false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    To date
                  </label>
                  <Popover open={toOpen} onOpenChange={setToOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative cursor-pointer">
                        <Input
                          readOnly
                          value={draftTo ? format(draftTo, "dd/MM/yyyy") : ""}
                          placeholder="dd/mm/yyyy"
                          className="h-8 pr-7 text-xs cursor-pointer"
                        />
                        <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={draftTo}
                        onSelect={(d) => {
                          setDraftTo(d ?? undefined);
                          setToOpen(false);
                        }}
                        disabled={(date) => (draftFrom ? date < draftFrom : false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-border">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancel}>
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