import { cn } from "@/lib/utils";

interface TopProgressBarProps {
  active: boolean;
  className?: string;
}

export function TopProgressBar({ active, className }: TopProgressBarProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute top-0 left-0 right-0 h-[2px] overflow-hidden rounded-t-lg pointer-events-none transition-opacity duration-200 z-20",
        active ? "opacity-100" : "opacity-0",
        className
      )}
    >
      <div className="h-full w-full bg-primary/15 relative overflow-hidden">
        <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent animate-progress-slide" />
      </div>
    </div>
  );
}