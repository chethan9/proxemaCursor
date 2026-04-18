import { Users } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteCustomersPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Customers"
        description="Customer directory with orders and lifetime value"
        icon={Users}
      />
    </SitePageShell>
  );
}