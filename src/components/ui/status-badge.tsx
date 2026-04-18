import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        error: "border-rose-200 bg-rose-50 text-rose-700",
        info: "border-sky-200 bg-sky-50 text-sky-700",
        pending: "border-slate-200 bg-slate-50 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  pulse?: boolean;
}

export function StatusBadge({
  className,
  variant,
  pulse,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {pulse && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full animate-pulse-slow", {
            "bg-emerald-500": variant === "success",
            "bg-amber-500": variant === "warning",
            "bg-rose-500": variant === "error",
            "bg-sky-500": variant === "info",
            "bg-slate-400": variant === "pending" || variant === "default",
          })}
        />
      )}
      {children}
    </span>
  );
}

export function getStatusVariant(
  status: string
): "success" | "warning" | "error" | "info" | "pending" {
  switch (status) {
    case "connected":
    case "completed":
    case "active":
      return "success";
    case "syncing":
    case "running":
    case "processing":
      return "info";
    case "pending":
    case "queued":
      return "pending";
    case "warning":
    case "partial":
      return "warning";
    case "error":
    case "failed":
    case "disconnected":
      return "error";
    default:
      return "pending";
  }
}