import { useState } from "react";
import { SitePageShell, useSiteFromRoute, SiteSectionHeader, SiteLoadingSkeleton } from "./_shared";
import { ProductsTab } from "@/components/explore/ProductsTab";

function ProductsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <SiteSectionHeader
        store={store}
        searchPlaceholder="Search products by name or SKU..."
        search={search}
        onSearchChange={setSearch}
      />
      <ProductsTab storeId={id} storeUrl={store.url} search={search} />
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