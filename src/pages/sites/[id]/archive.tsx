import { Archive } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteArchivePage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Archive"
        description="Deleted records that were synced before removal"
        icon={Archive}
      />
    </SitePageShell>
  );
}