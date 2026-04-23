import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BasicEditor } from "@/components/product-edit/BasicEditor";
import { AdvancedShell } from "@/components/product-edit/AdvancedShell";
import { loadProduct, buildFormStateFromProduct, ProductFormState } from "@/services/productEditService";
import { useToast } from "@/hooks/use-toast";
import { useStores } from "@/hooks/queries/useStores";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";

type Mode = "basic" | "advanced";

async function deleteProduct(storeId: string, productId: string): Promise<void> {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Delete failed (${res.status})`);
  }
}

export default function ProductEditPage() {
  const router = useRouter();
  const { id: storeId, productId } = router.query as { id?: string; productId?: string };
  const { data: stores = [] } = useStores();
  const store = stores.find((s) => s.id === storeId);
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("basic");
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!storeId || !productId) return;
    setLoading(true);
    loadProduct(storeId, productId)
      .then((p) => setForm(buildFormStateFromProduct(p)))
      .catch((e) => toast({ title: "Failed to load", description: (e as Error).message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [storeId, productId, toast]);

  const del = useSiteMutation<void, void>({
    mutationFn: () => deleteProduct(storeId!, productId!),
    invalidateKeys: storeId ? [queryKeys.products(storeId), ["product", productId]] : [],
    siteName: store?.name,
    successToast: "Product deleted",
    onSuccessExtra: () => {
      if (storeId) router.push(`/sites/${storeId}/products`);
    },
  });

  if (loading || !form) {
    return (
      <AppLayout title="Edit product">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={form.name || "Edit product"}>
      <div className="border-b bg-background">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/sites/${storeId}/products`} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm font-semibold truncate">{form.name || "Untitled product"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border bg-muted p-0.5 text-xs">
              <button onClick={() => setMode("basic")} className={`px-2.5 py-1 rounded ${mode === "basic" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Basic</button>
              <button onClick={() => setMode("advanced")} className={`px-2.5 py-1 rounded ${mode === "advanced" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Advanced</button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={del.isPending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Delete
            </Button>
          </div>
        </div>
      </div>

      {mode === "basic" ? (
        <BasicEditor storeId={storeId!} productId={productId!} form={form} setForm={setForm} />
      ) : (
        <AdvancedShell storeId={storeId!} productId={productId!} form={form} setForm={setForm} />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium">{form.name || "this product"}</span> from {store?.name || "WooCommerce"} and from the local mirror. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
