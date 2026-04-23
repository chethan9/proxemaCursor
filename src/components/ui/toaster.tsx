import { CheckCircle2, AlertCircle, Info, AlertTriangle, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const ICON_MAP = {
  success: { Icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  destructive: { Icon: AlertCircle, cls: "text-rose-600 dark:text-rose-400" },
  warning: { Icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  info: { Icon: Info, cls: "text-blue-600 dark:text-blue-400" },
  default: { Icon: Bell, cls: "text-muted-foreground" },
} as const;

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const v = (variant as keyof typeof ICON_MAP) || "default";
        const { Icon, cls } = ICON_MAP[v] || ICON_MAP.default;
        return (
          <Toast key={id} variant={variant} {...props}>
            <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cls}`} />
            <div className="flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}