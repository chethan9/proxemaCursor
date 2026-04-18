import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ColorPickerProps {
  value?: string | null;
  onChange: (color: string | null) => void;
}

const PRESETS = [
  { name: "Default", hex: null },
  { name: "Primary", hex: "#2563eb" },
  { name: "Accent", hex: "#FF6A00" },
  { name: "Success", hex: "#10b981" },
  { name: "Warning", hex: "#f59e0b" },
  { name: "Danger", hex: "#ef4444" },
  { name: "Info", hex: "#06b6d4" },
  { name: "Muted", hex: "#64748b" },
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-muted"
          aria-label="Pick color"
        >
          {value ? (
            <span className="h-4 w-4 rounded-sm" style={{ background: value }} />
          ) : (
            <X className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onChange(p.hex)}
              className={cn(
                "h-8 rounded-md border flex items-center justify-center text-[10px] font-medium",
                value === p.hex ? "ring-2 ring-primary" : "border-border"
              )}
              style={p.hex ? { background: p.hex, color: "white" } : {}}
              title={p.name}
            >
              {!p.hex && "None"}
            </button>
          ))}
        </div>
        <Input
          placeholder="#hex"
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8"
        />
      </PopoverContent>
    </Popover>
  );
}