import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ICON_MAP, ICON_NAMES, resolveIcon } from "@/lib/menu-registry";
import { cn } from "@/lib/utils";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string | null;
}

export function IconPicker({ value, onChange, color }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const Icon = resolveIcon(value);
  const filtered = ICON_NAMES.filter((n) => n.toLowerCase().includes(query.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Pick icon"
        >
          <Icon className="h-4 w-4" style={color ? { color } : undefined} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          placeholder="Search icons..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="grid grid-cols-7 gap-1 max-h-56 overflow-y-auto">
          {filtered.map((name) => {
            const I = ICON_MAP[name];
            return (
              <button
                key={name}
                type="button"
                onClick={() => { onChange(name); setOpen(false); }}
                className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors",
                  value === name && "bg-primary/10 ring-1 ring-primary"
                )}
                title={name}
              >
                <I className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}