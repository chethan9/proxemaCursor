import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { ProductsTab } from "@/components/explore/ProductsTab";
import { getQueryString } from "@/hooks/useUrlState";

function ProductsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t } = useTranslation("common");
  const router = useRouter();
  const [search, setSearch] = useState<string>(() => getQueryString(router.query, "q") ?? "");
  const querySyncedRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || querySyncedRef.current) return;
    const q = getQueryString(router.query, "q") ?? "";
    setSearch((prev) => (prev !== q ? q : prev));
    querySyncedRef.current = true;
  }, [router.isReady, router.query]);
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">{t("errors.storeNotFound", "Store not found")}</div>;
  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <ProductsTab
        storeId={id}
        storeUrl={store.url}
        storeName={store.name}
        search={search}
        onSearchChange={setSearch}
        embedHeader
      />
    </div>
  );
}

export default function SiteProductsPage() {
  return (
    <SitePageShell>
      <ProductsInner />
    </SitePageShell>
  );
}