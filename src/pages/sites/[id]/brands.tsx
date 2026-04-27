import { useState } from "react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { TaxonomyTab } from "@/components/explore/TaxonomyTab";

function BrandsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <TaxonomyTab
        storeId={id}
        mode="brands"
        search={search}
        onSearchChange={setSearch}
        embedHeader
        storeName={store.name}
        storeUrl={store.url}
      />
    </div>
  );
}

export default function SiteBrandsPage() {
  return (
    <SitePageShell>
      <BrandsInner />
    </SitePageShell>
  );
}