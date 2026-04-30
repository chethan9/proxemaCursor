import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ExploreRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const id = typeof router.query.id === "string" ? router.query.id : "";
    if (id) router.replace(`/sites/${id}/products`);
  }, [router.isReady, router.query.id, router]);
  return null;
}