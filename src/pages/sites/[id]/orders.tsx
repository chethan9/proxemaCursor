import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetServerSideProps } from "next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { OrdersTab } from "@/components/explore/OrdersTab";
import { getQueryString } from "@/hooks/useUrlState";

function OrdersInner() {
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
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <OrdersTab
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

export default function SiteOrdersPage() {
  return (
    <SitePageShell>
      <OrdersInner />
    </SitePageShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "site"])),
  },
});