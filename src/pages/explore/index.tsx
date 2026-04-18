import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LegacyExploreIndexRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/sites"); }, [router]);
  return null;
}