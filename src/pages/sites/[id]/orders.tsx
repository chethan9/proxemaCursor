import { useState } from "react";
import { SitePageShell, useSiteFromRoute, SiteSectionHeader, SiteLoadingSkeleton } from "./_shared";
import { OrdersTab } from "@/components/explore/OrdersTab";

function OrdersInner() {
  const { id, store, loading } = useSiteFromRoute();
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <SiteSectionHeader
        store={store}
        searchPlaceholder="Search orders by #, customer, or email..."
        search={search}
        onSearchChange={setSearch}
      />
      <OrdersTab storeId={id} storeUrl={store.url} search={search} />
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