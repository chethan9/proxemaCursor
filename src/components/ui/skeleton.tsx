import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r",
        "before:from-transparent before:to-transparent",
        "before:via-black/[0.06] dark:before:via-white/[0.08]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }