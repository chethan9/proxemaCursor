import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Building2 } from "lucide-react";

const FEATURES = [
  "Unlimited sites & products",
  "Dedicated infrastructure",
  "Custom SLA & onboarding",
  "Single sign-on (SSO)",
  "Custom integrations",
  "Dedicated account manager",
];

export function EnterpriseCard() {
  return (
    <Card className="flex flex-col p-6 gap-5 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Enterprise</h3>
      </div>
      <p className="text-sm text-muted-foreground min-h-[2.5rem]">Built for agencies and brands running hundreds of stores with custom SLAs.</p>
      <div className="min-h-[4rem]">
        <div className="text-2xl font-semibold">Custom</div>
        <p className="text-xs text-muted-foreground mt-1">Tailored to your scale</p>
      </div>
      <Button asChild className="w-full" variant="outline">
        <a href="mailto:sales@proxima.app?subject=Enterprise%20plan%20enquiry">Contact sales</a>
      </Button>
      <ul className="space-y-2.5 text-sm">
        {FEATURES.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}