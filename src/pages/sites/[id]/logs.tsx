import { ClipboardList } from "lucide-react";
import { SitePagePlaceholder, SitePageShell } from "./_shared";

export default function SiteLogsPage() {
  return (
    <SitePageShell>
      <SitePagePlaceholder
        title="Logs"
        description="Sync runs, webhook events and error logs for this site"
        icon={ClipboardList}
      />
    </SitePageShell>
  );
}