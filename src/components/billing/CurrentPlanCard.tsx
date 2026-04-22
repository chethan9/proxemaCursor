import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } 
...
Period ends on {format(new Date(sub.current_period_end), "PP")}
        </p>
      )}
    </CardContent>
    </Card>
  );
}