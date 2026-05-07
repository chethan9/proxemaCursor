import { Loader2 } from "lucide-react";
import { useTranslation } from "next-i18next";
import { STORE_DELETE_TOTAL_STEPS } from "@/lib/store-delete-constants";
import type { DeleteStoreProgress } from "@/services/storeService";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  siteName: string;
  progress: DeleteStoreProgress | null;
  className?: string;
};

export function SiteDeletingOverlay({ open, siteName, progress, className }: Props) {
  const { t } = useTranslation("common");
  if (!open) return null;

  const total = progress?.total ?? STORE_DELETE_TOTAL_STEPS;
  const step = Math.min(progress?.step ?? 1, total);
  const stepKey = progress?.stepKey ?? "starting";
  const label =
    stepKey === "starting"
      ? t("editSite.deleteProgress.starting")
      : t(`editSite.deleteProgress.steps.${stepKey}`, { defaultValue: stepKey });

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/85 px-6 text-center backdrop-blur-sm rounded-lg",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-destructive" aria-hidden />
      <div className="text-sm font-medium">
        {t("editSite.deleting")} <span className="text-destructive">{siteName}</span>
      </div>
      <div className="text-xs font-medium tabular-nums text-muted-foreground">
        {t("editSite.deleteProgress.taskCounter", { current: step, total })}
      </div>
      <div className="max-w-sm text-xs text-muted-foreground leading-snug">{label}</div>
      <div className="text-[11px] text-muted-foreground/90">{t("editSite.deletingDesc")}</div>
    </div>
  );
}
