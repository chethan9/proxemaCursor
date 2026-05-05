import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/router";
import Image from "next/image";
import { useTranslation } from "next-i18next";

interface TopProduct {
  product_id: number;
  name: string | null;
  units: number;
  revenue: number;
  image: string | null;
  local_id: string | null;
}

interface Props {
  products: TopProduct[];
  storeId: string;
  currency: string;
  loading?: boolean;
  subtitle?: string;
}

export function TopProductsCard({ products, storeId, currency, loading, subtitle }: Props) {
  const { t } = useTranslation("site");
  const router = useRouter();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("home.cards.topProducts.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle ?? t("home.cards.topProducts.subtitle")}</p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("home.cards.topProducts.empty")}</div>
        ) : (
          <div className="divide-y">
            {products.map((p) => (
              <button
                key={p.product_id}
                onClick={() => p.local_id && router.push(`/sites/${storeId}/products/edit/${p.local_id}`)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
                disabled={!p.local_id}
              >
                <div className="relative h-10 w-10 rounded-md border bg-muted overflow-hidden shrink-0">
                  {p.image ? (
                    <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">—</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{t("home.cards.topProducts.unitsSold", { count: p.units })}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">
                    {p.revenue.toFixed(2)} <span className="text-xs text-muted-foreground">{currency}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}