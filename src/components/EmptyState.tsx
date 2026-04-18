import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, className, children }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      {Icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1.5 tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{description}</p>
      )}
      {children}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
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