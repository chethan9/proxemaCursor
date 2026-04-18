import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LegacyExploreRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const id = router.query.id;
    if (typeof id === "string") router.replace(`/sites/${id}`);
  }, [router.isReady, router.query.id, router]);
  return null;
}