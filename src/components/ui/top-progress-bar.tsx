import { cn } from "@/lib/utils";
import { useGlobalLoading } from "@/contexts/LoadingProvider";

interface TopProgressBarProps {
  active?: boolean;
  className?: string;
}

export function TopProgressBar({ active, className }: TopProgressBarProps) {
  const { active: globalActive } = useGlobalLoading();
  const isActive = active ?? globalActive;
  return (
    <div
      aria-hidden
      className={cn(
        "fixed top-0 left-0 right-0 h-[3px] overflow-hidden pointer-events-none transition-opacity duration-200 z-[100]",
        isActive ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <div className="h-full w-full bg-success/15 relative overflow-hidden">
        <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-success to-transparent animate-progress-slide" />
      </div>
    </div>
  );
}