import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100 text-amber-700",
        error: "bg-rose-100 text-rose-700",
        info: "bg-blue-100 text-blue-700",
        pending: "bg-slate-100 text-slate-600",
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
          className={cn("h-1.5 w-1.5 rounded-full animate-pulse-slow", {
            "bg-emerald-500": variant === "success",
            "bg-amber-500": variant === "warning",
            "bg-rose-500": variant === "error",
            "bg-blue-500": variant === "info",
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