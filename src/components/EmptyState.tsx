import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
  size = "md",
}: EmptyStateProps) {
  const pad = size === "sm" ? "py-8 px-4" : size === "lg" ? "py-20 px-6" : "py-14 px-6";
  const illoSize = size === "sm" ? "h-24 w-24" : size === "lg" ? "h-40 w-40" : "h-32 w-32";

  return (
    <div className={cn("flex flex-col items-center justify-center text-center", pad, className)}>
      {illustration ? (
        <div className={cn("mb-5", illoSize)}>{illustration}</div>
      ) : Icon ? (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-7 w-7" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground mb-1.5 tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed">{description}</p>
      )}
      {children}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-1">
          {action && (
            <Button onClick={action.onClick} size="sm">
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}