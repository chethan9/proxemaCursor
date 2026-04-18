import { useEffect } from "react";
import { useRouter } from "next/router";

export default function SiteIndexPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  useEffect(() => {
    if (id) router.replace(`/sites/${id}/home`);
  }, [id, router]);
  return null;
}