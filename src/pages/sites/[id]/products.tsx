import { Package } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteProductsPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Products"
        description="Browse, search and manage all products synced from this store"
        icon={Package}
        exploreLabel="Products"
      />
    </SitePageShell>
  );
}