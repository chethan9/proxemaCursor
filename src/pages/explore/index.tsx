import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Store, ArrowRight, Compass } from "lucide-react";
import { getStores, type StoreWithClient } from "@/services/storeService";

export default function ExplorePage() {
  const [stores, setStores] = useState<StoreWithClient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStores()
      .then((d) => setStores(d))
      .catch((e) => console.error("Load stores failed:", e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AuthGuard>
      <AppLayout title="Explore">
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Explore</h1>
              <p className="text-sm text-muted-foreground">Browse synced data across your stores</p>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Store className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No stores found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s) => (
                <Link key={s.id} href={`/explore/${s.id}`} className="group">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{s.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{s.url}</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="outline" className="text-[10px]">
                          {s.status || "pending"}
                        </Badge>
                        {s.client_name && (
                          <span className="text-xs text-muted-foreground truncate">{s.client_name}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    </AuthGuard>
  );
}