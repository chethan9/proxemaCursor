import { Card, CardContent } from "@/components/ui/card";
import { Key, Shield, Activity, Ban, TrendingUp } from "lucide-react";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";

interface ApiKeyStatsProps {
  totalKeys: number;
  activeKeys: number;
  totalCalls: number;
  revokedKeys: number;
}

export function ApiKeyStats({ totalKeys, activeKeys, totalCalls, revokedKeys }: ApiKeyStatsProps) {
  const { i18n } = useTranslation();
  const stats = [
    {
      label: "Total Keys",
      value: formatNumber(totalKeys, i18n.language),
      icon: Key,
      iconClass: "text-slate-700 bg-slate-100",
      description: "Across all clients",
    },
    {
      label: "Active",
      value: formatNumber(activeKeys, i18n.language),
      icon: Shield,
      iconClass: "text-emerald-700 bg-emerald-50",
      description: `${totalKeys > 0 ? Math.round((activeKeys / totalKeys) * 100) : 0}% of total`,
    },
    {
      label: "API Calls",
      value: formatNumber(totalCalls, i18n.language),
      icon: Activity,
      iconClass: "text-blue-700 bg-blue-50",
      description: "Last 24 hours",
    },
    {
      label: "Revoked",
      value: formatNumber(revokedKeys, i18n.language),
      icon: Ban,
      iconClass: "text-rose-700 bg-rose-50",
      description: "No longer active",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {s.value}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.description}</p>
              </div>
              <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " + s.iconClass}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}