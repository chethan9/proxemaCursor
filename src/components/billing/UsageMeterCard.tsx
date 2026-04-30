import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "next-i18next";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format-number";

interface Props {
  usage: { sites: number; products: number; users: number };
  quotas: { maxSites: number; maxProducts: number; maxUsers: number };
  /** Subscription soft-quota grace end (ISO); shown when in the future. */
  graceUntil?: string | null;
}

export function UsageMeterCard({ usage, quotas, graceUntil }: Props) {
  const { t, i18n } = useTranslation("billing");
  const graceEnd = graceUntil ? new Date(graceUntil).getTime() : 0;
  const graceActive = Number.isFinite(graceEnd) && graceEnd > Date.now();

  const rows = [
    { label: t("usage.rowSites"), cur: usage.sites, max: quotas.maxSites },
    { label: t("usage.rowProducts"), cur: usage.products, max: quotas.maxProducts },
    { label: t("usage.rowUsers"), cur: usage.users, max: quotas.maxUsers },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("usage.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {graceActive ? (
          <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-sm">
              {t("usage.graceBanner", { date: formatDate(graceUntil!, i18n.language) })}
            </AlertDescription>
          </Alert>
        ) : null}
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-sm mb-1">
              <span>{r.label}</span>
              <span>
                {r.cur} / {r.max}
              </span>
            </div>
            <Progress value={r.max > 0 ? Math.min(100, (r.cur / r.max) * 100) : 0} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
