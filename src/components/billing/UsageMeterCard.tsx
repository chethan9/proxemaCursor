import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress 
...
="Products per site" current={u.products} max={quotas.maxProductsPerSite} />
        ))}
      </CardContent>
    </Card>
  );
}