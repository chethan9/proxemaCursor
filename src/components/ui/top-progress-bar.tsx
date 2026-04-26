import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useGlobalLoading } from "@/contexts/LoadingProvider";

export function TopProgressBar() {
  const { active, slotEl } = useGlobalLoading();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(false), 220);
    return () => clearTimeout(t);
  }, [active]);

  if (!mounted || !visible) return null;

  const bar = (
    <div
      className={cn(
        "h-[3px] w-full overflow-hidden pointer-events-none transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full w-full bg-success/15">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-success to-transparent animate-progress-slide" />
      </div>
    </div>
  );

  if (slotEl) {
    return createPortal(bar, slotEl);
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
      {bar}
    </div>
  );
}