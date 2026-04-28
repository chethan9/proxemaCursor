import { useState } from "react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetServerSideProps } from "next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { TaxonomyTab } from "@/components/explore/TaxonomyTab";

function CategoriesInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t } = useTranslation("common");
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">{t("errors.storeNotFound", "Store not found")}</div>;
  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <TaxonomyTab
        storeId={id}
        mode="categories"
        search={search}
        onSearchChange={setSearch}
        embedHeader
        storeName={store.name}
        storeUrl={store.url}
      />
    </div>
  );
}

export default function SiteCategoriesPage() {
  return (
    <SitePageShell>
      <CategoriesInner />
    </SitePageShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "site"])),
  },
});