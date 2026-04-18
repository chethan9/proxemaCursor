import { Card, CardContent } from "@/components/ui/card";
import { Key, Shield, Activity, EyeOff } from "lucide-react";

interface ApiKeyStatsProps {
  totalKeys: number;
  activeKeys: number;
  totalCalls: number;
  revokedKeys: number;
}

export function ApiKeyStats({ totalKeys, activeKeys, totalCalls, revokedKeys }: ApiKeyStatsProps) {
  const stats = [
    { label: "Total Keys", value: totalKeys, icon: Key, iconClass: "text-slate-600 bg-slate-100" },
    { label: "Active", value: activeKeys, icon: Shield, iconClass: "text-emerald-600 bg-emerald-50" },
    { label: "Total API Calls", value: totalCalls.toLocaleString(), icon: Activity, iconClass: "text-blue-600 bg-blue-50" },
    { label: "Revoked", value: revokedKeys, icon: EyeOff, iconClass: "text-rose-600 bg-rose-50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " + s.iconClass}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums leading-none">{s.value}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}