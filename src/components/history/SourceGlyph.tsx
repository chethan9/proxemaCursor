import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

/** Woo / WordPress — compact mark for history rows. */
export function WordPressGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#21759b" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#fff"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        W
      </text>
    </svg>
  );
}

/** Proxima / Supabase-backed platform edits. */
export function PlatformGlyph({ className }: { className?: string }) {
  return <Database className={cn("h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400", className)} aria-hidden />;
}
