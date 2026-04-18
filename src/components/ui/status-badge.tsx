import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        error: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-primary/20 bg-primary/10 text-primary",
        pending: "border-border bg-muted text-muted-foreground",
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
            "bg-success": variant === "success",
            "bg-warning": variant === "warning",
            "bg-destructive": variant === "error",
            "bg-primary": variant === "info",
            "bg-muted-foreground": variant === "pending" || variant === "default",
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