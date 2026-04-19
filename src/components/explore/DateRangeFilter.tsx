import { useState } from "react";
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

function labelFor(range: PresetValue, from?: Date, to?: Date): string {
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
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [fromText, setFromText] = useState(from ? format(from, "yyyy-MM-dd") : "");
  const [toText, setToText] = useState(to ? format(to, "yyyy-MM-dd") : "");

  const applyFromText = (v: string) => {
    setFromText(v);
    const d = new Date(v);
    if (!isNaN(d.getTime())) onChange("custom", d, to);
  };
  const applyToText = (v: string) => {
    setToText(v);
    const d = new Date(v);
    if (!isNaN(d.getTime())) onChange("custom", from, d);
  };

  const active = range !== "all";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={active ? "secondary" : "outline"} size="sm" className="h-9 text-xs gap-1.5 px-2.5">
          <Filter className="h-3.5 w-3.5" />
          <span>{labelFor(range, from, to)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex">
          <div className="border-r border-border p-1 min-w-[160px]">
            {PRESETS.map((p) => (
              <button
                key={p.v}
                onClick={() => {
                  onChange(p.v, from, to);
                  if (p.v !== "custom") setOpen(false);
                }}
                className={`w-full text-left text-xs px-2.5 py-2 rounded hover:bg-muted ${range === p.v ? "bg-accent font-medium" : ""}`}
              >
                {p.l}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="p-3 space-y-3 min-w-[280px]">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From date</label>
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Input
                        type="date"
                        value={fromText}
                        onChange={(e) => applyFromText(e.target.value)}
                        className="h-9 pr-8"
                      />
                      <CalendarIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={from}
                      onSelect={(d) => {
                        onChange("custom", d ?? undefined, to);
                        setFromText(d ? format(d, "yyyy-MM-dd") : "");
                        setFromOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To date</label>
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Input
                        type="date"
                        value={toText}
                        onChange={(e) => applyToText(e.target.value)}
                        className="h-9 pr-8"
                      />
                      <CalendarIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={to}
                      onSelect={(d) => {
                        onChange("custom", from, d ?? undefined);
                        setToText(d ? format(d, "yyyy-MM-dd") : "");
                        setToOpen(false);
                      }}
                      disabled={(date) => (from ? date < from : false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex justify-end gap-2 pt-1 border-t border-border">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { onChange("all"); setOpen(false); }}>Cancel</Button>
                <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(false)} disabled={!from || !to}>Apply</Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}