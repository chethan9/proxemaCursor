import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { ProductsTab } from "@/components/explore/ProductsTab";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function ProductsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const [search, setSearch] = useState("");
  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-xs text-muted-foreground">Manage {store.name} products</p>
        </div>
        <Link href={`/sites/${id}/products/new`}>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </Link>
      </div>
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