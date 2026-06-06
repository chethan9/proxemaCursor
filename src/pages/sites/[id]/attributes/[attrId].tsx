import { useRouter } from "next/router";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AttributeDetailPage() {
  const router = useRouter();
  const { id, attrId } = router.query;
  const storeId = typeof id === "string" ? id : "";
  const attributeId = typeof attrId === "string" ? attrId : "";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link href={storeId ? `/sites/${storeId}/attributes` : "/"}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to attributes
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attribute</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Detailed attribute view is not available yet. Manage terms from the attributes list.
          </p>
          {attributeId ? (
            <p className="font-mono text-xs text-muted-foreground">ID: {attributeId}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
