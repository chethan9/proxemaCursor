import { History } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteHistoryPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Entity history"
        description="Full change history across products, orders and customers"
        icon={History}
      />
    </SitePageShell>
  );
}