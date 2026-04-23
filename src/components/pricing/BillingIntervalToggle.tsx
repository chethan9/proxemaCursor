import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function BillingIntervalToggle({ value, onChange }: { value: "month" | "year"; onChange: (v: "month" | "year") => void }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted border">
      <button
        type="button"
        onClick={() => onChange("month")}
        className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-all", value === "month" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2", value === "year" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
      >
        Yearly
        <Badge variant="secondary" className="bg-success/10 text-success text-[10px] h-5 px-1.5">-17%</Badge>
      </button>
    </div>
  );
}