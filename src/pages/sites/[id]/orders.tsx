import { useState } from "react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { OrdersTab } from "@/components/explore/OrdersTab";

function OrdersInner() {
  const { id, store, loading } = useSiteFromRoute();
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
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