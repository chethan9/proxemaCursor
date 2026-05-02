import { useEffect } from "react";
import { useRouter } from "next/router";

/** Old URL — Cloudflare mirror UI lives under `/projects/[storeId]/cloudflare`. */
export default function LegacySiteCloudflareRedirect() {
  const router = useRouter();
  const { id } = router.query;
  useEffect(() => {
    if (typeof id === "string") {
      void router.replace(`/projects/${id}/cloudflare`);
    }
  }, [id, router]);
  return (
    <div className="p-6 text-sm text-muted-foreground">
      Redirecting to Cloudflare Images…
    </div>
  );
}
