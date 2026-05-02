/**
 * Cloudflare Images mirror status for a store (same store id as Projects workspace `/projects/[id]`).
 */
import { SitePageShell } from "@/components/site/shared";
import { CloudflareImagesInner } from "@/components/site/CloudflareImagesInner";

export default function ProjectCloudflarePage() {
  return (
    <SitePageShell>
      <CloudflareImagesInner />
    </SitePageShell>
  );
}
