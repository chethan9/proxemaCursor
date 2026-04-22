import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

export default function PaymentMethodsPage() {
  return (
    <AppLayout title="Payment Methods">
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-semibold mb-6">Saved Payment Methods</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No saved cards yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Saved cards will appear here once live gateway tokenization is enabled. For now, each renewal requires a one-time payment through the billing page.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}