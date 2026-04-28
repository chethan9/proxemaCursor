import { useState } from "react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetServerSideProps } from "next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { ProductsTab } from "@/components/explore/ProductsTab";

function ProductsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t } = useTranslation("common");
  const [search, setSearch] = useState("");
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

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "site"])),
  },
});