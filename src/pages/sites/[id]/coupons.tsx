import { Ticket } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteCouponsPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Coupons"
        description="Discount codes and promotions"
        icon={Ticket}
      />
    </SitePageShell>
  );
}