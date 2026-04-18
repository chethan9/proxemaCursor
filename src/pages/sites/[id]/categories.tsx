import { Layers } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteCategoriesPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Categories"
        description="Product categories and their hierarchy"
        icon={Layers}
        exploreLabel="Categories"
      />
    </SitePageShell>
  );
}