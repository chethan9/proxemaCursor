import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
  usage: { sites: number; products: number; users: number };
  quotas: { maxSites: number; maxProducts: number; maxUsers: number };
}

export function UsageMeterCard({ usage, quotas }: Props) {
  const rows = [
    { label: "Sites", cur: usage.sites, max: quotas.maxSites },
    { label: "Products", cur: usage.products, max: quotas.maxProducts },
    { label: "Users", cur: usage.users, max: quotas.maxUsers },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex justify-between text-sm mb-1"><span>{r.label}</span><span>{r.cur} / {r.max}</span></div>
            <Progress value={Math.min(100, (r.cur / r.max) * 100)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}