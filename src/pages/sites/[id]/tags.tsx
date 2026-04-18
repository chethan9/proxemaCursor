import { Tag } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteTagsPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Tags"
        description="Product tags used across this store"
        icon={Tag}
        exploreLabel="Tags"
      />
    </SitePageShell>
  );
}