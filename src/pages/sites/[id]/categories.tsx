import { useState } from "react";
import { useTranslation } from "next-i18next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { TaxonomyTab } from "@/components/explore/TaxonomyTab";
import { SyncLockBanner, useSyncLocked } from "@/components/site/SyncLockBanner";

function CategoriesInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t } = useTranslation("common");
  const { locked } = useSyncLocked(id);
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">{t("errors.storeNotFound", "Store not found")}</div>;
  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <SyncLockBanner storeId={id} />
      <TaxonomyTab
        storeId={id}
        mode="categories"
        search={search}
        onSearchChange={setSearch}
        storeName={store.name}
        locked={locked}
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
