import { ShoppingCart } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteOrdersPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Orders"
        description="View order history, statuses and line items for this store"
        icon={ShoppingCart}
        exploreLabel="Orders"
      />
    </SitePageShell>
  );
}