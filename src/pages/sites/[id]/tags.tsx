import { useState } from "react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "./_shared";
import { TaxonomyTab } from "@/components/explore/TaxonomyTab";

function TagsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <TaxonomyTab
        storeId={id}
        mode="tags"
        search={search}
        onSearchChange={setSearch}
        embedHeader
        storeName={store.name}
        storeUrl={store.url}
      />
    </div>
  );
}

export default function SiteTagsPage() {
  return (
    <SitePageShell>
      <TagsInner />
    </SitePageShell>
  );
}